<?php

namespace App\Services;

use App\Models\PricingRule;
use App\Models\Product;
use App\Models\ProviderProduct;
use Illuminate\Support\Collection;

/**
 * Массовый пересчёт price_final + variants[*].price у Product'ов
 * по текущим pricing_rules.
 *
 * Оптимизация под большой каталог (10k+ товаров):
 *   • активные pricing_rules префетчатся ОДНИМ запросом и резолвятся в памяти
 *     (PriceCalculator::compute() делает SQL на каждый товар — не используем его здесь);
 *   • provider_products для variants — тоже одной выборкой по затронутым provider_id;
 *   • работа батчами по id (limit + from_id) — фронт делает несколько вызовов
 *     и не упирается в HTTP-таймаут.
 */
class PriceRecomputer
{
    /** @var Collection<int, PricingRule>|null Кеш правил на время recompute. */
    protected ?Collection $rules = null;
    /** @var Collection<string, ProviderProduct>|null Кеш provider_products: ключ "providerId:externalId". */
    protected ?Collection $pps = null;

    /**
     * @param  array<string,mixed>  $opts
     *      from_id (int|null) — обрабатываем Product.id > from_id
     *      limit   (int, default 500)
     *      provider_id (int|null), category_id (int|null) — доп. фильтры
     *
     * @return array{
     *   scanned:int,
     *   updated:int,
     *   total:int,        // сколько ещё осталось (включая обработанных в этом батче)
     *   last_id:int|null, // id последнего обработанного Product
     *   done:bool
     * }
     */
    public function recomputeAll(array $opts = []): array
    {
        $fromId = $opts['from_id'] ?? null;
        $limit = (int) ($opts['limit'] ?? 500);
        $providerId = $opts['provider_id'] ?? null;
        $categoryId = $opts['category_id'] ?? null;

        $base = Product::query()->whereIn('status', ['active', 'draft', 'archived']);
        if ($providerId) $base->where('provider_id', (int) $providerId);
        if ($categoryId) $base->where('category_id', (int) $categoryId);
        if ($fromId) $base->where('id', '>', (int) $fromId);

        $totalRemaining = (clone $base)->count();
        if ($totalRemaining === 0) {
            return ['scanned' => 0, 'updated' => 0, 'total' => 0, 'last_id' => $fromId, 'done' => true];
        }

        // Префетч правил (один раз на recompute) — все активные.
        // Правила резолвятся быстро: их обычно единицы-десятки.
        $this->rules = PricingRule::where('is_active', true)
            ->orderByRaw("FIELD(scope,'product','seller','category','global')")
            ->orderByDesc('priority')
            ->get()
            ->groupBy('scope'); // {global: [...], category: [...], seller: [...], product: [...]}

        // Тянем батч Product'ов
        $products = (clone $base)->orderBy('id')->limit($limit)->get();

        // Префетч provider_products только для тех Product'ов с variants/provider, что попали в батч
        $providerIds = $products->whereNotNull('provider_id')->pluck('provider_id')->unique();
        $this->pps = ProviderProduct::whereIn('provider_id', $providerIds)
            ->get(['provider_id', 'external_id', 'price_in'])
            ->keyBy(fn ($pp) => $pp->provider_id . ':' . $pp->external_id);

        $scanned = 0;
        $updated = 0;
        $lastId = $fromId;

        foreach ($products as $product) {
            $scanned++;
            $lastId = $product->id;
            if ($this->recomputeOne($product)) $updated++;
        }

        $done = $totalRemaining <= $limit;

        return [
            'scanned' => $scanned,
            'updated' => $updated,
            'total' => $totalRemaining,
            'last_id' => $lastId,
            'done' => $done,
        ];
    }

    protected function recomputeOne(Product $product): bool
    {
        $changed = false;

        // 1. Считаем новый price_final без обращения к БД (правила уже в памяти)
        $markup = $product->markup_pct !== null
            ? (float) $product->markup_pct
            : (float) ($this->resolveMarkup($product) ?? 0);
        $newFinal = round((float) $product->price_base * (1 + $markup / 100), 2);

        if (abs((float) $product->price_final - $newFinal) > 0.001) {
            $product->price_final = $newFinal;
            $changed = true;
        }

        // 2. variants[*].price — если есть variant_select и provider
        if (!empty($product->required_params) && $product->price_base > 0 && $product->provider_id) {
            $factor = $newFinal / (float) $product->price_base;
            $params = $product->required_params;
            $paramsChanged = false;

            foreach ($params as $i => $p) {
                if (($p['type'] ?? '') !== 'variant_select') continue;

                foreach ($params[$i]['variants'] ?? [] as $j => $v) {
                    $extId = (string) ($v['external_id'] ?? '');
                    $pp = $this->pps?->get($product->provider_id . ':' . $extId);
                    if (!$pp || !$pp->price_in) continue;
                    $newPrice = round((float) $pp->price_in * $factor, 2);
                    if (abs(((float) ($v['price'] ?? 0)) - $newPrice) > 0.001) {
                        $params[$i]['variants'][$j]['price'] = $newPrice;
                        $paramsChanged = true;
                    }
                }
                if ($paramsChanged) {
                    // Самый дешёвый сверху
                    usort($params[$i]['variants'], fn ($a, $b) => ($a['price'] ?? 0) <=> ($b['price'] ?? 0));
                }
            }

            if ($paramsChanged) {
                $product->required_params = $params;
                $changed = true;
            }
        }

        if ($changed) $product->save();
        return $changed;
    }

    /**
     * Резолвит markup из кеша правил по специфичности product → seller → category → global.
     * Не делает SQL.
     */
    protected function resolveMarkup(Product $product): ?float
    {
        if (!$this->rules) return null;

        // Порядок: product → seller → category → global
        foreach (['product', 'seller', 'category', 'global'] as $scope) {
            $bucket = $this->rules->get($scope, collect());
            foreach ($bucket as $rule) {
                if ($scope === 'global') return (float) $rule->markup_pct;
                $scopeId = match ($scope) {
                    'product' => $product->id,
                    'seller' => $product->seller_id,
                    'category' => $product->category_id,
                };
                if ((int) $rule->scope_id === (int) $scopeId) {
                    return (float) $rule->markup_pct;
                }
            }
        }
        return null;
    }
}
