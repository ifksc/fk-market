<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    /**
     * POST /api/admin/login
     * Принимает email + password, возвращает Sanctum-токен.
     */
    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Простой rate limit: не больше 6 попыток в минуту с одного IP+email
        $key = 'admin-login:' . sha1($request->ip() . '|' . strtolower($data['email']));
        if (RateLimiter::tooManyAttempts($key, 6)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json(
                ['message' => "Too many attempts, try again in {$seconds}s"],
                429,
            );
        }
        RateLimiter::hit($key, 60);

        $user = User::where('email', $data['email'])->first();

        if (!$user || $user->is_blocked || !\Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'Invalid credentials'], 422);
        }

        if ($user->role !== 'admin') {
            return response()->json(['message' => 'Admin access required'], 403);
        }

        RateLimiter::clear($key);

        // Удаляем предыдущие токены этого устройства, создаём новый
        $deviceName = $request->userAgent() ?: 'admin';
        $user->tokens()->where('name', $deviceName)->delete();
        $token = $user->createToken($deviceName, ['admin']);

        $user->update(['last_login_at' => now()]);

        return response()->json([
            'data' => [
                'token' => $token->plainTextToken,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->role,
                ],
            ],
        ]);
    }

    /**
     * GET /api/admin/me — проверка валидности токена + базовый профиль.
     */
    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json([
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->role,
            ],
        ]);
    }

    /**
     * POST /api/admin/logout
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();
        return response()->json(['data' => ['ok' => true]]);
    }
}
