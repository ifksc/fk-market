<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Category;
use App\Services\CategorySlug;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

/**
 * Управление категориями каталога.
 *
 * Категории провайдеров (provider_id != null) импортируются автоматически
 * из FK при синке. Их структуру (parent_id, slug) трогать нельзя — иначе
 * следующий синк сломает дерево. Но «оформление» (icon, image_url, sort_order,
 * is_active, name) можно править руками — выставляем флажок editable_only_meta.
 */
class CategoryController extends Controller
{
    /** GET /api/admin/categories */
    public function index(Request $request): JsonResponse
    {
        $q = Category::query()->orderBy('sort_order')->orderBy('name');

        if ($filter = $request->string('filter')->toString()) {
            match ($filter) {
                'ours' => $q->whereNull('provider_id'),
                'providers' => $q->whereNotNull('provider_id'),
                'roots' => $q->whereNull('parent_id'),
                default => null,
            };
        }
        if ($search = $request->string('q')->toString()) {
            $q->where(function ($qq) use ($search) {
                $qq->where('name', 'like', "%{$search}%")
                    ->orWhere('slug', 'like', "%{$search}%");
            });
        }

        $items = $q->paginate($request->integer('per_page', 50));

        // Прямой счётчик товаров с учётом variants_count (для одной строки списка)
        $directCounts = DB::table('products')
            ->whereIn('category_id', $items->pluck('id'))
            ->where('status', '!=', 'archived')
            ->groupBy('category_id')
            ->selectRaw('category_id, SUM(variants_count) as cnt')
            ->pluck('cnt', 'category_id')
            ->toArray();
        $directCounts = array_map('intval', $directCounts);

        return response()->json([
            'data' => $items->getCollection()->map(fn (Category $c) => $this->transform($c, $directCounts[$c->id] ?? 0)),
            'meta' => [
                'total' => $items->total(),
                'per_page' => $items->perPage(),
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
            ],
        ]);
    }

    /** GET /api/admin/categories/{category:id} */
    public function show(Category $category): JsonResponse
    {
        $count = $category->products()->where('status', '!=', 'archived')->count();
        return response()->json(['data' => $this->transform($category, $count)]);
    }

    /** POST /api/admin/categories */
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:180'],
            'slug' => ['nullable', 'string', 'max:120', 'unique:categories,slug'],
            'parent_id' => ['nullable', 'integer', 'exists:categories,id'],
            'description' => ['nullable', 'string'],
            'icon' => ['nullable', 'string', 'max:40'],
            'image_url' => ['nullable', 'string', 'max:500'],
            'sort_order' => ['nullable', 'integer'],
            'is_active' => ['nullable', 'boolean'],
            'show_in_header' => ['nullable', 'boolean'],
            'is_new' => ['nullable', 'boolean'],
        ]);

        $data['slug'] = $data['slug'] ?? $this->generateSlug($data['name']);
        $data['is_active'] = $data['is_active'] ?? true;
        $data['sort_order'] = $data['sort_order'] ?? 100;
        $data['provider_id'] = null; // создаём только наши

        $cat = Category::create($data);
        return response()->json(['data' => $this->transform($cat, 0)], 201);
    }

    /** PUT /api/admin/categories/{category:id} */
    public function update(Request $request, Category $category): JsonResponse
    {
        $isProviderCat = !is_null($category->provider_id);

        if ($isProviderCat) {
            // FK-категорию редактируем ограниченно — иначе синк её перезатрёт
            // (а parent/slug мы храним для маппинга на provider_external_id).
            $data = $request->validate([
                'name' => ['sometimes', 'string', 'max:180'],
                'icon' => ['nullable', 'string', 'max:40'],
                'image_url' => ['nullable', 'string', 'max:500'],
                'sort_order' => ['nullable', 'integer'],
                'is_active' => ['nullable', 'boolean'],
                'show_in_header' => ['nullable', 'boolean'],
                'is_new' => ['nullable', 'boolean'],
            ]);
        } else {
            $data = $request->validate([
                'name' => ['sometimes', 'string', 'max:180'],
                'slug' => ['nullable', 'string', 'max:120', Rule::unique('categories', 'slug')->ignore($category->id)],
                'parent_id' => ['nullable', 'integer', 'exists:categories,id', Rule::notIn([$category->id])],
                'description' => ['nullable', 'string'],
                'icon' => ['nullable', 'string', 'max:40'],
                'image_url' => ['nullable', 'string', 'max:500'],
                'sort_order' => ['nullable', 'integer'],
                'is_active' => ['nullable', 'boolean'],
                'show_in_header' => ['nullable', 'boolean'],
                'is_new' => ['nullable', 'boolean'],
            ]);
        }

        $category->update($data);

        $count = $category->products()->where('status', '!=', 'archived')->count();
        return response()->json(['data' => $this->transform($category->fresh(), $count)]);
    }

    /** DELETE /api/admin/categories/{category:id} */
    public function destroy(Category $category): JsonResponse
    {
        if (!is_null($category->provider_id)) {
            return response()->json([
                'message' => 'Категорию провайдера удалять нельзя — она нужна для маппинга при синке. Если хочешь скрыть — выстави is_active=false.',
            ], 422);
        }

        if ($category->children()->exists()) {
            return response()->json([
                'message' => 'Сначала удалите или перепривяжите дочерние категории.',
            ], 422);
        }

        if ($category->products()->exists()) {
            return response()->json([
                'message' => 'В категории есть товары — перенесите их в другую категорию перед удалением.',
            ], 422);
        }

        $category->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /api/admin/categories/{category:id}/image
     *
     * Принимает загруженный файл (jpg/png/webp/svg) и сохраняет в public storage.
     * Перезаписывает image_url категории. Старая картинка удаляется, чтобы не
     * накапливался мусор.
     */
    public function uploadImage(Request $request, Category $category): JsonResponse
    {
        $request->validate([
            'image' => ['required', 'file', 'image', 'max:5120'], // до 5 МБ
        ]);

        $file = $request->file('image');
        // Сохраняем под providers/categories/{id}/{hash}.{ext} — стабильный путь.
        // Имя — sha1 от хеша файла, чтобы при одинаковой картинке не плодить дубли.
        $hash = sha1_file($file->getRealPath()) ?: bin2hex(random_bytes(8));
        $ext = strtolower($file->getClientOriginalExtension() ?: $file->guessExtension() ?: 'bin');
        $path = "providers/categories/{$category->id}/{$hash}.{$ext}";

        $storage = Storage::disk('public');

        // Удалим предыдущую картинку этой категории, если она в нашем storage
        if ($category->image_url && str_contains($category->image_url, '/storage/')) {
            $oldRel = ltrim(parse_url($category->image_url, PHP_URL_PATH) ?: '', '/');
            $oldRel = preg_replace('~^storage/~', '', $oldRel);
            if ($oldRel && $storage->exists($oldRel) && $oldRel !== $path) {
                $storage->delete($oldRel);
            }
        }

        // Сохраняем
        $storage->put($path, file_get_contents($file->getRealPath()));

        $url = $storage->url($path);
        $category->update(['image_url' => $url]);

        $count = $category->products()->where('status', '!=', 'archived')->count();
        return response()->json(['data' => $this->transform($category->fresh(), $count)]);
    }

    private function transform(Category $c, int $productsCount): array
    {
        return [
            'id' => $c->id,
            'parent_id' => $c->parent_id,
            'provider_id' => $c->provider_id,
            'provider_external_id' => $c->provider_external_id,
            'slug' => $c->slug,
            'name' => $c->name,
            'description' => $c->description,
            'icon' => $c->icon,
            'image_url' => $c->image_url,
            'sort_order' => $c->sort_order,
            'is_active' => (bool) $c->is_active,
            'show_in_header' => (bool) $c->show_in_header,
            'is_new' => (bool) $c->is_new,
            'products_count' => $productsCount,
            'is_from_provider' => !is_null($c->provider_id),
        ];
    }

    private function generateSlug(string $name): string
    {
        return CategorySlug::make($name);
    }
}
