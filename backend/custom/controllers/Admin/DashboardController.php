<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Payment;
use App\Models\Product;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * GET /api/admin/dashboard?period=today|7d|30d|all
 *
 * Сводная статистика админ-дашборда: выручка, заказы, средний чек, маржа,
 * заказы по статусам, график выручки за 30 дней, топ товаров, низкий остаток,
 * разбивка по способам оплаты.
 *
 * «Выручка» = оплаченные (paid_at IS NOT NULL), кроме возвратов.
 */
class DashboardController extends Controller
{
    public function stats(Request $request): JsonResponse
    {
        $period = $request->string('period')->toString() ?: '30d';
        $from = match ($period) {
            'today' => now()->startOfDay(),
            '7d' => now()->subDays(7),
            'all' => null,
            default => now()->subDays(30),
        };

        // --- Выручка / заказы / средний чек за период ---
        $paid = fn () => Order::whereNotNull('paid_at')->where('status', '!=', 'refunded');

        $periodPaid = $paid();
        if ($from) {
            $periodPaid->where('paid_at', '>=', $from);
        }
        $revenue = (float) (clone $periodPaid)->sum('total');
        $orders = (clone $periodPaid)->count();
        $avgCheck = $orders > 0 ? round($revenue / $orders, 2) : 0.0;

        // --- Сегодня ---
        $revenueToday = (float) $paid()->where('paid_at', '>=', now()->startOfDay())->sum('total');
        $ordersToday = $paid()->where('paid_at', '>=', now()->startOfDay())->count();

        // --- Маржа: выручка позиций минус закупка (price_in * qty) ---
        $marginQuery = OrderItem::join('orders', 'orders.id', '=', 'order_items.order_id')
            ->whereNotNull('orders.paid_at')
            ->where('orders.status', '!=', 'refunded');
        if ($from) {
            $marginQuery->where('orders.paid_at', '>=', $from);
        }
        $margin = (float) $marginQuery->sum(
            DB::raw('order_items.total - COALESCE(order_items.price_in, 0) * order_items.qty')
        );

        // --- Заказы по статусам (по дате создания за период) ---
        $statusQuery = Order::query();
        if ($from) {
            $statusQuery->where('created_at', '>=', $from);
        }
        $byStatus = $statusQuery->selectRaw('status, COUNT(*) as c')
            ->groupBy('status')
            ->pluck('c', 'status');

        // --- График выручки по дням за 30 дней ---
        $chartFrom = now()->subDays(29)->startOfDay();
        $chartRows = Order::whereNotNull('paid_at')
            ->where('status', '!=', 'refunded')
            ->where('paid_at', '>=', $chartFrom)
            ->selectRaw('DATE(paid_at) as d, SUM(total) as rev, COUNT(*) as cnt')
            ->groupBy('d')
            ->get()
            ->keyBy('d');
        $chart = [];
        for ($i = 29; $i >= 0; $i--) {
            $day = now()->subDays($i)->toDateString();
            $row = $chartRows->get($day);
            $chart[] = [
                'date' => $day,
                'revenue' => round((float) ($row->rev ?? 0), 2),
                'orders' => (int) ($row->cnt ?? 0),
            ];
        }

        // --- Топ-5 товаров по продажам ---
        $topProducts = Product::orderByDesc('sales_count')
            ->limit(5)
            ->get(['id', 'name', 'sales_count'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'sales_count' => $p->sales_count,
            ]);

        // --- Низкий остаток (товары с автовыдачей из склада) ---
        $lowStock = Product::where('fulfillment_mode', 'stock')
            ->where('status', 'active')
            ->where('stock_available', '<=', 5)
            ->orderBy('stock_available')
            ->limit(10)
            ->get(['id', 'name', 'stock_available'])
            ->map(fn (Product $p) => [
                'id' => $p->id,
                'name' => $p->name,
                'stock' => (int) $p->stock_available,
            ]);

        // --- Разбивка по способам оплаты (канонический payment заказа) ---
        $payQuery = Payment::join('orders', 'orders.payment_id', '=', 'payments.id')
            ->whereNotNull('orders.paid_at')
            ->where('orders.status', '!=', 'refunded');
        if ($from) {
            $payQuery->where('orders.paid_at', '>=', $from);
        }
        $paymentMethods = $payQuery
            ->selectRaw('payments.method as method, COUNT(*) as orders, SUM(orders.total) as revenue')
            ->groupBy('payments.method')
            ->orderByDesc('revenue')
            ->get()
            ->map(fn ($r) => [
                'method' => $r->method ?: 'не указано',
                'orders' => (int) $r->orders,
                'revenue' => round((float) $r->revenue, 2),
            ]);

        return response()->json([
            'data' => [
                'period' => $period,
                'revenue' => round($revenue, 2),
                'orders' => $orders,
                'avg_check' => $avgCheck,
                'margin' => round($margin, 2),
                'revenue_today' => round($revenueToday, 2),
                'orders_today' => $ordersToday,
                'products_total' => Product::count(),
                'by_status' => $byStatus,
                'chart' => $chart,
                'top_products' => $topProducts,
                'low_stock' => $lowStock,
                'payment_methods' => $paymentMethods,
            ],
        ]);
    }
}
