<?php

namespace App\Http\Controllers\Api\Me;

use App\Http\Controllers\Controller;
use App\Mail\OrderDeliveredMail;
use App\Models\Order;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\RateLimiter;

/**
 * Личный кабинет покупателя — заказы.
 *
 * Все эндпоинты под auth:sanctum. Возвращаем только заказы, у которых
 * user_id равен текущему пользователю (без подсматривания чужих).
 */
class OrderController extends Controller
{
    /** GET /api/me/orders */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $perPage = min(50, max(5, (int) $request->query('per_page', 20)));

        $q = Order::where('user_id', $user->id)
            ->orderByDesc('created_at')
            ->with([
                'items:id,order_id,product_id,qty,price,total,fulfillment_status,delivered_at',
                'items.product:id,name,slug',
            ]);

        if ($status = $request->query('status')) {
            $q->where('status', $status);
        }

        $page = $q->paginate($perPage);

        return response()->json([
            'data' => $page->items() ? array_map(fn ($o) => $this->serializeOrder($o, false), $page->items()) : [],
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    /** GET /api/me/orders/{public_number} */
    public function show(Request $request, string $publicNumber): JsonResponse
    {
        $order = $this->findOwn($request, $publicNumber);

        // Товары, на которые юзер уже оставил отзыв (учитываем и неодобренные).
        $reviewedProductIds = Review::where('user_id', $request->user()->id)
            ->whereIn('product_id', $order->items->pluck('product_id')->filter()->all())
            ->pluck('product_id')
            ->all();

        return response()->json(['data' => $this->serializeOrder($order, true, $reviewedProductIds)]);
    }

    /**
     * POST /api/me/orders/{public_number}/resend
     * Переотправить письмо с кодами. Rate-limit 3/час на заказ.
     */
    public function resend(Request $request, string $publicNumber): JsonResponse
    {
        $order = $this->findOwn($request, $publicNumber);

        if ($order->status !== 'paid' && $order->status !== 'completed') {
            return response()->json(['message' => 'Письмо доступно только для оплаченных заказов'], 422);
        }

        $rlKey = 'order-resend:' . $order->id;
        if (RateLimiter::tooManyAttempts($rlKey, 3)) {
            $seconds = RateLimiter::availableIn($rlKey);
            return response()->json([
                'message' => "Слишком часто. Подождите {$seconds} сек.",
            ], 429);
        }
        RateLimiter::hit($rlKey, 3600);

        try {
            Mail::send(new OrderDeliveredMail($order->id));
            return response()->json(['data' => ['sent' => true]]);
        } catch (\Throwable $e) {
            Log::warning('Order resend failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);
            return response()->json(['message' => 'Не удалось отправить письмо'], 500);
        }
    }

    // ---------- helpers ----------

    protected function findOwn(Request $request, string $publicNumber): Order
    {
        $order = Order::where('public_number', $publicNumber)
            ->where('user_id', $request->user()->id)
            ->with(['items.product:id,name,slug'])
            ->first();

        if (!$order) {
            abort(404, 'Заказ не найден');
        }
        return $order;
    }

    protected function serializeOrder(Order $order, bool $withItems, array $reviewedProductIds = []): array
    {
        $base = [
            'public_number' => $order->public_number,
            'status' => $order->status,
            'total' => (float) $order->total,
            'currency' => $order->currency,
            'email' => $order->email,
            'created_at' => $order->created_at?->toIso8601String(),
            'paid_at' => $order->paid_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'items_summary' => $order->items->map(fn ($it) => [
                'product_name' => $it->product?->name,
                'qty' => (int) $it->qty,
                'price' => (float) $it->price,
                'fulfillment_status' => $it->fulfillment_status,
            ])->values(),
        ];

        if ($withItems) {
            $base['items'] = $order->items->map(function ($it) use ($reviewedProductIds) {
                $delivered = $it->fulfillment_status === 'delivered';
                $reviewed = $it->product_id && in_array($it->product_id, $reviewedProductIds, true);
                return [
                    'id' => $it->id,
                    'product' => $it->product ? [
                        'id' => $it->product->id,
                        'name' => $it->product->name,
                        'slug' => $it->product->slug,
                    ] : null,
                    'qty' => (int) $it->qty,
                    'price' => (float) $it->price,
                    'total' => (float) $it->total,
                    'fulfillment_status' => $it->fulfillment_status,
                    'delivered_at' => $it->delivered_at?->toIso8601String(),
                    // Купон/код показываем только если выдан
                    'delivered_payload' => $delivered ? (string) ($it->delivered_payload ?? '') : null,
                    // Отзыв: оставлен ли уже и можно ли оставить (товар выдан)
                    'reviewed' => $reviewed,
                    'can_review' => $delivered && (bool) $it->product_id && !$reviewed,
                ];
            })->values();
        }

        return $base;
    }
}
