<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProviderProduct;
use App\Services\Providers\MediaDownloader;
use App\Services\Providers\ProductGrouper;
use Illuminate\Console\Command;

/**
 * php artisan products:rebuild-variants {provider=fkwallet}
 *
 * Для всех Product'ов поставщика, у которых в required_params есть variant_select,
 * пересобирает массив variants — обновляет картинку (image) каждого варианта,
 * подтягивая её из provider_products.raw_meta.logo и локализуя через MediaDownloader.
 *
 * Используется один раз после добавления поля variant.image — для миграции
 * существующих Product'ов. Идемпотентная.
 */
class ProductsRebuildVariantsCommand extends Command
{
    protected $signature = 'products:rebuild-variants {provider=fkwallet}';
    protected $description = 'Обновить картинки variants у Product\'ов с variant_select (тянет logo из provider_products)';

    public function handle(MediaDownloader $downloader): int
    {
        $code = $this->argument('provider');
        $provider = \App\Models\Provider::where('code', $code)->first();
        if (!$provider) {
            $this->error("Provider [{$code}] не найден");
            return 1;
        }

        $products = Product::where('provider_id', $provider->id)
            ->whereNull('provider_external_id') // групповые
            ->with('category.parent.parent')
            ->get();

        $this->info("→ Кандидатов: {$products->count()}");

        $updated = 0;
        $skipped = 0;
        $bar = $this->output->createProgressBar($products->count());
        $bar->start();

        foreach ($products as $product) {
            $params = $product->required_params ?? [];
            $changed = false;

            // Лейбл variant_select в зависимости от категории (Steam игры → "Регион", остальное → "Выберите номинал")
            $newLabel = ProductGrouper::variantLabelFor($product->category);

            foreach ($params as $i => $p) {
                if (($p['type'] ?? '') !== 'variant_select') continue;

                $newVariants = [];
                foreach ($p['variants'] ?? [] as $v) {
                    // Ищем provider_product по external_id — оттуда тянем свежее logo
                    $pp = ProviderProduct::where('provider_id', $provider->id)
                        ->where('external_id', (string) ($v['external_id'] ?? ''))
                        ->first();

                    $image = $v['image'] ?? null;
                    if (!$image && $pp && !empty($pp->raw_meta['logo'])) {
                        $image = $downloader->download($pp->raw_meta['logo'], 'fkwallet/variants')
                            ?? $pp->raw_meta['logo'];
                    }

                    $newVariants[] = [
                        'label' => $v['label'] ?? '—',
                        'external_id' => $v['external_id'] ?? '',
                        'price' => $v['price'] ?? 0,
                        'image' => $image,
                    ];
                }

                $params[$i]['variants'] = $newVariants;
                $params[$i]['label'] = $newLabel;
                $changed = true;
            }

            // Чистим HTML в описаниях
            $newShort = $product->short_description ? ProductGrouper::normalizeText($product->short_description) : null;
            $newDesc = $product->description ? ProductGrouper::normalizeText($product->description) : null;
            if ($newShort !== $product->short_description) {
                $product->short_description = $newShort;
                $changed = true;
            }
            if ($newDesc !== $product->description) {
                $product->description = $newDesc;
                $changed = true;
            }

            // Пересчитаем variants_count
            $vc = 0;
            foreach ($params as $p) {
                if (($p['type'] ?? '') === 'variant_select') {
                    $vc += count($p['variants'] ?? []);
                }
            }
            $newCount = !is_null($product->provider_external_id) ? 1 : max(1, $vc);
            if ((int) $product->variants_count !== $newCount) {
                $product->variants_count = $newCount;
                $changed = true;
            }

            if ($changed) {
                $product->required_params = $params;
                $product->save();
                $updated++;
            } else {
                $skipped++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("✓ Обновлено: {$updated}");
        if ($skipped > 0) $this->line("  пропущено (без variant_select): {$skipped}");

        return 0;
    }
}
