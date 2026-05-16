<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Product;
use App\Models\Promocode;

/**
 * Применение промокодов. Используется и публичным /promocode/check (превью
 * скидки на чекауте), и CheckoutController (фактическое применение к заказу).
 */
class PromocodeService
{
    /**
     * Резолвит позиции корзины [{product_id, qty, params}] в строки с ценами:
     * [['product' => Product, 'qty' => int, 'total' => float], ...].
     * Несуществующие/неактивные товары пропускаются.
     *
     * @param array<int, array{product_id:int, qty:int, params?:array}> $items
     * @return array<int, array{product:Product, qty:int, total:float}>
     */
    public function resolveLines(array $items): array
    {
        $ids = array_column($items, 'product_id');
        $products = Product::whereIn('id', $ids)->where('status', 'active')->get()->keyBy('id');

        $lines = [];
        foreach ($items as $row) {
            $product = $products->get($row['product_id'] ?? null);
            if (!$product) {
                continue;
            }
            $qty = max(1, (int) ($row['qty'] ?? 1));
            $params = $row['params'] ?? [];
            $lines[] = [
                'product' => $product,
                'qty' => $qty,
                'total' => $this->lineTotal($product, $qty, $params),
            ];
        }
        return $lines;
    }

    /** Цена позиции с учётом amount_input (пополнения с динамической суммой). */
    private function lineTotal(Product $product, int $qty, array $params): float
    {
        foreach ($product->required_params ?? [] as $p) {
            if (($p['type'] ?? '') === 'amount_input') {
                $amount = isset($params['amount']) ? (float) $params['amount'] : 0.0;
                $markup = (float) ($p['fee_pct'] ?? $product->markup_pct ?? 0);
                return round($amount * (1 + $markup / 100), 2) * $qty;
            }
        }
        return (float) $product->price_final * $qty;
    }

    /**
     * Оценить промокод для набора строк заказа.
     *
     * @param array<int, array{product:Product, qty:int, total:float}> $lines
     * @return array{ok:bool, discount:float, promocode:?Promocode, message:?string}
     */
    public function evaluate(string $code, array $lines, ?int $userId): array
    {
        $fail = fn (string $msg): array => [
            'ok' => false, 'discount' => 0.0, 'promocode' => null, 'message' => $msg,
        ];

        $promo = Promocode::whereRaw('LOWER(code) = ?', [mb_strtolower(trim($code))])->first();
        if (!$promo || !$promo->isValid()) {
            return $fail('Промокод не найден или истёк');
        }

        $subtotal = array_sum(array_column($lines, 'total'));
        if ($promo->min_total !== null && $subtotal < (float) $promo->min_total) {
            $min = number_format((float) $promo->min_total, 0, '', ' ');
            return $fail("Промокод действует на заказ от {$min} ₽");
        }

        // Сумма позиций, подпадающих под ограничения промокода (категории/товары).
        $eligible = 0.0;
        foreach ($lines as $line) {
            if ($promo->coversProduct($line['product'])) {
                $eligible += $line['total'];
            }
        }
        if ($eligible <= 0) {
            return $fail('Промокод не применим к товарам в заказе');
        }

        // Лимит на пользователя — только для авторизованных (по user_id).
        if ($promo->limit_per_user && $userId) {
            $usedByUser = Order::where('promocode_id', $promo->id)
                ->where('user_id', $userId)
                ->count();
            if ($usedByUser >= $promo->limit_per_user) {
                return $fail('Вы уже использовали этот промокод');
            }
        }

        $discount = $promo->discountFor($eligible);
        if ($discount <= 0) {
            return $fail('Промокод не даёт скидки на этот заказ');
        }

        return ['ok' => true, 'discount' => $discount, 'promocode' => $promo, 'message' => null];
    }
}
