<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\PaymentMethod;
use App\Models\Product;
use App\Models\Provider;
use App\Services\FreekassaGateway;
use App\Services\Providers\FkwalletProductsGateway;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * POST /api/checkout
 *
 * Принимает корзину от фронта, создаёт Order + OrderItems в БД,
 * формирует платёжную ссылку FKwallet и возвращает её фронту для редиректа.
 */
class CheckoutController extends Controller
{
    public function __invoke(Request $request, FreekassaGateway $fk): JsonResponse
    {
        $payload = $request->validate([
            'email' => ['required', 'email', 'max:190'],
            'phone' => ['nullable', 'string', 'max:32'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer', 'exists:products,id'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.params' => ['nullable', 'array'],
            'payment_method' => ['nullable', 'string', 'max:40'],
        ]);

        // Получаем актуальные товары из БД
        $productIds = collect($payload['items'])->pluck('product_id')->unique();
        $products = Product::whereIn('id', $productIds)->where('status', 'active')->get()->keyBy('id');

        if ($products->count() !== $productIds->count()) {
            return response()->json([
                'error' => 'Некоторые товары больше не доступны',
            ], 422);
        }

        // Подсчёт итогов на основе цен из БД (НЕ из фронта — защита от подделки).
        // Для динамических товаров (с amount_input) — price = amount * (1 + markup/100).
        $subtotal = 0.0;
        $resolvedItems = [];
        foreach ($payload['items'] as $row) {
            $product = $products->get($row['product_id']);
            $qty = (int) $row['qty'];
            $params = $row['params'] ?? null;

            $amountParam = $this->findAmountParam($product);
            if ($amountParam) {
                $amount = isset($params['amount']) ? (float) $params['amount'] : 0;
                $min = (float) ($amountParam['min'] ?? 1);
                $max = (float) ($amountParam['max'] ?? PHP_INT_MAX);
                if ($amount < $min || $amount > $max) {
                    return response()->json([
                        'error' => "Сумма пополнения вне диапазона: {$min}–{$max} ₽",
                    ], 422);
                }
                $markup = (float) ($amountParam['fee_pct'] ?? $product->markup_pct ?? 0);
                $price = round($amount * (1 + $markup / 100), 2);

                // Перед созданием заказа валидируем Steam-логин на бэке
                // (на фронте могли обмануть проверку, поэтому повторяем).
                if ($this->requiresSteamValidation($product)) {
                    $login = (string) ($params['steam_login'] ?? '');
                    if ($login === '') {
                        return response()->json(['error' => 'Не указан логин Steam'], 422);
                    }
                    if (!$this->validateSteam($product, $login)) {
                        return response()->json([
                            'error' => "Steam-аккаунт «{$login}» не найден. Проверьте логин.",
                        ], 422);
                    }
                }
            } else {
                $price = (float) $product->price_final;
            }

            $resolvedItems[] = [
                'product' => $product,
                'qty' => $qty,
                'price' => $price,
                'total' => $price * $qty,
                'params' => $params,
            ];
            $subtotal += $price * $qty;
        }

        $publicNumber = self::generatePublicNumber();

        // Атомарное создание заказа
        $order = DB::transaction(function () use ($payload, $resolvedItems, $subtotal, $publicNumber, $request) {
            $order = Order::create([
                'public_number' => $publicNumber,
                'user_id' => $request->user()?->id,
                'email' => $payload['email'],
                'phone' => $payload['phone'] ?? null,
                'currency' => 'RUB',
                'subtotal' => $subtotal,
                'discount' => 0,
                'total' => $subtotal,
                'status' => 'pending',
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
            ]);

            foreach ($resolvedItems as $item) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $item['product']->id,
                    'seller_id' => $item['product']->seller_id,
                    'qty' => $item['qty'],
                    'price' => $item['price'],
                    'price_in' => $item['product']->price_base,
                    'total' => $item['total'],
                    'params' => $item['params'],
                    'fulfillment_status' => 'pending',
                ]);
            }

            return $order;
        });

        // Резолвим способ оплаты (по code) для применения extra_fee и FK i={n}.
        // Если метод не указан или неактивен — fk_id null, открываем общую страницу FK.
        $paymentMethod = null;
        if (!empty($payload['payment_method'])) {
            $paymentMethod = PaymentMethod::where('code', $payload['payment_method'])->where('is_enabled', true)->first();
            if ($paymentMethod) {
                // Доп. комиссия метода поверх subtotal (через order.total)
                if ((float) $paymentMethod->extra_fee_pct !== 0.0) {
                    $extra = round((float) $order->total * (float) $paymentMethod->extra_fee_pct / 100, 2);
                    $order->update(['total' => (float) $order->total + $extra]);
                    $order->refresh();
                }
            }
        }

        // Режим (sci/api) теперь у каждого PaymentMethod свой. По умолчанию sci.
        $integrationMode = $paymentMethod?->integration_mode ?: 'sci';
        $paymentUrl = $fk->makePaymentUrl($order, $payload['email'], $paymentMethod?->fk_id, $integrationMode);
        $payment = $fk->recordPendingPayment($order, $paymentUrl);

        $order->update(['payment_id' => $payment->id]);

        return response()->json([
            'data' => [
                'order_id' => $order->id,
                'public_number' => $order->public_number,
                'total' => (float) $order->total,
                'payment_url' => $paymentUrl,
            ],
        ]);
    }

    private static function generatePublicNumber(): string
    {
        // FK-2026-XXXXX
        $year = date('Y');
        $rand = strtoupper(Str::random(5));
        return "FK-{$year}-{$rand}";
    }

    /** Находит блок amount_input в required_params, если есть. */
    private function findAmountParam(Product $product): ?array
    {
        foreach ($product->required_params ?? [] as $p) {
            if (($p['type'] ?? '') === 'amount_input') return $p;
        }
        return null;
    }

    /** Есть ли у товара поле, требующее Steam-валидации? */
    private function requiresSteamValidation(Product $product): bool
    {
        foreach ($product->required_params ?? [] as $p) {
            if (($p['type'] ?? '') === 'steam_login') return true;
        }
        return false;
    }

    private function validateSteam(Product $product, string $login): bool
    {
        $provider = $product->provider_id ? Provider::find($product->provider_id) : null;
        if (!$provider || !$provider->is_enabled) return false;
        return FkwalletProductsGateway::fromConfig($provider->id)->validateSteamAccount($login);
    }
}
