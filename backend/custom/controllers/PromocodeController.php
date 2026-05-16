<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\PromocodeService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * POST /api/promocode/check
 *
 * Превью скидки по промокоду на странице оформления — до создания заказа.
 * Принимает код и позиции корзины, возвращает размер скидки и итог.
 * Фактическое применение промокода к заказу — в CheckoutController.
 */
class PromocodeController extends Controller
{
    public function check(Request $request, PromocodeService $service): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:60'],
            'items' => ['required', 'array', 'min:1'],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.qty' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.params' => ['nullable', 'array'],
        ]);

        $lines = $service->resolveLines($data['items']);
        if (empty($lines)) {
            return response()->json([
                'data' => ['valid' => false, 'discount' => 0, 'total' => 0, 'message' => 'Корзина пуста'],
            ]);
        }

        $subtotal = array_sum(array_column($lines, 'total'));
        $result = $service->evaluate($data['code'], $lines, $request->user()?->id);

        return response()->json([
            'data' => [
                'valid' => $result['ok'],
                'discount' => $result['discount'],
                'total' => round($subtotal - $result['discount'], 2),
                'message' => $result['message'],
            ],
        ]);
    }
}
