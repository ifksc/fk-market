<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\SupportTicket;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админка — обработка обращений в поддержку.
 *
 * GET   /api/admin/support          — список (фильтр ?status=)
 * GET   /api/admin/support/{id}     — одно обращение
 * PATCH /api/admin/support/{id}     — смена статуса + заметка-ответ
 */
class SupportController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $q = SupportTicket::query()
            ->with(['user:id,name,email', 'order:id,public_number'])
            ->orderByDesc('id');

        if ($status = $request->string('status')->toString()) {
            $q->where('status', $status);
        }

        $page = $q->paginate($request->integer('per_page', 50));

        return response()->json([
            'data' => $page->getCollection()->map(fn (SupportTicket $t) => $this->serialize($t)),
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
                'open_total' => SupportTicket::whereIn('status', ['open', 'in_progress'])->count(),
            ],
        ]);
    }

    public function show(SupportTicket $ticket): JsonResponse
    {
        $ticket->load(['user:id,name,email', 'order:id,public_number']);
        return response()->json(['data' => $this->serialize($ticket)]);
    }

    public function update(Request $request, SupportTicket $ticket): JsonResponse
    {
        $data = $request->validate([
            'status' => ['sometimes', 'in:open,in_progress,resolved,rejected'],
            'admin_note' => ['nullable', 'string', 'max:5000'],
        ]);

        if (array_key_exists('admin_note', $data)) {
            $ticket->admin_note = $data['admin_note'];
        }
        if (array_key_exists('status', $data)) {
            $ticket->status = $data['status'];
            // resolved_at проставляем при переводе в финальный статус.
            $ticket->resolved_at = in_array($data['status'], ['resolved', 'rejected'], true)
                ? ($ticket->resolved_at ?? now())
                : null;
        }
        $ticket->save();
        $ticket->load(['user:id,name,email', 'order:id,public_number']);

        return response()->json(['data' => $this->serialize($ticket)]);
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
            'user' => $t->user ? [
                'id' => $t->user->id,
                'name' => $t->user->name,
                'email' => $t->user->email,
            ] : null,
            'created_at' => $t->created_at?->toIso8601String(),
            'resolved_at' => $t->resolved_at?->toIso8601String(),
        ];
    }
}
