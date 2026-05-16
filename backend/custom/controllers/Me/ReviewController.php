<?php

namespace App\Http\Controllers\Api\Me;

use App\Http\Controllers\Controller;
use App\Models\OrderItem;
use App\Models\Review;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/me/reviews — отзыв покупателя на купленный товар.
 *
 * Премодерация: отзыв создаётся скрытым (`is_approved=false`), на сайте
 * появляется после одобрения админом. Один отзыв на товар от пользователя.
 */
class ReviewController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'product_id' => ['required', 'integer', 'exists:products,id'],
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'text' => ['nullable', 'string', 'max:2000'],
        ]);

        // «Только после покупки»: позиция этого товара в оплаченном заказе юзера.
        $orderItem = OrderItem::join('orders', 'orders.id', '=', 'order_items.order_id')
            ->where('orders.user_id', $user->id)
            ->where('order_items.product_id', $data['product_id'])
            ->whereNotNull('orders.paid_at')
            ->orderByDesc('orders.id')
            ->select('order_items.order_id')
            ->first();

        if (!$orderItem) {
            return response()->json([
                'message' => 'Отзыв можно оставить только на купленный товар',
            ], 422);
        }

        // Один отзыв на товар от пользователя (учитываем и неодобренные).
        if (Review::where('product_id', $data['product_id'])->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Вы уже оставили отзыв на этот товар'], 422);
        }

        Review::create([
            'product_id' => $data['product_id'],
            'user_id' => $user->id,
            'order_id' => $orderItem->order_id,
            'rating' => $data['rating'],
            'text' => $data['text'] ?? null,
            'is_approved' => false, // премодерация
        ]);

        // rating пересчитываем только по одобренным — новый отзыв пока не влияет.
        return response()->json([
            'data' => ['pending' => true],
        ], 201);
    }
}
