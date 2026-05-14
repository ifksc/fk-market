<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Middleware для эндпоинтов /api/admin/*.
 * Требует, чтобы:
 *   1) запрос был аутентифицирован через Sanctum (auth:sanctum в группе)
 *   2) пользователь имел role = 'admin'
 *   3) пользователь не был заблокирован
 */
class EnsureAdminMiddleware
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

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Admin access required'], 403);
        }

        return $next($request);
    }
}
