<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class ProductController extends Controller
{
    /**
     * GET /api/products — листинг каталога с фильтрами/сортировкой/пагинацией.
     * Query: ?category=ai&q=claude&min_price=&max_price=&mode=&min_rating=&sort=popular&page=1
     */
    public function index(Request $request): JsonResponse
    {
        $q = Product::query()->active()->with(['category:id,slug,name,icon', 'images']);

        if ($slug = $request->string('category')->toString()) {
            if ($cat = Category::where('slug', $slug)->first()) {
                // Включаем товары из самой категории и всех её подкатегорий —
                // покупатель, открывая «Игры», видит и «Игры → Steam → Far Far West».
                $ids = Category::subtreeIds($cat->id);
                $q->whereIn('category_id', $ids);
            }
        }
        if ($search = $request->string('q')->toString()) {
            $q->search($search);
        }
        if ($min = $request->float('min_price')) $q->where('price_final', '>=', $min);
        if ($max = $request->float('max_price')) $q->where('price_final', '<=', $max);
        if ($mode = $request->string('mode')->toString()) {
            $q->where('fulfillment_mode', $mode);
        }
        if ($minRating = $request->float('min_rating')) {
            $q->where('rating', '>=', $minRating);
        }

        match ($request->string('sort')->toString() ?: 'popular') {
            'price_asc'  => $q->orderBy('price_final'),
            'price_desc' => $q->orderByDesc('price_final'),
            'new'        => $q->orderByDesc('published_at'),
            'rating'     => $q->orderByDesc('rating'),
            default      => $q->orderByDesc('sales_count'),
        };

        $products = $q->paginate($request->integer('per_page', 24));

        return response()->json([
            'data' => $products->getCollection()->map(fn ($p) => $this->transform($p)),
            'meta' => [
                'total' => $products->total(),
                'per_page' => $products->perPage(),
                'current_page' => $products->currentPage(),
                'last_page' => $products->lastPage(),
            ],
        ]);
    }

    /** GET /api/products/{slug} */
    public function show(Product $product): JsonResponse
    {
        $product->load([
            'category:id,slug,name,icon',
            'images',
            'reviews.user:id,name',
            'faqItems' => fn ($q) => $q->where('is_active', true)->orderBy('sort')->orderBy('id'),
        ]);

        return response()->json([
            'data' => array_merge($this->transform($product), [
                'description' => $product->description,
                'required_params' => $product->required_params,
                'reviews' => $product->reviews->take(5)->map(fn ($r) => [
                    'id' => $r->id,
                    'rating' => $r->rating,
                    'text' => $r->text,
                    'author' => $r->user?->name ?? 'Покупатель',
                    'created_at' => $r->created_at?->toIso8601String(),
                ]),
                'faq' => $product->faqItems->map(fn ($f) => [
                    'id' => $f->id,
                    'question' => $f->question,
                    'answer' => $f->answer,
                ]),
                'related' => $this->relatedProducts($product)
                    ->map(fn ($p) => $this->transform($p))
                    ->values(),
            ]),
        ]);
    }

    /**
     * Похожие товары — для блока внутренней перелинковки на странице товара.
     * Берём активные товары из «соседних» категорий (с тем же родителем; если
     * категория верхнего уровня — из её подкатегорий), кроме самого товара.
     */
    private function relatedProducts(Product $product): \Illuminate\Support\Collection
    {
        // Берём категорию отдельным запросом: в show() она загружена с урезанным
        // набором колонок (без parent_id).
        $cat = Category::find($product->category_id);
        if (!$cat) {
            return collect();
        }

        $catIds = Category::query()
            ->when(
                $cat->parent_id,
                fn ($q) => $q->where('parent_id', $cat->parent_id),
                fn ($q) => $q->where('parent_id', $cat->id),
            )
            ->pluck('id')
            ->push($cat->id)
            ->unique();

        return Product::query()
            ->active()
            ->whereIn('category_id', $catIds)
            ->where('id', '!=', $product->id)
            ->orderByDesc('sales_count')
            ->limit(8)
            ->with(['category:id,slug,name,icon', 'images'])
            ->get();
    }

    private function transform(Product $p): array
    {
        return [
            'id' => $p->id,
            'slug' => $p->slug,
            'name' => $p->name,
            'short_description' => $p->short_description,
            'price' => (float) $p->price_final,
            'price_old' => $p->price_old ? (float) $p->price_old : null,
            'discount_pct' => $p->discountPct(),
            'currency' => $p->currency,
            'rating' => (float) $p->rating,
            'reviews_count' => $p->reviews_count,
            'sales_count' => $p->sales_count,
            'stock_available' => $p->stock_available,
            'fulfillment_mode' => $p->fulfillment_mode,
            'category' => $p->category ? [
                'slug' => $p->category->slug,
                'name' => $p->category->name,
                'icon' => $p->category->icon,
            ] : null,
            'image' => $p->primaryImage()?->url,
            'images' => $p->images->pluck('url'),
        ];
    }
}
