<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Jobs\FulfillOrderJob;
use App\Mail\OrderDeliveredMail;
use App\Models\Order;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class OrderController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = Order::query()->withCount('items');

        if ($search = $request->string('q')->toString()) {
            $q->where(function ($qq) use ($search) {
                $qq->where('public_number', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%");
            });
        }
        if ($status = $request->string('status')->toString()) $q->where('status', $status);
        if ($from = $request->string('from')->toString()) $q->whereDate('created_at', '>=', $from);
        if ($to = $request->string('to')->toString()) $q->whereDate('created_at', '<=', $to);

        match ($request->string('sort')->toString() ?: 'created_desc') {
            'created_asc' => $q->orderBy('created_at'),
            'total_desc' => $q->orderByDesc('total'),
            default => $q->orderByDesc('created_at'),
        };

        $orders = $q->paginate($request->integer('per_page', 30));

        return response()->json([
            'data' => $orders->getCollection()->map(fn (Order $o) => [
                'id' => $o->id,
                'public_number' => $o->public_number,
                'email' => $o->email,
                'total' => (float) $o->total,
                'status' => $o->status,
                'items_count' => $o->items_count,
                'created_at' => $o->created_at?->toIso8601String(),
                'paid_at' => $o->paid_at?->toIso8601String(),
                'completed_at' => $o->completed_at?->toIso8601String(),
            ]),
            'meta' => [
                'total' => $orders->total(),
                'per_page' => $orders->perPage(),
                'current_page' => $orders->currentPage(),
                'last_page' => $orders->lastPage(),
            ],
        ]);
    }

    public function show(Order $order): JsonResponse
    {
        $order->load(['items.product:id,name,slug', 'payments', 'user:id,email,name']);

        return response()->json([
            'data' => [
                'id' => $order->id,
                'public_number' => $order->public_number,
                'user' => $order->user ? ['id' => $order->user->id, 'email' => $order->user->email, 'name' => $order->user->name] : null,
                'email' => $order->email,
                'phone' => $order->phone,
                'currency' => $order->currency,
                'subtotal' => (float) $order->subtotal,
                'discount' => (float) $order->discount,
                'total' => (float) $order->total,
                'status' => $order->status,
                'ip' => $order->ip,
                'paid_at' => $order->paid_at?->toIso8601String(),
                'completed_at' => $order->completed_at?->toIso8601String(),
                'created_at' => $order->created_at?->toIso8601String(),
                'items' => $order->items->map(fn ($i) => [
                    'id' => $i->id,
                    'product_id' => $i->product_id,
                    'product_name' => $i->product?->name,
                    'product_slug' => $i->product?->slug,
                    'qty' => $i->qty,
                    'price' => (float) $i->price,
                    'total' => (float) $i->total,
                    'params' => $i->params,
                    'fulfillment_status' => $i->fulfillment_status,
                    'delivered_payload' => $i->fulfillment_status === 'delivered' ? $i->delivered_payload : null,
                    'delivered_at' => $i->delivered_at?->toIso8601String(),
                ]),
                'payments' => $order->payments->map(fn ($p) => [
                    'id' => $p->id,
                    'provider' => $p->provider,
                    'method' => $p->method,
                    'amount' => (float) $p->amount,
                    'status' => $p->status,
                    'provider_payment_id' => $p->provider_payment_id,
                    'paid_at' => $p->paid_at?->toIso8601String(),
                ]),
            ],
        ]);
    }

    public function cancel(Order $order): JsonResponse
    {
        if (in_array($order->status, ['completed', 'refunded', 'cancelled'])) {
            return response()->json(['message' => "Нельзя отменить заказ со статусом {$order->status}"], 422);
        }
        $order->update(['status' => 'cancelled']);
        return response()->json(['data' => ['ok' => true, 'status' => $order->status]]);
    }

    public function refund(Order $order): JsonResponse
    {
        // Возврат имеет смысл только для оплаченных заказов; pending денег не
        // содержит, cancelled/refunded уже финальны.
        if (!in_array($order->status, ['paid', 'fulfilling', 'completed'], true)) {
            return response()->json(['message' => "Нельзя оформить возврат для заказа со статусом {$order->status}"], 422);
        }
        $order->update(['status' => 'refunded']);
        if ($order->payment) {
            $order->payment->update(['status' => 'refunded']);
        }
        return response()->json(['data' => ['ok' => true, 'status' => $order->status]]);
    }

    public function redeliver(Order $order): JsonResponse
    {
        try {
            Mail::to($order->email)->send(new OrderDeliveredMail($order->id));
            return response()->json(['data' => ['ok' => true, 'sent_to' => $order->email]]);
        } catch (\Throwable $e) {
            return response()->json(['message' => 'Ошибка отправки: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Перезапустить выдачу (например, если упало в failed).
     */
    public function refulfill(Order $order): JsonResponse
    {
        if ($order->status !== 'paid' && $order->status !== 'fulfilling') {
            return response()->json(['message' => "Можно переотправить только оплаченный заказ"], 422);
        }
        FulfillOrderJob::dispatch($order->id);
        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /admin/orders/{order:id}/items/{item:id}/check-withdrawal
     * Ручная проверка статуса withdrawal-заказа у FK. Дёргает ту же логику,
     * что и cron-команда withdrawals:check-pending, но для одного item.
     */
    public function checkWithdrawal(Order $order, \App\Models\OrderItem $item): JsonResponse
    {
        if ($item->order_id !== $order->id) {
            return response()->json(['message' => 'Item не принадлежит заказу'], 404);
        }
        if (!$item->provider_order_id) {
            return response()->json(['message' => 'У позиции нет provider_order_id'], 422);
        }

        \Illuminate\Support\Facades\Artisan::call('withdrawals:check-pending');
        $item->refresh();
        return response()->json([
            'data' => [
                'fulfillment_status' => $item->fulfillment_status,
                'output' => \Illuminate\Support\Facades\Artisan::output(),
            ],
        ]);
    }
}
