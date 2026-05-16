<?php

namespace App\Services\Providers;

use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Provider;
use App\Models\ProviderProduct;
use App\Models\Seller;
use App\Services\PriceCalculator;
use App\Services\ProductSlug;
use Illuminate\Support\Facades\DB;

/**
 * Создаёт Product'ы по принципу «1 leaf-категория FK = 1 Product».
 *
 * Если в категории несколько товаров — Product «групповой»: у него
 * provider_external_id = NULL, а в required_params первым элементом
 * лежит variant_select с массивом variants (label, external_id, price).
 *
 * Если в категории один товар — обычный Product через ProductConnector.
 *
 * Категории с детьми (не leaf) пропускаются — товары лежат в их потомках.
 */
class ProductGrouper
{
    public function __construct(
        protected ProductConnector $connector,
        protected Seller $platformSeller,
    ) {}

    public static function default(): self
    {
        return new self(
            ProductConnector::default(),
            Seller::where('slug', 'platform')->firstOrFail(),
        );
    }

    /**
     * @param  array<string,mixed>  $opts
     *      status        ('draft'|'active', default 'draft')
     *      limit         (int|null)  — макс. категорий за прогон
     *      from_id       (int|null)  — курсор по categories.id
     *      onProgress    (callable(int $processed, int $total): void)
     *
     * @return array{
     *   total: int,
     *   processed: int,
     *   created: int,
     *   skipped: int,
     *   skipped_items: list<array{external_id:string,name:string,reason:string}>,
     *   last_id: int|null,
     *   done: bool
     * }
     */
    public function groupAll(Provider $provider, array $opts = []): array
    {
        $status = $opts['status'] ?? 'draft';
        $limit = $opts['limit'] ?? null;
        $fromId = $opts['from_id'] ?? null;
        $onProgress = $opts['onProgress'] ?? null;

        // Берём только leaf-категории (без children с тем же провайдером)
        $base = Category::where('provider_id', $provider->id)
            ->whereDoesntHave('children', fn ($q) => $q->where('provider_id', $provider->id));

        if ($fromId) $base->where('id', '>', (int) $fromId);

        $total = (clone $base)->count();
        $effective = $limit ? min($limit, $total) : $total;

        $created = 0;
        $skipped = [];
        $processed = 0;
        $lastId = $fromId;

        $query = (clone $base)->orderBy('id');
        if ($limit) $query->limit($limit);

        foreach ($query->get() as $cat) {
            $lastId = $cat->id;

            // Все ещё-не-подключённые provider_products в этой leaf-категории FK
            $pps = ProviderProduct::where('provider_id', $provider->id)
                ->whereNull('product_id')
                ->where('raw_meta->category_id', (int) $cat->provider_external_id)
                ->orderBy('id')
                ->get();

            $processed++;
            if ($onProgress) $onProgress($processed, $effective);

            if ($pps->isEmpty()) continue; // ничего обрабатывать

            try {
                DB::beginTransaction();
                if ($pps->count() === 1) {
                    // Одиночный товар — обычный Product через коннектор
                    $result = $this->connector->connect($pps->first(), ['status' => $status]);
                } else {
                    // Несколько товаров — групповой
                    $result = $this->createGrouped($cat, $pps, $status);
                }
                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $result = ['status' => 'skipped', 'reason' => 'exception: ' . $e->getMessage()];
            }

            if ($result['status'] === 'connected') {
                $created++;
            } else {
                $skipped[] = [
                    'external_id' => 'cat#' . $cat->id,
                    'name' => $cat->name,
                    'reason' => $result['reason'] ?? 'неизвестно',
                ];
            }
        }

        $done = $processed === 0 || $processed >= $total;

        return [
            'total' => $total,
            'processed' => $processed,
            'created' => $created,
            'skipped' => count($skipped),
            'skipped_items' => $skipped,
            'last_id' => $lastId,
            'done' => $done,
        ];
    }

    /**
     * Создаёт групповой Product из набора provider_products одной leaf-категории.
     *
     * @return array{status: 'connected'|'skipped', reason?: string, product?: Product}
     */
    protected function createGrouped(Category $cat, \Illuminate\Support\Collection $pps, string $status): array
    {
        // Собираем варианты. Цена — закупочная (price из raw_meta).
        // image — превью варианта (флажок страны для региональных вариантов).
        $downloader = app(MediaDownloader::class);
        $rawVariants = [];
        foreach ($pps as $pp) {
            $meta = $pp->raw_meta ?? [];
            $priceIn = (float) ($meta['price'] ?? $pp->price_in ?? 0);
            if ($priceIn <= 0) continue; // вариант без цены не используем

            $variantImage = null;
            if (!empty($meta['logo'])) {
                $variantImage = $downloader->download($meta['logo'], 'fkwallet/variants') ?? $meta['logo'];
            }

            $rawVariants[] = [
                'label' => (string) ($meta['name_ru'] ?? '—'),
                'external_id' => (string) $pp->external_id,
                'price_in' => $priceIn,
                'pp_id' => $pp->id,
                'image' => $variantImage,
            ];
        }
        if (empty($rawVariants)) {
            return ['status' => 'skipped', 'reason' => 'ни у одного варианта нет цены'];
        }

        // Минимальная цена — для price_base; markup применим ко всем вариантам ниже.
        $minPriceIn = min(array_column($rawVariants, 'price_in'));

        // Канонические данные берём с первого pp (logo, fields, описание).
        $primaryMeta = $pps->first()->raw_meta ?? [];

        $rawShort = (string) ($primaryMeta['description_ru'] ?? '');
        $rawDesc = trim(
            $rawShort .
            (isset($primaryMeta['help_description_ru']) ? "\n\n" . $primaryMeta['help_description_ru'] : ''),
        );
        $shortDesc = mb_substr($this->normalizeText($rawShort), 0, 500) ?: null;
        $description = $this->normalizeText($rawDesc) ?: null;

        // Создаём Product (price_final = 0 пока, посчитаем после)
        $slug = ProductSlug::make($cat->name);
        $product = Product::create([
            'seller_id' => $this->platformSeller->id,
            'category_id' => $cat->id,
            'slug' => $slug,
            'name' => $cat->name, // имя leaf-категории FK = название игры/товара
            'short_description' => $shortDesc,
            'description' => $description,
            'price_base' => $minPriceIn,
            'markup_pct' => null,
            'price_final' => 0,
            'currency' => $primaryMeta['currency'] ?? 'RUB',
            'fulfillment_mode' => 'api',
            'fulfillment_fallback' => 'manual',
            'provider_id' => $cat->provider_id,
            'provider_external_id' => null, // важно: внешних id несколько, лежат в variants
            'required_params' => $this->buildRequiredParams($rawVariants, $primaryMeta, 1.0, $cat), // markup посчитаем ниже
            'variants_count' => max(1, count($rawVariants)),
            'status' => $status,
            'published_at' => $status === 'active' ? now() : null,
        ]);

        // Считаем итоговый markup (по pricing rules или markup_pct)
        $product->price_final = PriceCalculator::compute($product);

        // Зная итоговую цену min-варианта (price_final) и его закупочную (minPriceIn),
        // получаем коэффициент наценки и применяем его к остальным variants.
        $factor = $minPriceIn > 0 ? ((float) $product->price_final) / $minPriceIn : 1.0;
        $product->required_params = $this->buildRequiredParams($rawVariants, $primaryMeta, $factor, $cat);
        $product->save();

        // Картинка: приоритет — обложка leaf-категории FK (= картинка самой игры).
        // У provider_product'ов в группе лежат картинки вариантов (флажки регионов),
        // а у категории — нормальная обложка. Если у категории нет — фолбэк на logo варианта.
        $primaryImage = $cat->image_url ?: null;
        if (!$primaryImage && !empty($primaryMeta['logo'])) {
            $primaryImage = app(MediaDownloader::class)->download($primaryMeta['logo'], 'fkwallet/products')
                ?? $primaryMeta['logo'];
        }
        if ($primaryImage) {
            ProductImage::create([
                'product_id' => $product->id,
                'url' => $primaryImage,
                'is_primary' => true,
            ]);
        }

        // Связываем все pp с этим Product
        foreach ($pps as $pp) {
            $pp->update(['product_id' => $product->id]);
        }

        return ['status' => 'connected', 'product' => $product];
    }

    /**
     * Собирает required_params: variant_select сверху, потом остальные FK fields из первого pp.
     *
     * @param  list<array{label:string,external_id:string,price_in:float,pp_id:int}>  $rawVariants
     */
    protected function buildRequiredParams(array $rawVariants, array $primaryMeta, float $priceFactor, ?Category $cat = null): array
    {
        $variants = array_map(function ($v) use ($priceFactor) {
            return [
                'label' => $v['label'],
                'external_id' => $v['external_id'],
                'price' => round($v['price_in'] * $priceFactor, 2),
                'image' => $v['image'] ?? null,
            ];
        }, $rawVariants);

        // Сортируем по цене — минимальная сверху
        usort($variants, fn ($a, $b) => $a['price'] <=> $b['price']);

        $params = [[
            'name' => 'variant',
            'label' => $this->variantLabelFor($cat),
            'type' => 'variant_select',
            'required' => true,
            'variants' => array_values($variants),
        ]];

        // FK fields из первого товара (предполагаем: у вариантов одной игры одинаковые fields)
        if (!empty($primaryMeta['fields']) && is_array($primaryMeta['fields'])) {
            foreach ($primaryMeta['fields'] as $f) {
                if (!is_array($f)) continue;
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
                $params[] = $row;
            }
        }

        return $params;
    }

    /**
     * Очищает HTML от тегов, оставляя переносы строк. FK отдаёт описания c <div>,
     * <br>, <a href=...> и т.п. — для нас важен только текст с базовой структурой.
     */
    public static function normalizeText(string $html): string
    {
        if ($html === '') return '';
        // Заменяем block- и br-теги на переносы строк
        $s = preg_replace('~<\s*br\s*/?\s*>~i', "\n", $html);
        $s = preg_replace('~</\s*(p|div|li|h[1-6])\s*>~i', "\n\n", $s);
        // Раскрываем <a href="...">текст</a> → текст (URL)
        $s = preg_replace_callback('~<a[^>]*href="([^"]+)"[^>]*>(.*?)</a>~is', function ($m) {
            $text = trim(strip_tags($m[2]));
            $href = trim($m[1]);
            if ($text === '' || $text === $href) return $href;
            return "{$text} ({$href})";
        }, $s);
        // Чистим оставшиеся теги
        $s = strip_tags($s);
        // Декодируем сущности и нормализуем пробелы
        $s = html_entity_decode($s, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $s = preg_replace('~[ \t]+~', ' ', $s);
        $s = preg_replace("~\n{3,}~", "\n\n", $s);
        return trim($s);
    }

    /**
     * Лейбл селектора вариантов: для дочек Steam-категории — «Регион»,
     * для всего остального (Mobile Legends, Spotify и пр.) — «Выберите номинал».
     */
    public static function variantLabelFor(?Category $cat): string
    {
        if (!$cat) return 'Выберите вариант';

        $cur = $cat;
        $depth = 0;
        while ($cur && $depth < 10) {
            // У FK категория "Steam игры" имеет provider_external_id = 85.
            // Любой её потомок считается региональным товаром.
            if ((string) $cur->provider_external_id === '85') {
                return 'Регион';
            }
            $cur = $cur->parent;
            $depth++;
        }
        return 'Выберите номинал';
    }
}
