<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResetPasswordMail;
use App\Mail\VerifyEmailMail;
use App\Models\EmailVerification;
use App\Models\Order;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

/**
 * Авторизация покупателей.
 *
 * Эндпоинты:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   POST /api/auth/logout
 *   GET  /api/auth/me
 *
 * Логин универсальный (и для customer, и для admin) — middleware дальше отсекает по role.
 * Старый /api/admin/login оставлен как deprecated алиас, чтобы не ломать админский фронт.
 */
class AuthController extends Controller
{
    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'max:120', 'confirmed'],
            'name' => ['nullable', 'string', 'max:120'],
        ]);

        $user = DB::transaction(function () use ($data, $request) {
            $user = User::create([
                'email' => $data['email'],
                'password' => $data['password'], // cast='hashed' сам bcrypt'нёт
                'name' => $data['name'] ?? null,
                'role' => 'customer',
            ]);

            // Сразу создаём токен подтверждения email (TTL 24ч) и отправляем письмо.
            // При MAIL_MAILER=log письмо пишется в storage/logs/laravel.log,
            // что удобно для разработки/диагностики до подключения боевого SMTP.
            $verification = EmailVerification::issue($user);
            $this->safeSendMail(new VerifyEmailMail($verification->id), 'verify-email');

            return $user;
        });

        // Сразу логиним — токен на устройство.
        $token = $this->issueToken($user, $request);

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => $this->serializeUser($user),
            ],
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Rate limit: 5 попыток / мин на пару (IP, email).
        $key = 'login:' . sha1($request->ip() . '|' . strtolower($data['email']));
        if (RateLimiter::tooManyAttempts($key, 5)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'message' => "Слишком много попыток. Попробуйте через {$seconds} сек.",
            ], 429);
        }
        RateLimiter::hit($key, 60);

        $user = User::where('email', $data['email'])->first();
        if (!$user || !Hash::check($data['password'], (string) $user->password)) {
            return response()->json(['message' => 'Неверный email или пароль'], 422);
        }

        if ($user->is_blocked) {
            return response()->json(['message' => 'Аккаунт заблокирован'], 403);
        }

        RateLimiter::clear($key);

        $token = $this->issueToken($user, $request);

        // Привязка гостевых заказов — если email уже подтверждён.
        // Для непoдтверждённого email привязка произойдёт позже при verify.
        if ($user->isEmailVerified()) {
            $this->linkGuestOrders($user);
        }

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => $this->serializeUser($user),
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()?->delete();
        return response()->json(['data' => ['ok' => true]]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();
        return response()->json(['data' => $this->serializeUser($user)]);
    }

    /**
     * PATCH /api/me
     * Обновить имя/телефон. Email — отдельным эндпоинтом (changeEmail),
     * пароль — отдельным эндпоинтом (changePassword).
     */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'name' => ['nullable', 'string', 'max:120'],
            'phone' => ['nullable', 'string', 'max:32'],
        ]);
        $user->fill($data)->save();
        return response()->json(['data' => $this->serializeUser($user->refresh())]);
    }

    /**
     * POST /api/me/change-password
     * Body: { current_password, password, password_confirmation }
     */
    public function changePassword(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:120', 'confirmed', 'different:current_password'],
        ]);

        if (!Hash::check($data['current_password'], (string) $user->password)) {
            return response()->json(['message' => 'Неверный текущий пароль'], 422);
        }

        $user->password = $data['password']; // cast='hashed'
        $user->save();

        // Чистим все токены кроме текущего — выкидываем чужие сессии.
        $currentId = $user->currentAccessToken()?->id;
        $user->tokens()->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))->delete();

        return response()->json(['data' => ['ok' => true]]);
    }

    /**
     * POST /api/me/change-email
     * Body: { new_email, password }
     *
     * Шлёт на NEW email письмо с кодом. Юзер вводит код на /verify-email (тот же экран),
     * AuthController::verifyEmail() видит EmailVerification.new_email и подменяет users.email.
     * До подтверждения текущий email остаётся.
     */
    public function changeEmail(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'new_email' => ['required', 'email', 'max:190', 'different:current_email', Rule::unique('users', 'email')],
            'password' => ['required', 'string'],
        ], [], ['current_email' => 'текущий email']);

        if (!$user->isEmailVerified()) {
            return response()->json(['message' => 'Сначала подтвердите текущий email'], 422);
        }
        if (!Hash::check($data['password'], (string) $user->password)) {
            return response()->json(['message' => 'Неверный пароль'], 422);
        }

        $verification = EmailVerification::issue($user, $data['new_email']);
        $this->safeSendMail(new VerifyEmailMail($verification->id), 'change-email');

        return response()->json([
            'data' => [
                'pending_email' => $data['new_email'],
                'sent' => true,
            ],
        ]);
    }

    /**
     * POST /api/auth/verify-email
     * Body: { code: string (6 digit) }
     *
     * Активирует email пользователя по 6-значному коду из письма.
     * Требует Bearer-токен Sanctum (user должен быть залогинен — после register
     * мы сразу выдаём токен). Это убирает риск, что чужой код подойдёт чужому юзеру
     * (привязка по user_id обязательна) и не нужно слать email в теле запроса.
     */
    public function verifyEmail(Request $request): JsonResponse
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'regex:/^\d{6}$/'],
        ]);

        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        if ($user->isEmailVerified()) {
            return response()->json([
                'data' => ['user' => $this->serializeUser($user), 'already_verified' => true],
            ]);
        }

        // Rate-limit по user_id: 10 неудачных попыток за 10 минут.
        $rlKey = 'verify-code:' . $user->id;
        if (RateLimiter::tooManyAttempts($rlKey, 10)) {
            $seconds = RateLimiter::availableIn($rlKey);
            return response()->json([
                'message' => "Слишком много попыток. Попробуйте через {$seconds} сек.",
            ], 429);
        }

        // Берём самую свежую неиспользованную запись с этим кодом.
        $verification = EmailVerification::where('user_id', $user->id)
            ->where('code', $data['code'])
            ->whereNull('used_at')
            ->latest('id')
            ->first();

        if (!$verification || !$verification->isValid()) {
            RateLimiter::hit($rlKey, 600);
            return response()->json(['message' => 'Неверный код или срок действия истёк'], 422);
        }

        DB::transaction(function () use ($verification, $user) {
            // Смена email через профиль — обновляем поле.
            if ($verification->new_email && $verification->new_email !== $user->email) {
                $user->email = $verification->new_email;
            }
            $user->email_verified_at = now();
            $user->save();

            $verification->used_at = now();
            $verification->save();

            $this->linkGuestOrders($user);
        });

        RateLimiter::clear($rlKey);

        return response()->json([
            'data' => ['user' => $this->serializeUser($user->refresh())],
        ]);
    }

    /**
     * POST /api/auth/resend-verification
     * Перевыпустить письмо. Rate-limit 1/мин на пользователя.
     */
    public function resendVerification(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }
        if ($user->isEmailVerified()) {
            return response()->json(['message' => 'Почта уже подтверждена'], 422);
        }

        $key = 'resend-verify:' . $user->id;
        if (RateLimiter::tooManyAttempts($key, 1)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'message' => "Письмо уже отправлено. Повторно — через {$seconds} сек.",
            ], 429);
        }
        RateLimiter::hit($key, 60);

        $verification = EmailVerification::issue($user);
        $this->safeSendMail(new VerifyEmailMail($verification->id), 'verify-email-resend');

        return response()->json(['data' => ['sent' => true]]);
    }

    /**
     * POST /api/auth/forgot-password
     * Body: { email }
     * Шлёт письмо с ссылкой /reset-password?token=...&email=...
     */
    public function forgotPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
        ]);

        // Rate-limit: 3 запроса / 10 мин на пару (IP, email).
        $key = 'forgot:' . sha1($request->ip() . '|' . strtolower($data['email']));
        if (RateLimiter::tooManyAttempts($key, 3)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'message' => "Слишком много запросов. Повторите через {$seconds} сек.",
            ], 429);
        }
        RateLimiter::hit($key, 600);

        $user = User::where('email', $data['email'])->first();
        // Чтобы не лить инфу о существовании юзера — всегда отвечаем «ОК».
        if ($user && !$user->is_blocked) {
            // Используем встроенный Password broker — он сам пишет токен в password_reset_tokens.
            $token = Password::broker()->createToken($user);
            $this->safeSendMail(new ResetPasswordMail($user->id, $token), 'reset-password');
        } else {
            Log::info('forgot-password: user not found / blocked', ['email' => $data['email']]);
        }

        return response()->json(['data' => ['sent' => true]]);
    }

    /**
     * POST /api/auth/reset-password
     * Body: { email, token, password, password_confirmation }
     */
    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'token' => ['required', 'string'],
            'password' => ['required', 'string', 'min:8', 'max:120', 'confirmed'],
        ]);

        $status = Password::broker()->reset(
            $data,
            function (User $user, string $password) {
                $user->password = $password; // cast='hashed' захэширует
                $user->setRememberToken(Str::random(60));
                $user->save();
                // На всякий случай — сбрасываем все токены Sanctum.
                $user->tokens()->delete();
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            return response()->json([
                'message' => match ($status) {
                    Password::INVALID_TOKEN => 'Ссылка недействительна или истекла',
                    Password::INVALID_USER => 'Пользователь не найден',
                    default => 'Не удалось сменить пароль',
                },
            ], 422);
        }

        return response()->json(['data' => ['ok' => true]]);
    }

    // ---------- helpers ----------

    protected function issueToken(User $user, Request $request): string
    {
        $deviceName = mb_substr($request->userAgent() ?: 'web', 0, 191);
        // Чистим старый токен этого устройства (мягкое «single session per device»).
        $user->tokens()->where('name', $deviceName)->delete();
        $abilities = $user->role === 'admin' ? ['admin'] : ['customer'];
        $plain = $user->createToken($deviceName, $abilities)->plainTextToken;
        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip' => $request->ip(),
        ])->save();
        return $plain;
    }

    protected function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'phone' => $user->phone,
            'role' => $user->role,
            'email_verified' => $user->isEmailVerified(),
            'balance' => (float) $user->balance,
            'created_at' => $user->created_at?->toIso8601String(),
        ];
    }

    /** UPDATE orders SET user_id WHERE email matches and user_id NULL. */
    protected function linkGuestOrders(User $user): int
    {
        return Order::whereNull('user_id')
            ->where('email', $user->email)
            ->update(['user_id' => $user->id]);
    }

    /**
     * Шлём письмо так, чтобы упавший SMTP не ломал основной флоу
     * (регистрация всё равно прошла, токен всё равно в БД).
     */
    protected function safeSendMail(\Illuminate\Mail\Mailable $mail, string $kind): void
    {
        try {
            Mail::send($mail);
        } catch (\Throwable $e) {
            Log::warning("Mail [{$kind}] send failed", [
                'error' => $e->getMessage(),
            ]);
        }
    }
}
