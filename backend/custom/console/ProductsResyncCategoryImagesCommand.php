<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * php artisan products:resync-category-images
 *
 * Для всех Product'ов поставщиков, у которых у их категории есть image_url —
 * подменяет primary картинку Product'а на картинку категории. Нужно потому,
 * что групповой Product (=leaf-категория FK) логично показывать обложкой
 * самой игры, а не флажком региона из первого варианта.
 */
class ProductsResyncCategoryImagesCommand extends Command
{
    protected $signature = 'products:resync-category-images';
    protected $description = 'Заменить primary картинки Product\'ов поставщиков на image_url их категорий';

    public function handle(): int
    {
        $count = DB::update("
            UPDATE product_images pi
            INNER JOIN products p ON p.id = pi.product_id
            INNER JOIN categories c ON c.id = p.category_id
            SET pi.url = c.image_url
            WHERE p.provider_id IS NOT NULL
              AND c.image_url IS NOT NULL
              AND pi.is_primary = 1
        ");

        $this->info("✓ Обновлено product_images: {$count}");
        return 0;
    }
}
