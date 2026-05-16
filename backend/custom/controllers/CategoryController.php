<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Category;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class CategoryController extends Controller
{
    /**
     * GET /api/categories — дерево активных категорий с количеством товаров.
     *
     * products_count считается по всему поддереву категории: если у «Steam игры»
     * нет напрямую привязанных товаров, но в её подкатегориях лежат 101 товар —
     * вернём 101. Это нужно, чтобы родительские разделы корректно показывали
     * объём ассортимента в каталоге.
     */
    public function index(): JsonResponse
    {
        $categories = Category::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->get();

        // 1. Прямой счётчик товаров по category_id с учётом вариантов (variants_count).
        // Для группового Product (10 регионов) — даёт 10, для одиночного — 1.
        $directCounts = DB::table('products')
            ->whereIn('category_id', $categories->pluck('id'))
            ->where('status', 'active')
            ->groupBy('category_id')
            ->selectRaw('category_id, SUM(variants_count) as cnt')
            ->pluck('cnt', 'category_id')
            ->toArray();
        // Приведём к int (SUM возвращает строку в pdo_mysql)
        $directCounts = array_map('intval', $directCounts);

        // 2. Группируем категории по parent_id — для быстрого обхода детей
        $childrenByParent = $categories->groupBy(fn ($c) => $c->parent_id ?? 0);

        // 3. Рекурсивный подсчёт с мемоизацией: count(c) = direct(c) + sum(count(child))
        $memo = [];
        $compute = function (int $catId) use (&$compute, &$memo, $directCounts, $childrenByParent): int {
            if (isset($memo[$catId])) return $memo[$catId];
            $sum = $directCounts[$catId] ?? 0;
            foreach ($childrenByParent->get($catId, collect()) as $child) {
                $sum += $compute($child->id);
            }
            return $memo[$catId] = $sum;
        };

        return response()->json([
            'data' => $categories->map(fn ($c) => [
                'id' => $c->id,
                'slug' => $c->slug,
                'name' => $c->name,
                'description' => $c->description,
                'icon' => $c->icon,
                'image_url' => $c->image_url,
                'parent_id' => $c->parent_id,
                'show_in_header' => (bool) $c->show_in_header,
                'is_new' => (bool) $c->is_new,
                'products_count' => $compute($c->id),
            ]),
        ]);
    }
}
