<?php

namespace App\Console\Commands;

use App\Models\Product;
use Illuminate\Console\Command;

/**
 * php artisan products:recompute-variants-count
 *
 * Разово проходит по всем Product'ам и проставляет variants_count:
 *   • групповой (provider_external_id = NULL) → сумма variants в variant_select
 *   • одиночный → 1
 * Нужен один раз после накатки миграции 2026_05_12_000007, чтобы у уже
 * созданных Product'ов счётчик сразу был верным.
 */
class ProductsRecomputeVariantsCountCommand extends Command
{
    protected $signature = 'products:recompute-variants-count';
    protected $description = 'Пересчитать products.variants_count по текущим required_params';

    public function handle(): int
    {
        $total = Product::count();
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $updated = 0;
        Product::query()->orderBy('id')->chunkById(500, function ($items) use (&$updated, $bar) {
            foreach ($items as $product) {
                $newCount = 1;
                if (is_null($product->provider_external_id)) {
                    $n = 0;
                    foreach ($product->required_params ?? [] as $p) {
                        if (($p['type'] ?? '') === 'variant_select') {
                            $n += count($p['variants'] ?? []);
                        }
                    }
                    $newCount = max(1, $n);
                }
                if ((int) $product->variants_count !== $newCount) {
                    $product->variants_count = $newCount;
                    $product->saveQuietly();
                    $updated++;
                }
                $bar->advance();
            }
        });

        $bar->finish();
        $this->newLine(2);
        $this->info("✓ Обновлено: {$updated} из {$total}");
        return 0;
    }
}
