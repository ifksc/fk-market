<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\ProductImage;
use App\Models\Provider;
use App\Models\ProviderProduct;
use App\Models\Seller;
use App\Models\Product;
use App\Services\PriceCalculator;
use App\Services\Providers\ProductGrouper;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Str;

class ProviderCatalogController extends Controller
{
    /**
     * GET /api/admin/providers/{provider}/catalog
     * Список provider_products для выбранного поставщика. Фильтры:
     *   ?filter=connected|unconnected|all  (default: unconnected)
     *   ?q=...  — поиск по названию
     */
    public function index(Provider $provider, Request $request): JsonResponse
    {
        $q = ProviderProduct::where('provider_id', $provider->id);

        $filter = $request->string('filter')->toString() ?: 'unconnected';
        match ($filter) {
            'connected' => $q->whereNotNull('product_id'),
            'unconnected' => $q->whereNull('product_id'),
            default => null,
        };

        if ($search = $request->string('q')->toString()) {
            $q->where('raw_meta', 'like', "%{$search}%");
        }

        $items = $q->orderByDesc('last_seen_at')->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $items->getCollection()->map(fn (ProviderProduct $pp) => [
                'external_id' => $pp->external_id,
                'product_id' => $pp->product_id,
                'name' => $pp->raw_meta['name_ru'] ?? '—',
                'description' => $pp->raw_meta['description_ru'] ?? null,
                'category_id' => $pp->raw_meta['category_id'] ?? null,
                'category_name' => $pp->raw_meta['category_name'] ?? null,
                'logo' => $pp->raw_meta['logo'] ?? null,
                'price_in' => $pp->price_in ? (float) $pp->price_in : null,
                'currency' => $pp->raw_meta['currency'] ?? null,
                'last_seen_at' => $pp->last_seen_at?->toIso8601String(),
                'in_stock' => $pp->in_stock,
            ]),
            'meta' => [
                'total' => $items->total(),
                'per_page' => $items->perPage(),
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
                'connected_count' => ProviderProduct::where('provider_id', $provider->id)->whereNotNull('product_id')->count(),
                'unconnected_count' => ProviderProduct::where('provider_id', $provider->id)->whereNull('product_id')->count(),
            ],
        ]);
    }

    /**
     * GET /api/admin/providers/{provider}/catalog/{externalId}
     * Полная информация по товару поставщика — для формы подключения.
     */
    public function show(Provider $provider, string $externalId): JsonResponse
    {
        $pp = ProviderProduct::where('provider_id', $provider->id)
            ->where('external_id', $externalId)
            ->firstOrFail();

        // Авто-подсказка категории: ищем нашу категорию, синканную из FK-категории товара.
        // Сначала пробуем сохранённый local_category_id (более свежий — записан синком),
        // потом fallback — поиск по provider_id + external_id.
        $suggestedId = $pp->raw_meta['local_category_id'] ?? null;
        if (!$suggestedId && ($fkCatId = $pp->raw_meta['category_id'] ?? null)) {
            $suggestedId = Category::where('provider_id', $provider->id)
                ->where('provider_external_id', (string) $fkCatId)
                ->value('id');
        }
        $suggestedCategory = $suggestedId
            ? Category::select('id', 'slug', 'name', 'parent_id')->find($suggestedId)
            : null;

        return response()->json([
            'data' => [
                'external_id' => $pp->external_id,
                'product_id' => $pp->product_id,
                'raw_meta' => $pp->raw_meta,
                'price_in' => $pp->price_in ? (float) $pp->price_in : null,
                'in_stock' => $pp->in_stock,
                'last_seen_at' => $pp->last_seen_at?->toIso8601String(),
                'suggested_category' => $suggestedCategory ? [
                    'id' => $suggestedCategory->id,
                    'slug' => $suggestedCategory->slug,
                    'name' => $suggestedCategory->name,
                    'parent_id' => $suggestedCategory->parent_id,
                ] : null,
            ],
        ]);
    }

    /**
     * POST /api/admin/providers/{provider}/catalog/{externalId}/connect
     * Создаёт Product в нашем каталоге и связывает его с provider_product.
     */
    public function connect(Provider $provider, string $externalId, Request $request): JsonResponse
    {
        $pp = ProviderProduct::where('provider_id', $provider->id)
            ->where('external_id', $externalId)
            ->firstOrFail();

        if ($pp->product_id) {
            return response()->json(['message' => 'Уже подключено к товару #' . $pp->product_id], 422);
        }

        // Если фронт не передал category_id — пробуем подставить нашу suggested-категорию
        // (синканную из FK-категории товара). Если найдём — фолбэк, иначе валидация упадёт ниже.
        if (!$request->filled('category_id')) {
            $suggestedId = $pp->raw_meta['local_category_id'] ?? null;
            if (!$suggestedId && ($fkCatId = $pp->raw_meta['category_id'] ?? null)) {
                $suggestedId = Category::where('provider_id', $provider->id)
                    ->where('provider_external_id', (string) $fkCatId)
                    ->value('id');
            }
            if ($suggestedId) $request->merge(['category_id' => $suggestedId]);
        }

        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:categories,id'],
            'name' => ['required', 'string', 'max:255'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'price_base' => ['required', 'numeric', 'min:0'],
            'markup_pct' => ['nullable', 'numeric'],
            'fulfillment_fallback' => ['nullable', 'in:manual,none'],
            'required_params' => ['nullable', 'array'],
            'status' => ['nullable', 'in:draft,active'],
        ]);

        $platformSeller = Seller::where('slug', 'platform')->firstOrFail();

        $product = Product::create([
            'seller_id' => $platformSeller->id,
            'category_id' => $data['category_id'],
            'slug' => 'fkwallet-' . preg_replace('/[^a-z0-9-]/i', '', (string) $externalId) . '-' . Str::lower(Str::random(4)),
            'name' => $data['name'],
            'short_description' => $data['short_description'] ?? null,
            'description' => $data['description'] ?? null,
            'price_base' => $data['price_base'],
            'markup_pct' => $data['markup_pct'] ?? null,
            'price_final' => 0,
            'currency' => $pp->raw_meta['currency'] ?? 'RUB',
            'fulfillment_mode' => 'api',
            'fulfillment_fallback' => $data['fulfillment_fallback'] ?? 'manual',
            'provider_id' => $provider->id,
            'provider_external_id' => $externalId,
            'required_params' => $data['required_params'] ?? null,
            'status' => $data['status'] ?? 'draft',
            'published_at' => ($data['status'] ?? 'draft') === 'active' ? now() : null,
        ]);

        $product->price_final = PriceCalculator::compute($product);
        $product->save();

        // Картинка из FK (URL — пока без скачивания)
        if ($logo = $pp->raw_meta['logo'] ?? null) {
            ProductImage::create([
                'product_id' => $product->id,
                'url' => $logo,
                'is_primary' => true,
            ]);
        }

        $pp->update(['product_id' => $product->id]);

        return response()->json([
            'data' => ['product_id' => $product->id, 'product_slug' => $product->slug],
        ], 201);
    }

    /**
     * POST /api/admin/providers/{provider}/sync
     * Запускает providers:sync для конкретного поставщика.
     */
    public function sync(Provider $provider): JsonResponse
    {
        Artisan::call('providers:sync', ['provider' => $provider->code]);
        return response()->json([
            'data' => ['ok' => true, 'output' => Artisan::output()],
        ]);
    }

    /**
     * POST /api/admin/providers/{provider}/catalog/connect-all
     * Массовое подключение всех unconnected товаров поставщика.
     *
     * Body:
     *   status  ('draft'|'active', default 'draft')
     *   limit   (int|null, default null) — для контролируемых батчей
     */
    public function connectAll(Provider $provider, Request $request): JsonResponse
    {
        $data = $request->validate([
            'status' => ['nullable', 'in:draft,active'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:500'],
            'from_id' => ['nullable', 'integer', 'min:0'],
        ]);

        // Поднимаем PHP-лимиты на всякий случай — массовое подключение долгое.
        @set_time_limit(0);
        @ini_set('memory_limit', '512M');

        $result = ProductGrouper::default()->groupAll($provider, [
            'status' => $data['status'] ?? 'draft',
            // По категориям обрабатывать дешевле — больших leaf'ов мало; ставим лимит выше.
            'limit' => $data['limit'] ?? 100,
            'from_id' => $data['from_id'] ?? null,
        ]);

        return response()->json(['data' => $result]);
    }
}
