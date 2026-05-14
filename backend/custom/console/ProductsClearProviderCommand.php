<?php

namespace App\Console\Commands;

use App\Models\Provider;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProviderProduct;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * php artisan products:clear-provider {provider=fkwallet} {--force}
 *
 * Удаляет все Product'ы провайдера + их картинки и обнуляет связь
 * в provider_products.product_id — чтобы можно было запустить bulk-подключение
 * с новой логикой (например, после смены формата на групповые товары).
 *
 * НЕ удаляет provider_products — там кэш каталога FK, его не трогаем.
 * НЕ удаляет product'ы других провайдеров и нашей платформы (provider_id IS NULL).
 *
 * Запрашивает подтверждение, кроме --force.
 */
class ProductsClearProviderCommand extends Command
{
    protected $signature = 'products:clear-provider {provider=fkwallet} {--force}';
    protected $description = 'Удалить все Product\'ы конкретного провайдера (включая картинки), сохранив provider_products';

    public function handle(): int
    {
        $code = $this->argument('provider');
        $provider = Provider::where('code', $code)->first();
        if (!$provider) {
            $this->error("Provider [{$code}] не найден");
            return 1;
        }

        $productsCount = Product::where('provider_id', $provider->id)->count();
        $imagesCount = ProductImage::whereIn('product_id',
            Product::where('provider_id', $provider->id)->select('id'))->count();
        $linkedPp = ProviderProduct::where('provider_id', $provider->id)->whereNotNull('product_id')->count();

        $this->warn("ВНИМАНИЕ. Будут удалены:");
        $this->line("  - Product'ов: {$productsCount}");
        $this->line("  - ProductImage'ов: {$imagesCount}");
        $this->line("  - Сброс связи у provider_products: {$linkedPp}");
        $this->newLine();

        if (!$this->option('force') && !$this->confirm('Подтвердить?', false)) {
            $this->info('Отмена');
            return 0;
        }

        DB::transaction(function () use ($provider) {
            // 1. Развязываем provider_products (чтобы избежать ошибки FK при удалении Product)
            ProviderProduct::where('provider_id', $provider->id)
                ->whereNotNull('product_id')
                ->update(['product_id' => null]);

            // 2. Удаляем картинки явно (на случай если cascade не сработает по какой-то причине)
            ProductImage::whereIn('product_id',
                Product::where('provider_id', $provider->id)->select('id')
            )->delete();

            // 3. Удаляем продукты
            Product::where('provider_id', $provider->id)->delete();
        });

        $this->info("✓ Готово. Теперь можно запустить providers:connect-all для пересоздания.");
        return 0;
    }
}
