<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * GET /api/admin/finance — постраничный отчёт маржи по операциям.
 *
 * Каждая строка — одна позиция оплаченного заказа: продажа (price), закупка
 * (price_in), маржа. Сводка наверху — суммы за период (формула совпадает с
 * «Маржа» дашборда: SUM(order_items.total − COALESCE(price_in,0) * qty)).
 *
 * Параметры:
 *   period = today | 7d | 30d | all  (по умолчанию 30d, как на дашборде)
 *   from, to — ISO-даты (перекрывают period для тонкого фильтра)
 *   q — поиск по номеру заказа / названию товара
 *   sort = date_desc (default) | date_asc | margin_desc | margin_asc
 *   page, per_page
 */
class FinanceController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        // --- Период ---
        $period = $request->string('period')->toString() ?: '30d';
        $from = match ($period) {
            'today' => now()->startOfDay(),
            '7d' => now()->subDays(7),
            'all' => null,
            default => now()->subDays(30),
        };
        if ($request->filled('from')) {
            $from = Carbon::parse($request->string('from')->toString());
        }
        $to = $request->filled('to')
            ? Carbon::parse($request->string('to')->toString())
            : null;

        // --- Базовый запрос (joins, paid orders, фильтры) ---
        // Формула маржи строго как в DashboardController::stats — чтобы сумма
        // «Маржа» дашборда совпадала с итогом этого отчёта за тот же период.
        $base = OrderItem::query()
            ->join('orders', 'orders.id', '=', 'order_items.order_id')
            ->leftJoin('products', 'products.id', '=', 'order_items.product_id')
            ->whereNotNull('orders.paid_at')
            ->where('orders.status', '!=', 'refunded');

        if ($from) $base->where('orders.paid_at', '>=', $from);
        if ($to) $base->where('orders.paid_at', '<=', $to);

        if ($q = $request->string('q')->toString()) {
            $base->where(function ($qq) use ($q) {
                $qq->where('orders.public_number', 'like', "%{$q}%")
                    ->orWhere('products.name', 'like', "%{$q}%");
            });
        }

        // --- Сортировка ---
        // Маржа считается выражением — сортируем по нему через DB::raw.
        $marginExpr = DB::raw('(order_items.total - COALESCE(order_items.price_in, 0) * order_items.qty)');
        match ($request->string('sort')->toString()) {
            'margin_desc' => $base->orderByDesc($marginExpr),
            'margin_asc' => $base->orderBy($marginExpr),
            'date_asc' => $base->orderBy('orders.paid_at'),
            default => $base->orderByDesc('orders.paid_at'),
        };

        // --- Выборка ---
        $select = [
            'order_items.id',
            'order_items.order_id',
            'order_items.product_id',
            'order_items.qty',
            'order_items.price',
            'order_items.price_in',
            'order_items.total',
            'order_items.params',
            'orders.public_number as order_public_number',
            'orders.status as order_status',
            'orders.paid_at',
            'products.name as product_name',
            'products.slug as product_slug',
        ];
        $items = (clone $base)
            ->select($select)
            ->paginate($request->integer('per_page', 30));

        // --- Сводка (за весь период, по тем же фильтрам) ---
        $sum = (clone $base)->selectRaw(
            'COALESCE(SUM(order_items.total), 0) as revenue, '
            . 'COALESCE(SUM(COALESCE(order_items.price_in, 0) * order_items.qty), 0) as cost, '
            . 'COUNT(*) as items_count'
        )->first();
        $revenue = (float) ($sum->revenue ?? 0);
        $cost = (float) ($sum->cost ?? 0);
        $margin = $revenue - $cost;
        $marginPct = $revenue > 0 ? round($margin / $revenue * 100, 2) : 0.0;

        return response()->json([
            'data' => $items->getCollection()->map(fn ($it) => $this->transformItem($it))->values(),
            'meta' => [
                'total' => $items->total(),
                'per_page' => $items->perPage(),
                'current_page' => $items->currentPage(),
                'last_page' => $items->lastPage(),
            ],
            'summary' => [
                'revenue' => round($revenue, 2),
                'cost' => round($cost, 2),
                'margin' => round($margin, 2),
                'margin_pct' => $marginPct,
                'items_count' => (int) ($sum->items_count ?? 0),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function transformItem(OrderItem $it): array
    {
        // params хранится как json/array — выбранный вариант лежит под ключом
        // 'variant' (см. ProductBuyBox/ProductGrouper).
        $params = $it->params;
        if (is_string($params)) {
            $decoded = json_decode($params, true);
            $params = is_array($decoded) ? $decoded : [];
        }
        $variantLabel = is_array($params) && isset($params['variant']) && is_string($params['variant'])
            ? $params['variant']
            : null;

        $qty = (int) $it->qty;
        $priceIn = $it->price_in !== null ? (float) $it->price_in : 0.0;
        $total = (float) $it->total;
        $cost = $priceIn * $qty;
        $margin = $total - $cost;

        return [
            'order_id' => (int) $it->order_id,
            'order_public_number' => $it->getAttribute('order_public_number'),
            'order_status' => $it->getAttribute('order_status'),
            'paid_at' => $it->getAttribute('paid_at')
                ? Carbon::parse((string) $it->getAttribute('paid_at'))->toIso8601String()
                : null,
            'product' => [
                'id' => (int) $it->product_id,
                'name' => $it->getAttribute('product_name'),
                'slug' => $it->getAttribute('product_slug'),
            ],
            'variant_label' => $variantLabel,
            'qty' => $qty,
            'price' => (float) $it->price,
            'price_in' => $priceIn,
            'total' => $total,
            'cost' => round($cost, 2),
            'margin' => round($margin, 2),
            'margin_pct' => $total > 0 ? round($margin / $total * 100, 2) : 0.0,
        ];
    }
}
