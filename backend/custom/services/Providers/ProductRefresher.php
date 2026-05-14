<?php

namespace App\Services\Providers;

use App\Models\Product;
use App\Models\Provider;
use App\Models\ProviderProduct;
use App\Services\PriceCalculator;

/**
 * После синка каталога поставщика приводит наши Product'ы в актуальное состояние:
 *
 *   1. Цены — пересчёт price_base / price_final и variants[*].price по свежим
 *      provider_products.price_in (с применением markup из pricing rules).
 *   2. Variants — убираем те варианты, чьи provider_products исчезли (in_stock=0
 *      или last_seen_at старше пороса). Возвращаем при появлении.
 *   3. Видимость:
 *      • если все варианты исчезли — status='draft', auto_hidden_at = now()
 *      • если есть хоть один и Product был auto-скрыт ранее — восстановить в active.
 *
 * Учитывает только Product'ы, которые «принадлежат» поставщику (provider_id=N),
 * не трогает наши наши товары и товары других поставщиков.
 */
class ProductRefresher
{
    /**
     * @param  array<string,mixed>  $opts
     *      update_prices (bool, default true)
     *      hide_missing  (bool, default true)
     *      stale_after_minutes (int, default 120) — после скольких минут провайдер_продукт считаем «исчезнувшим»
     *
     * @return array{updated:int, hidden:int, restored:int, variants_removed:int}
     */
    public function refresh(Provider $provider, array $opts = []): array
    {
        $updatePrices = $opts['update_prices'] ?? true;
        $hideMissing = $opts['hide_missing'] ?? true;
        $staleMinutes = (int) ($opts['stale_after_minutes'] ?? 120);
        $staleThreshold = now()->subMinutes($staleMinutes);

        $stats = ['updated' => 0, 'hidden' => 0, 'restored' => 0, 'variants_removed' => 0];

        $products = Product::where('provider_id', $provider->id)->get();
        if ($products->isEmpty()) return $stats;

        // Префетчим все provider_products поставщика индексом по external_id для O(1)
        $pps = ProviderProduct::where('provider_id', $provider->id)
            ->get()
            ->keyBy(fn ($p) => (string) $p->external_id);

        foreach ($products as $product) {
            $changed = false;
            $hasLive = false;       // есть ли хоть один живой вариант
            $minPriceIn = null;     // минимум закупочной цены среди живых вариантов
            $existingFactor = null; // коэффициент наценки текущего Product

            $params = $product->required_params ?? [];

            // Пропускаем «специальные» товары, у которых нет ни provider_external_id,
            // ни variant_select в required_params — это товары типа Пополнения Steam
            // (работают через withdrawal API, не имеют записи в provider_products,
            // и Refresher для них всегда найдёт «ничего живого» и прячет в draft).
            $hasVariantSelect = false;
            foreach ($params as $p) {
                if (($p['type'] ?? '') === 'variant_select') { $hasVariantSelect = true; break; }
            }
            if (is_null($product->provider_external_id) && !$hasVariantSelect) {
                continue;
            }

            foreach ($params as $i => $p) {
                if (($p['type'] ?? '') !== 'variant_select') {
                    // Для одиночного Product (provider_external_id != NULL) собираем
                    // живость отдельно ниже.
                    continue;
                }
                $variants = $p['variants'] ?? [];
                $newVariants = [];
                foreach ($variants as $v) {
                    $ext = (string) ($v['external_id'] ?? '');
                    $pp = $pps->get($ext);
                    $alive = $pp
                        && $pp->in_stock !== 0
                        && (!$pp->last_seen_at || $pp->last_seen_at->gte($staleThreshold));

                    if (!$alive) {
                        $stats['variants_removed']++;
                        $changed = true;
                        continue; // удаляем variant
                    }
                    $hasLive = true;

                    // Обновляем цену варианта, если нужно
                    if ($updatePrices && $pp && $pp->price_in !== null) {
                        $newPriceIn = (float) $pp->price_in;
                        if ($minPriceIn === null || $newPriceIn < $minPriceIn) {
                            $minPriceIn = $newPriceIn;
                        }
                        // Сохраняем price_in во временное поле для пересчёта ниже
                        $v['_price_in'] = $newPriceIn;
                    }
                    $newVariants[] = $v;
                }
                $params[$i]['variants'] = $newVariants;
            }

            // Одиночный Product (без variant_select) — провертяем его provider_external_id
            if (!is_null($product->provider_external_id)) {
                $pp = $pps->get((string) $product->provider_external_id);
                $alive = $pp
                    && $pp->in_stock !== 0
                    && (!$pp->last_seen_at || $pp->last_seen_at->gte($staleThreshold));
                if ($alive) {
                    $hasLive = true;
                    if ($updatePrices && $pp->price_in !== null) {
                        $minPriceIn = (float) $pp->price_in;
                    }
                }
            }

            // Скрываем если ничего живого нет
            if (!$hasLive && $hideMissing && $product->status === 'active') {
                $product->status = 'draft';
                $product->auto_hidden_at = now();
                $stats['hidden']++;
                $changed = true;
            }
            // Восстанавливаем если ранее были авто-скрыты и появилось живое
            elseif ($hasLive && $product->status === 'draft' && $product->auto_hidden_at !== null) {
                $product->status = 'active';
                $product->auto_hidden_at = null;
                $product->published_at = $product->published_at ?? now();
                $stats['restored']++;
                $changed = true;
            }

            // Обновляем цены если есть живые и включена настройка
            if ($updatePrices && $hasLive && $minPriceIn !== null) {
                $oldBase = (float) $product->price_base;
                if (abs($oldBase - $minPriceIn) > 0.001) {
                    $product->price_base = $minPriceIn;
                    $product->price_final = PriceCalculator::compute($product);
                    $changed = true;
                }

                // Пересчитываем variants[*].price по коэффициенту
                $factor = $minPriceIn > 0 ? ((float) $product->price_final) / $minPriceIn : 1.0;
                foreach ($params as $i => $p) {
                    if (($p['type'] ?? '') !== 'variant_select') continue;
                    foreach ($params[$i]['variants'] as $j => $v) {
                        if (isset($v['_price_in'])) {
                            $params[$i]['variants'][$j]['price'] = round($v['_price_in'] * $factor, 2);
                            unset($params[$i]['variants'][$j]['_price_in']);
                            $changed = true;
                        }
                    }
                    // Сортируем по цене ASC (самый дешёвый сверху)
                    usort($params[$i]['variants'], fn ($a, $b) => ($a['price'] ?? 0) <=> ($b['price'] ?? 0));
                }
            }

            // Обновляем variants_count — для категорийных счётчиков
            $variantsCount = $this->countVariants($params);
            $newCount = !is_null($product->provider_external_id) ? ($hasLive ? 1 : 0) : $variantsCount;
            if ((int) $product->variants_count !== (int) $newCount) {
                $product->variants_count = max(1, $newCount); // никогда не 0, чтобы single-Product не пропадал
                $changed = true;
            }

            if ($changed) {
                $product->required_params = $params;
                $product->save();
                $stats['updated']++;
            }
        }

        return $stats;
    }

    /** Считает сумму variants по всем variant_select в required_params */
    protected function countVariants(array $params): int
    {
        $n = 0;
        foreach ($params as $p) {
            if (($p['type'] ?? '') === 'variant_select') {
                $n += count($p['variants'] ?? []);
            }
        }
        return $n;
    }
}
