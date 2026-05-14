<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\FulfillmentTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class QueueController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = FulfillmentTask::query()
            ->with(['orderItem.order:id,public_number,email', 'orderItem.product:id,name,slug', 'provider:id,code,name', 'assignee:id,name,email']);

        $filter = $request->string('filter')->toString() ?: 'open';
        match ($filter) {
            'open' => $q->whereIn('status', ['queued', 'in_progress']),
            'mine' => $q->where('assignee_id', $request->user()->id)->whereIn('status', ['queued', 'in_progress']),
            'overdue' => $q->whereIn('status', ['queued', 'in_progress'])->where('deadline_at', '<', now()),
            'done' => $q->where('status', 'done'),
            'failed' => $q->whereIn('status', ['failed', 'cancelled']),
            'all' => null,
            default => $q->whereIn('status', ['queued', 'in_progress']),
        };

        if ($mode = $request->string('mode')->toString()) $q->where('mode', $mode);

        $tasks = $q->orderByRaw('CASE WHEN deadline_at IS NULL THEN 1 ELSE 0 END, deadline_at')->paginate($request->integer('per_page', 30));

        return response()->json([
            'data' => $tasks->getCollection()->map(fn (FulfillmentTask $t) => [
                'id' => $t->id,
                'mode' => $t->mode,
                'status' => $t->status,
                'order_item_id' => $t->order_item_id,
                'order' => $t->orderItem?->order ? [
                    'id' => $t->orderItem->order->id,
                    'public_number' => $t->orderItem->order->public_number,
                    'email' => $t->orderItem->order->email,
                ] : null,
                'product' => $t->orderItem?->product ? [
                    'id' => $t->orderItem->product->id,
                    'name' => $t->orderItem->product->name,
                    'slug' => $t->orderItem->product->slug,
                ] : null,
                'provider' => $t->provider ? ['code' => $t->provider->code, 'name' => $t->provider->name] : null,
                'input_params' => $t->input_params,
                'assignee' => $t->assignee ? ['id' => $t->assignee->id, 'name' => $t->assignee->name, 'email' => $t->assignee->email] : null,
                'retries' => $t->retries,
                'error_text' => $t->error_text,
                'deadline_at' => $t->deadline_at?->toIso8601String(),
                'is_overdue' => $t->isOverdue(),
                'started_at' => $t->started_at?->toIso8601String(),
                'finished_at' => $t->finished_at?->toIso8601String(),
                'created_at' => $t->created_at?->toIso8601String(),
            ]),
            'meta' => [
                'total' => $tasks->total(),
                'per_page' => $tasks->perPage(),
                'current_page' => $tasks->currentPage(),
                'last_page' => $tasks->lastPage(),
                'open_count' => FulfillmentTask::whereIn('status', ['queued', 'in_progress'])->count(),
                'overdue_count' => FulfillmentTask::whereIn('status', ['queued', 'in_progress'])->where('deadline_at', '<', now())->count(),
            ],
        ]);
    }

    public function claim(Request $request, FulfillmentTask $task): JsonResponse
    {
        if (!in_array($task->status, ['queued', 'in_progress'])) {
            return response()->json(['message' => 'Задача уже завершена'], 422);
        }
        $task->update([
            'assignee_id' => $request->user()->id,
            'status' => 'in_progress',
            'started_at' => $task->started_at ?? now(),
        ]);
        return response()->json(['data' => ['ok' => true]]);
    }

    public function complete(Request $request, FulfillmentTask $task): JsonResponse
    {
        $data = $request->validate([
            'result_payload' => ['nullable', 'string', 'max:5000'],
            'comment' => ['nullable', 'string', 'max:1000'],
        ]);

        if ($task->status === 'done') {
            return response()->json(['message' => 'Уже выполнена'], 422);
        }

        $task->update([
            'status' => 'done',
            'result' => array_filter([
                'payload' => $data['result_payload'] ?? null,
                'comment' => $data['comment'] ?? null,
                'completed_by' => $request->user()->email,
            ]),
            'finished_at' => now(),
        ]);

        // Обновляем order_item
        if ($task->orderItem) {
            $payload = $data['result_payload'] ?? '✓ Выполнено вручную';
            $task->orderItem->update([
                'fulfillment_status' => 'delivered',
                'delivered_payload' => $payload,
                'delivered_at' => now(),
            ]);

            // Если все позиции заказа выданы — переводим заказ в completed
            $order = $task->orderItem->order;
            if ($order) {
                $allDelivered = $order->items()->where('fulfillment_status', '!=', 'delivered')->doesntExist();
                if ($allDelivered) {
                    $order->update(['status' => 'completed', 'completed_at' => now()]);
                }
            }
        }

        return response()->json(['data' => ['ok' => true]]);
    }

    public function cancel(Request $request, FulfillmentTask $task): JsonResponse
    {
        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:500'],
        ]);
        $task->update([
            'status' => 'cancelled',
            'error_text' => $data['reason'] ?? 'Отменено админом',
            'finished_at' => now(),
        ]);
        if ($task->orderItem) {
            $task->orderItem->update(['fulfillment_status' => 'failed']);
        }
        return response()->json(['data' => ['ok' => true]]);
    }
}
