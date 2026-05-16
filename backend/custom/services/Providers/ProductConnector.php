<?php

namespace App\Services\Providers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\ProviderProduct;
use App\Models\Seller;
use App\Services\PriceCalculator;
use App\Services\ProductSlug;

/**
 * Создаёт Product из ProviderProduct и связывает их.
 *
 * Используется в двух местах:
 *   • ProviderCatalogController::connect — поштучное подключение из админ-формы
 *   • ProvidersConnectAllCommand        — массовое подключение всех неподключённых
 *
 * Если данных не хватает (категория, цена, имя) — товар не создаётся,
 * возвращается status='skipped' и reason — чтобы caller мог собрать
 * список пропущенных и показать админу.
 */
class ProductConnector
{
    public function __construct(
        protected Seller $platformSeller,
    ) {}

    public static function default(): self
    {
        $platform = Seller::where('slug', 'platform')->firstOrFail();
        return new self($platform);
    }

    /**
     * @param  array<string,mixed>  $opts
     *      category_id, name, short_description, description,
     *      price_base, markup_pct, fulfillment_fallback,
     *      required_params, status ('draft'|'active')
     *
     * @return array{
     *   status: 'connected'|'already'|'skipped',
     *   reason?: string,
     *   product?: \App\Models\Product
     * }
     */
    public function connect(ProviderProduct $pp, array $opts = []): array
    {
        if ($pp->product_id) {
            return ['status' => 'already', 'reason' => 'уже подключено к товару #' . $pp->product_id];
        }

        $meta = $pp->raw_meta ?? [];

        // 1. Категория — приоритет: явно переданная → local_category_id → поиск по provider_external_id
        $categoryId = $opts['category_id'] ?? null;
        if (!$categoryId) {
            $categoryId = $meta['local_category_id'] ?? null;
        }
        if (!$categoryId && !empty($meta['category_id'])) {
            $categoryId = Category::where('provider_id', $pp->provider_id)
                ->where('provider_external_id', (string) $meta['category_id'])
                ->value('id');
        }
        if (!$categoryId) {
            return ['status' => 'skipped', 'reason' => 'нет категории (категория FK не зеркалирована)'];
        }
        if (!Category::whereKey($categoryId)->exists()) {
            return ['status' => 'skipped', 'reason' => "категория #{$categoryId} не найдена"];
        }

        // 2. Цена
        $price = $opts['price_base'] ?? ($meta['price'] ?? $pp->price_in);
        if ($price === null || (float) $price <= 0) {
            return ['status' => 'skipped', 'reason' => 'нет цены или цена ≤ 0'];
        }

        // 3. Имя
        $name = $opts['name'] ?? ($meta['name_ru'] ?? null);
        if (!$name) {
            return ['status' => 'skipped', 'reason' => 'нет name_ru'];
        }

        // 4. Описания
        $shortDesc = $opts['short_description'] ?? null;
        if ($shortDesc === null) {
            $shortDesc = mb_substr((string) ($meta['description_ru'] ?? ''), 0, 500) ?: null;
        }
        $description = $opts['description'] ?? null;
        if ($description === null) {
            $description = trim(
                (string) ($meta['description_ru'] ?? '') .
                (isset($meta['help_description_ru']) ? "\n\n" . $meta['help_description_ru'] : ''),
            ) ?: null;
        }

        // 5. required_params — конвертация FK fields[] → наш формат
        $requiredParams = $opts['required_params'] ?? null;
        if ($requiredParams === null && !empty($meta['fields']) && is_array($meta['fields'])) {
            $requiredParams = array_values(array_map(function (array $f): array {
                $isSelect = !empty($f['values']) && is_array($f['values']);
                $row = [
                    'name' => $f['key'] ?? 'field',
                    'label' => $f['placeholder'] ?? ($f['key'] ?? ''),
                    'type' => $isSelect ? 'select' : 'string',
                    'required' => true,
                ];
                if (!empty($f['info']) && is_array($f['info'])) {
                    $row['hint'] = implode('. ', $f['info']);
                }
                if ($isSelect) {
                    $row['options'] = $f['values'];
                }
                return $row;
            }, $meta['fields']));
            if (!$requiredParams) $requiredParams = null;
        }

        $status = $opts['status'] ?? 'draft';

        // 6. Создание Product
        $product = Product::create([
            'seller_id' => $this->platformSeller->id,
            'category_id' => $categoryId,
            'slug' => ProductSlug::make($name),
            'name' => $name,
            'short_description' => $shortDesc,
            'description' => $description,
            'price_base' => (float) $price,
            'markup_pct' => $opts['markup_pct'] ?? null,
            'price_final' => 0,
            'currency' => $meta['currency'] ?? 'RUB',
            'fulfillment_mode' => 'api',
            'fulfillment_fallback' => $opts['fulfillment_fallback'] ?? 'manual',
            'provider_id' => $pp->provider_id,
            'provider_external_id' => $pp->external_id,
            'required_params' => $requiredParams,
            'status' => $status,
            'published_at' => $status === 'active' ? now() : null,
        ]);

        $product->price_final = PriceCalculator::compute($product);
        $product->save();

        // 7. Картинка из FK — пробуем локализовать, при ошибке оставляем URL CDN провайдера
        if (!empty($meta['logo'])) {
            $localUrl = app(MediaDownloader::class)->download($meta['logo'], 'fkwallet/products');
            ProductImage::create([
                'product_id' => $product->id,
                'url' => $localUrl ?? $meta['logo'],
                'is_primary' => true,
            ]);
        }

        // 8. Связь обратно
        $pp->update(['product_id' => $product->id]);

        return ['status' => 'connected', 'product' => $product];
    }

}
