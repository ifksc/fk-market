<?php

namespace App\Http\Controllers\Api\Me;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Поддержка — обращения покупателя (для залогиненных).
 *
 * GET  /api/me/support        — список своих обращений
 * GET  /api/me/support/{id}   — одно обращение
 * POST /api/me/support        — создать обращение (опц. привязка к заказу)
 */
class SupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $tickets = SupportTicket::where('user_id', $request->user()->id)
            ->with('order:id,public_number')
            ->orderByDesc('id')
            ->get();

        return response()->json([
            'data' => $tickets->map(fn (SupportTicket $t) => $this->serialize($t)),
        ]);
    }

    public function show(Request $request, SupportTicket $ticket): JsonResponse
    {
        if ($ticket->user_id !== $request->user()->id) {
            abort(404, 'Обращение не найдено');
        }
        $ticket->load('order:id,public_number');
        return response()->json(['data' => $this->serialize($ticket)]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'kind' => ['required', 'in:code_not_working,wrong_item,other'],
            'subject' => ['required', 'string', 'max:200'],
            'body' => ['required', 'string', 'max:5000'],
            // public_number заказа — опционально (для привязки обращения к заказу)
            'order' => ['nullable', 'string', 'max:32'],
        ]);

        $orderId = null;
        if (!empty($data['order'])) {
            $order = Order::where('public_number', $data['order'])
                ->where('user_id', $user->id)
                ->first();
            if (!$order) {
                return response()->json(['message' => 'Заказ не найден среди ваших'], 422);
            }
            $orderId = $order->id;
        }

        $ticket = SupportTicket::create([
            'user_id' => $user->id,
            'order_id' => $orderId,
            'kind' => $data['kind'],
            'subject' => $data['subject'],
            'body' => $data['body'],
            'status' => 'open',
        ]);
        $ticket->load('order:id,public_number');

        return response()->json(['data' => $this->serialize($ticket)], 201);
    }

    /** @return array<string, mixed> */
    private function serialize(SupportTicket $t): array
    {
        return [
            'id' => $t->id,
            'kind' => $t->kind,
            'subject' => $t->subject,
            'body' => $t->body,
            'status' => $t->status,
            'admin_note' => $t->admin_note,
            'order_number' => $t->order?->public_number,
            'created_at' => $t->created_at?->toIso8601String(),
            'resolved_at' => $t->resolved_at?->toIso8601String(),
        ];
    }
}
