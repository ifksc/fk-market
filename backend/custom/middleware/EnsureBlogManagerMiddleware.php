<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Middleware для блоговых эндпоинтов /api/admin/blog/* (а также /me, /logout).
 * Пускает администраторов И журналистов: журналист управляет только блогом,
 * остальная админка остаётся под EnsureAdminMiddleware (role = 'admin').
 * Требует:
 *   1) аутентификацию через Sanctum (auth:sanctum в группе)
 *   2) role ∈ {admin, journalist}
 *   3) пользователь не заблокирован
 */
class EnsureBlogManagerMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($user->is_blocked) {
            return response()->json(['message' => 'Account blocked'], 403);
        }

        if (!in_array($user->role, ['admin', 'journalist'], true)) {
            return response()->json(['message' => 'Blog access required'], 403);
        }

        return $next($request);
    }
}
