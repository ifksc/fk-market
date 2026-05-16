<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Админка: пользователи и их покупки.
 *
 * GET   /api/admin/users           — список (фильтры: q, role, sort)
 * GET   /api/admin/users/{id}      — карточка + заказы
 * PATCH /api/admin/users/{id}      — блокировка / смена роли
 */
class UserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $perPage = min(100, max(10, (int) $request->query('per_page', 30)));

        $q = User::query()
            ->withCount('orders')
            ->withSum(['orders as orders_total_sum' => function ($q) {
                $q->whereIn('status', ['paid', 'completed']);
            }], 'total');

        if ($search = $request->string('q')->toString()) {
            $q->where(function ($qq) use ($search) {
                $qq->where('email', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($role = $request->string('role')->toString()) {
            $q->where('role', $role);
        }

        match ($request->string('sort')->toString() ?: 'created_desc') {
            'email'         => $q->orderBy('email'),
            'orders_desc'   => $q->orderByDesc('orders_count'),
            'spent_desc'    => $q->orderByDesc('orders_total_sum'),
            'created_asc'   => $q->orderBy('created_at'),
            default         => $q->orderByDesc('created_at'),
        };

        $page = $q->paginate($perPage);

        return response()->json([
            'data' => $page->getCollection()->map(fn ($u) => $this->serializeList($u)),
            'meta' => [
                'total' => $page->total(),
                'per_page' => $page->perPage(),
                'current_page' => $page->currentPage(),
                'last_page' => $page->lastPage(),
            ],
        ]);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $user = User::query()
            ->withCount('orders')
            ->withSum(['orders as orders_total_sum' => function ($q) {
                $q->whereIn('status', ['paid', 'completed']);
            }], 'total')
            ->findOrFail($id);

        $orders = Order::where('user_id', $user->id)
            ->with(['items:id,order_id,product_id,qty,price,total,fulfillment_status', 'items.product:id,name,slug'])
            ->orderByDesc('created_at')
            ->limit(100)
            ->get();

        return response()->json([
            'data' => array_merge($this->serializeList($user), [
                'phone' => $user->phone,
                'is_blocked' => (bool) $user->is_blocked,
                'last_login_at' => $user->last_login_at?->toIso8601String(),
                'last_login_ip' => $user->last_login_ip,
                'orders' => $orders->map(fn ($o) => [
                    'public_number' => $o->public_number,
                    'status' => $o->status,
                    'total' => (float) $o->total,
                    'currency' => $o->currency,
                    'created_at' => $o->created_at?->toIso8601String(),
                    'paid_at' => $o->paid_at?->toIso8601String(),
                    'items' => $o->items->map(fn ($it) => [
                        'product_name' => $it->product?->name,
                        'product_slug' => $it->product?->slug,
                        'qty' => (int) $it->qty,
                        'price' => (float) $it->price,
                        'fulfillment_status' => $it->fulfillment_status,
                    ])->values(),
                ])->values(),
            ]),
        ]);
    }

    /**
     * PATCH /api/admin/users/{id} — блокировка и/или смена роли.
     * Защита: нельзя заблокировать себя или снять с себя роль админа.
     * Каждое изменение пишется в audit_logs.
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = User::findOrFail($id);
        $data = $request->validate([
            'is_blocked' => ['sometimes', 'boolean'],
            'role' => ['sometimes', 'in:customer,admin,seller,moderator'],
        ]);

        $isSelf = $user->id === $request->user()->id;
        if ($isSelf && array_key_exists('is_blocked', $data) && $data['is_blocked']) {
            return response()->json(['message' => 'Нельзя заблокировать самого себя'], 422);
        }
        if ($isSelf && array_key_exists('role', $data) && $data['role'] !== 'admin') {
            return response()->json(['message' => 'Нельзя снять с себя роль администратора'], 422);
        }

        $changes = [];
        if (array_key_exists('is_blocked', $data) && (bool) $user->is_blocked !== (bool) $data['is_blocked']) {
            $changes['is_blocked'] = ['from' => (bool) $user->is_blocked, 'to' => (bool) $data['is_blocked']];
        }
        if (array_key_exists('role', $data) && $user->role !== $data['role']) {
            $changes['role'] = ['from' => $user->role, 'to' => $data['role']];
        }

        if (!empty($changes)) {
            $user->fill($data)->save();

            AuditLog::create([
                'user_id' => $request->user()->id,
                'action' => 'user.update',
                'subject_type' => 'User',
                'subject_id' => $user->id,
                'payload' => $changes,
                'ip' => $request->ip(),
                'user_agent' => mb_substr((string) $request->userAgent(), 0, 500),
            ]);

            // Заблокированному юзеру — отзываем все токены (выкидываем сессии).
            if (isset($changes['is_blocked']) && $changes['is_blocked']['to'] === true) {
                $user->tokens()->delete();
            }
        }

        return response()->json(['data' => $this->serializeList($user->refresh())]);
    }

    protected function serializeList(User $u): array
    {
        return [
            'id' => $u->id,
            'email' => $u->email,
            'name' => $u->name,
            'role' => $u->role,
            'email_verified' => $u->email_verified_at !== null,
            'is_blocked' => (bool) $u->is_blocked,
            'balance' => (float) $u->balance,
            'orders_count' => (int) ($u->orders_count ?? 0),
            'orders_total_sum' => (float) ($u->orders_total_sum ?? 0),
            'created_at' => $u->created_at?->toIso8601String(),
            'last_login_at' => $u->last_login_at?->toIso8601String(),
        ];
    }
}
