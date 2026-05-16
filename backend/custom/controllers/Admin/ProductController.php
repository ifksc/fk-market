<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use App\Models\ProductImage;
use App\Models\Seller;
use App\Models\PricingRule;
use App\Services\PriceCalculator;
use App\Services\ProductSlug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProductController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Product::query()->with(['category:id,slug,name', 'provider:id,code,name']);

        if ($search = $request->string('q')->toString()) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }
        if ($status = $request->string('status')->toString()) $q->where('status', $status);
        if ($category = $request->string('category')->toString()) {
            $q->whereHas('category', fn ($c) => $c->where('slug', $category));
        }
        if ($mode = $request->string('mode')->toString()) $q->where('fulfillment_mode', $mode);

        match ($request->string('sort')->toString() ?: 'updated_desc') {
            'name' => $q->orderBy('name'),
            'price_asc' => $q->orderBy('price_final'),
            'price_desc' => $q->orderByDesc('price_final'),
            'sales' => $q->orderByDesc('sales_count'),
            'created_asc' => $q->orderBy('created_at'),
            'created_desc' => $q->orderByDesc('created_at'),
            'updated_asc' => $q->orderBy('updated_at'),
            'updated_desc' => $q->orderByDesc('updated_at'),
            default => $q->orderByDesc('updated_at'),
        };

        $products = $q->paginate($request->integer('per_page', 30));

        return response()->json([
            'data' => $products->getCollection()->map(fn ($p) => $this->transformList($p)),
            'meta' => [
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
            ],
        ]);
    }

    public function show(Product $product): JsonResponse
    {
        $product->load(['category', 'provider', 'images', 'stockItems']);
        return response()->json(['data' => $this->transformDetail($product)]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $this->validateProduct($request, isCreate: true);

        $product = new Product();
        $this->fillFromRequest($product, $data);
        $product->seller_id = Seller::where('slug', 'platform')->value('id');
        $product->slug = !empty($data['slug']) ? $data['slug'] : ProductSlug::make($data['name']);
        $product->price_final = 0;
        $product->save();

        $product->price_final = PriceCalculator::compute($product);
        $product->save();

        $product->load(['category', 'provider', 'images', 'stockItems']);
        return response()->json(['data' => $this->transformDetail($product)], 201);
    }

    public function update(Request $request, Product $product): JsonResponse
    {
        $data = $this->validateProduct($request, isCreate: false);

        $this->fillFromRequest($product, $data);
        $product->save();
        $product->price_final = PriceCalculator::compute($product);

        // Если у товара есть amount_input (топап), синхронизируем fee_pct
        // с фактической наценкой — иначе админская правка markup_pct не отразится.
        $this->syncAmountFeePct($product);
        $product->save();

        $product->load(['category', 'provider', 'images', 'stockItems']);
        return response()->json(['data' => $this->transformDetail($product)]);
    }

    /**
     * Перетряхивает fee_pct внутри amount_input по актуальной наценке товара.
     * Берёт markup_pct если есть, иначе резолвит через PricingRule.
     */
    private function syncAmountFeePct(Product $product): void
    {
        $params = $product->required_params ?? [];
        $hasAmount = false;
        foreach ($params as $p) {
            if (($p['type'] ?? '') === 'amount_input') $hasAmount = true;
        }
        if (!$hasAmount) return;

        $markup = $product->markup_pct !== null
            ? (float) $product->markup_pct
            : (float) (PricingRule::resolveFor($product)?->markup_pct ?? 0);

        foreach ($params as $i => $p) {
            if (($p['type'] ?? '') === 'amount_input') {
                $params[$i]['fee_pct'] = $markup;
            }
        }
        $product->required_params = $params;
    }

    public function destroy(Product $product): JsonResponse
    {
        $product->update(['status' => 'archived']);
        return response()->json(['data' => ['ok' => true]]);
    }

    // ---------------- Картинки товара ----------------

    /**
     * POST /api/admin/products/{product:id}/images
     * Принимает файл, сохраняет в storage/app/public, создаёт ProductImage.
     * Если у товара ещё нет картинок — новая становится primary.
     */
    public function uploadImage(Request $request, Product $product): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'image', 'max:5120'],
            'is_primary' => ['nullable', 'boolean'],
        ]);
        $file = $request->file('image');
        $hash = sha1_file($file->getRealPath()) ?: bin2hex(random_bytes(8));
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'jpg');
        $path = "products/{$product->id}/{$hash}.{$ext}";

        Storage::disk('public')->put($path, file_get_contents($file->getRealPath()));
        $url = Storage::disk('public')->url($path);

        $isPrimaryRequested = (bool) $request->boolean('is_primary');
        $hasAnyPrimary = $product->images()->where('is_primary', true)->exists();
        $isPrimary = $isPrimaryRequested || !$hasAnyPrimary;

        if ($isPrimary) {
            // снимаем галочку с предыдущих primary
            $product->images()->where('is_primary', true)->update(['is_primary' => false]);
        }

        $img = ProductImage::create([
            'product_id' => $product->id,
            'url' => $url,
            'is_primary' => $isPrimary,
            'sort_order' => $product->images()->count(),
        ]);

        return response()->json(['data' => ['id' => $img->id, 'url' => $img->url, 'is_primary' => (bool) $img->is_primary]]);
    }

    /** PUT /api/admin/products/{product:id}/images/{image:id}/primary — пометить как primary. */
    public function makeImagePrimary(Product $product, ProductImage $image): JsonResponse
    {
        if ($image->product_id !== $product->id) {
            return response()->json(['message' => 'Картинка не принадлежит товару'], 404);
        }
        $product->images()->where('is_primary', true)->update(['is_primary' => false]);
        $image->update(['is_primary' => true]);
        return response()->json(['data' => ['ok' => true]]);
    }

    /** DELETE /api/admin/products/{product:id}/images/{image:id} */
    public function deleteImage(Product $product, ProductImage $image): JsonResponse
    {
        if ($image->product_id !== $product->id) {
            return response()->json(['message' => 'Картинка не принадлежит товару'], 404);
        }
        // Если удаляем primary — назначим primary'ом первую из оставшихся
        $wasPrimary = (bool) $image->is_primary;
        $image->delete();
        if ($wasPrimary) {
            $next = $product->images()->orderBy('sort_order')->first();
            $next?->update(['is_primary' => true]);
        }
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * GET /api/admin/categories — список для select'ов в формах.
     */
    public function categories(): JsonResponse
    {
        return response()->json([
            'data' => Category::orderBy('sort_order')->get(['id', 'slug', 'name']),
        ]);
    }

    // ---------------- Helpers ----------------

    private function validateProduct(Request $request, bool $isCreate): array
    {
        return $request->validate([
            'name' => [$isCreate ? 'required' : 'sometimes', 'string', 'max:255'],
            'slug' => ['nullable', 'string', 'max:180'],
            'category_id' => [$isCreate ? 'required' : 'sometimes', 'integer', 'exists:categories,id'],
            'short_description' => ['nullable', 'string', 'max:500'],
            'description' => ['nullable', 'string'],
            'price_base' => [$isCreate ? 'required' : 'sometimes', 'numeric', 'min:0'],
            'markup_pct' => ['nullable', 'numeric', 'min:-50', 'max:500'],
            'price_old' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'fulfillment_mode' => [$isCreate ? 'required' : 'sometimes', 'in:stock,api,manual'],
            'fulfillment_fallback' => ['nullable', 'in:manual,none'],
            'provider_id' => ['nullable', 'integer', 'exists:providers,id'],
            'provider_external_id' => ['nullable', 'string', 'max:191'],
            'required_params' => ['nullable', 'array'],
            'required_params.*.name' => ['required_with:required_params', 'string'],
            'required_params.*.label' => ['required_with:required_params', 'string'],
            'required_params.*.type' => ['required_with:required_params', 'string'],
            'required_params.*.required' => ['required_with:required_params', 'boolean'],
            'status' => ['nullable', 'in:draft,active,archived'],
        ]);
    }

    private function fillFromRequest(Product $product, array $data): void
    {
        $allowed = [
            'name','category_id','short_description','description',
            'price_base','markup_pct','price_old','currency',
            'fulfillment_mode','fulfillment_fallback','provider_id','provider_external_id',
            'required_params','status',
        ];
        foreach ($allowed as $field) {
            if (array_key_exists($field, $data)) {
                $product->{$field} = $data[$field];
            }
        }
        if (array_key_exists('slug', $data) && $data['slug']) {
            $product->slug = $data['slug'];
        }
        if (!$product->status) {
            $product->status = 'draft';
        }
        if (!$product->currency) {
            $product->currency = 'RUB';
        }
        if (!$product->fulfillment_fallback) {
            $product->fulfillment_fallback = $product->fulfillment_mode === 'api' ? 'manual' : 'none';
        }
    }

    private function transformList(Product $p): array
    {
        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'name' => $p->name,
            'category' => $p->category ? ['slug' => $p->category->slug, 'name' => $p->category->name] : null,
            'provider' => $p->provider ? ['code' => $p->provider->code, 'name' => $p->provider->name] : null,
            'fulfillment_mode' => $p->fulfillment_mode,
            'fulfillment_fallback' => $p->fulfillment_fallback,
            'price_base' => (float) $p->price_base,
            'price_final' => (float) $p->price_final,
            'markup_pct' => $p->markup_pct ? (float) $p->markup_pct : null,
            'stock_available' => $p->stock_available,
            'sales_count' => $p->sales_count,
            'rating' => (float) $p->rating,
            'status' => $p->status,
            'created_at' => $p->created_at?->toIso8601String(),
            'updated_at' => $p->updated_at?->toIso8601String(),
        ];
    }

    private function transformDetail(Product $p): array
    {
        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'name' => $p->name,
            'short_description' => $p->short_description,
            'description' => $p->description,
            'category_id' => $p->category_id,
            'category' => $p->category ? ['slug' => $p->category->slug, 'name' => $p->category->name] : null,
            'provider_id' => $p->provider_id,
            'provider_external_id' => $p->provider_external_id,
            'fulfillment_mode' => $p->fulfillment_mode,
            'fulfillment_fallback' => $p->fulfillment_fallback,
            'price_base' => (float) $p->price_base,
            'price_final' => (float) $p->price_final,
            'price_old' => $p->price_old ? (float) $p->price_old : null,
            'markup_pct' => $p->markup_pct ? (float) $p->markup_pct : null,
            'currency' => $p->currency,
            'required_params' => $p->required_params,
            'status' => $p->status,
            'stock_total' => $p->stockItems->count(),
            'stock_available' => $p->stockItems->where('is_sold', false)->count(),
            'stock_sold' => $p->stockItems->where('is_sold', true)->count(),
            'images' => $p->images->map(fn ($i) => ['id' => $i->id, 'url' => $i->url, 'is_primary' => $i->is_primary]),
        ];
    }
}
