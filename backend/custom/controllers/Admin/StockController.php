<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\StockItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class StockController extends Controller
{
    /**
     * GET /api/admin/products/{product}/stock
     * Список ключей с маскированием payload (показываем только первые 4 и последние 4 символа).
     */
    public function index(Product $product): JsonResponse
    {
        $items = $product->stockItems()->orderByDesc('id')->get();

        return response()->json([
            'data' => $items->map(function (StockItem $i) {
                $decrypted = $i->payload; // Crypt cast расшифрует
                return [
                    'id' => $i->id,
                    'preview' => self::mask($decrypted),
                    'note' => $i->note,
                    'is_sold' => (bool) $i->is_sold,
                    'sold_at' => $i->sold_at?->toIso8601String(),
                    'sold_order_id' => $i->sold_order_id,
                    'created_at' => $i->created_at?->toIso8601String(),
                ];
            }),
            'meta' => [
                'total' => $items->count(),
                'available' => $items->where('is_sold', false)->count(),
                'sold' => $items->where('is_sold', true)->count(),
            ],
        ]);
    }

    /**
     * POST /api/admin/products/{product}/stock
     * Body: { "payloads": ["KEY-AAAA-BBBB", "user@example:pass", ...], "note": "партия от 23.04" }
     */
    public function store(Request $request, Product $product): JsonResponse
    {
        $data = $request->validate([
            'payloads' => ['required', 'array', 'min:1', 'max:5000'],
            'payloads.*' => ['required', 'string', 'max:2048'],
            'note' => ['nullable', 'string', 'max:500'],
        ]);

        $created = 0;
        $note = $data['note'] ?? null;

        foreach ($data['payloads'] as $payload) {
            $payload = trim($payload);
            if ($payload === '') continue;
            StockItem::create([
                'product_id' => $product->id,
                'payload' => $payload, // Crypt cast зашифрует
                'note' => $note,
            ]);
            $created++;
        }

        // Обновляем кэш остатка
        $product->update([
            'stock_available' => $product->stockItems()->where('is_sold', false)->count(),
        ]);

        return response()->json([
            'data' => [
                'created' => $created,
                'stock_available' => $product->stock_available,
            ],
        ], 201);
    }

    /**
     * DELETE /api/admin/products/{product}/stock/{stockItem}
     * Удалить только непроданный ключ.
     */
    public function destroy(Product $product, StockItem $stockItem): JsonResponse
    {
        if ($stockItem->product_id !== $product->id) {
            return response()->json(['message' => 'Wrong product'], 404);
        }
        if ($stockItem->is_sold) {
            return response()->json(['message' => 'Нельзя удалять проданный ключ'], 422);
        }
        $stockItem->delete();
        $product->update([
            'stock_available' => $product->stockItems()->where('is_sold', false)->count(),
        ]);
        return response()->json(['data' => ['ok' => true]]);
    }

    private static function mask(string $payload): string
    {
        $len = mb_strlen($payload);
        if ($len <= 8) return str_repeat('•', $len);
        return mb_substr($payload, 0, 4) . str_repeat('•', max(4, $len - 8)) . mb_substr($payload, -4);
    }
}
