<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Services\ProductSlug;
use Illuminate\Console\Command;

/**
 * php artisan products:reslug
 *   --dry   только показать изменения, ничего не записывать
 *
 * Разовая команда: переводит slug'и существующих товаров на читаемые
 * (транслитерация из названия). Текущий slug сохраняется в legacy_slug —
 * по нему работает 301-редирект со старых URL.
 *
 * Идемпотентна: товары с уже заполненным legacy_slug пропускаются,
 * поэтому повторный запуск безопасен.
 */
class ProductsReslugCommand extends Command
{
    protected $signature = 'products:reslug {--dry : показать изменения без записи}';

    protected $description = 'Перегенерировать slug товаров на читаемые';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $updated = 0;
        $skipped = 0;

        foreach (Product::orderBy('id')->get() as $product) {
            if ($product->legacy_slug) {
                $skipped++;
                continue; // уже переименован ранее
            }

            $newSlug = ProductSlug::make($product->name, $product->id);
            if ($newSlug === $product->slug) {
                $skipped++;
                continue; // slug и так читаемый
            }

            $this->line("  #{$product->id}: {$product->slug} → {$newSlug}");

            if (!$dry) {
                $product->legacy_slug = $product->slug;
                $product->slug = $newSlug;
                $product->save();
            }
            $updated++;
        }

        $verb = $dry ? 'будет изменено' : 'изменено';
        $this->info("Товаров {$verb}: {$updated}, пропущено: {$skipped}");

        return self::SUCCESS;
    }
}
