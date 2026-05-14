<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\ResetPasswordMail;
use App\Mail\VerifyEmailMail;
use App\Models\EmailVerification;
use App\Models\OauthIdentity;
use App\Models\Order;
use App\Models\User;
use Firebase\JWT\JWK;
use Firebase\JWT\JWT;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
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

        // Свежий OAuth-юзер (Telegram и т.п.) — email ещё не установлен, пароля нет.
        // В этом случае разрешаем установить email без подтверждения текущего/пароля.
        $isFirstTime = $user->email === null;

        $rules = [
            'new_email' => ['required', 'email', 'max:190', Rule::unique('users', 'email')],
        ];
        if (!$isFirstTime) {
            $rules['password'] = ['required', 'string'];
        }
        $data = $request->validate($rules);

        if (!$isFirstTime) {
            if (!$user->isEmailVerified()) {
                return response()->json(['message' => 'Сначала подтвердите текущий email'], 422);
            }
            if (!Hash::check($data['password'], (string) $user->password)) {
                return response()->json(['message' => 'Неверный пароль'], 422);
            }
        }

        $verification = EmailVerification::issue($user, $data['new_email']);
        $this->safeSendMail(new VerifyEmailMail($verification->id), 'change-email');

        return response()->json([
            'data' => [
                'pending_email' => $data['new_email'],
                'sent' => true,
                'first_time' => $isFirstTime,
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

    /**
     * POST /api/auth/oauth/telegram/exchange
     *
     * Новый OIDC-flow (старый Login Widget Telegram пометил deprecated).
     *
     * Поток:
     *   1. Фронт генерирует state и code_verifier (PKCE), кладёт в sessionStorage,
     *      редиректит юзера на oauth.telegram.org/auth с code_challenge.
     *   2. Telegram редиректит обратно на /oauth/telegram/callback?code=...&state=...
     *   3. Фронт зовёт этот endpoint с code+verifier.
     *   4. Мы меняем code на id_token у Telegram, проверяем JWT (JWKS),
     *      достаём user data, создаём/находим User, выдаём Sanctum-токен.
     *
     * Body: { code, code_verifier, redirect_uri }
     */
    public function oauthTelegramExchange(Request $request): JsonResponse
    {
        $input = $request->validate([
            'code' => ['required', 'string', 'max:512'],
            'code_verifier' => ['required', 'string', 'min:43', 'max:128'],
            'redirect_uri' => ['required', 'url', 'max:255'],
        ]);

        $clientId = (string) config('services.telegram.client_id');
        $clientSecret = (string) config('services.telegram.client_secret');
        if ($clientId === '' || $clientSecret === '') {
            return response()->json(['message' => 'Telegram OAuth не настроен'], 503);
        }

        // 1. Обмен code на токены.
        //
        // Маршрут Yandex Cloud → Telegram CDN периодически роняет TCP-handshake:
        // в тесте 2 из 5 подключений к одному и тому же IPv4 уходят в таймаут
        // (см. журнал решений, 2026-05-15). Лечим агрессивным fast-fail на
        // connect + retry'ями, чтобы worst-case был ~11s, а не 30+.
        //
        //   connectTimeout(5) — если TCP-handshake не уложился — рестартуем;
        //   timeout(15)       — total cap на весь запрос;
        //   retry(2, 500)     — две перепопытки только на ConnectionException
        //                       (если Telegram ответил 4xx — code одноразовый,
        //                       повтор даст invalid_grant, ретрая делать нельзя);
        //   throw=false       — при провале всех попыток упадём в catch ниже.
        try {
            $resp = Http::asForm()
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(2, 500, function ($e) {
                    return $e instanceof \Illuminate\Http\Client\ConnectionException;
                }, throw: false)
                ->withBasicAuth($clientId, $clientSecret)
                ->post('https://oauth.telegram.org/token', [
                    'grant_type' => 'authorization_code',
                    'code' => $input['code'],
                    'redirect_uri' => $input['redirect_uri'],
                    'client_id' => $clientId,
                    'code_verifier' => $input['code_verifier'],
                ]);
        } catch (\Throwable $e) {
            Log::warning('Telegram OAuth token exchange failed', ['error' => $e->getMessage()]);
            // 503 + Retry-After: для клиента это «попробуй ещё раз», а не «сервер сломан»
            // (как читалось 502 у пользователя на скриншоте).
            return response()
                ->json(['message' => 'Telegram временно недоступен, попробуйте ещё раз'], 503)
                ->header('Retry-After', '5');
        }

        if (!$resp->ok()) {
            Log::warning('Telegram OAuth token error', ['status' => $resp->status(), 'body' => $resp->body()]);
            return response()->json(['message' => 'Telegram отверг код входа'], 422);
        }

        $idToken = (string) $resp->json('id_token');
        if ($idToken === '') {
            return response()->json(['message' => 'Telegram не вернул id_token'], 502);
        }

        // 2. Валидируем id_token (JWT) по JWKS.
        //
        // JWKS у Telegram меняется редко (раз в месяцы), а маршрут до их CDN
        // нестабилен (см. 2026-05-15 в журнале решений). Поэтому:
        //   - держим JWKS в Redis на 1 час;
        //   - если кэш пуст — забираем по сети с теми же fast-fail настройками,
        //     что и token endpoint;
        //   - если ключ для текущего токена не нашёлся в кэше — однократно
        //     инвалидируем и перетягиваем (могла произойти ротация).
        try {
            $jwks = $this->fetchTelegramJwks(forceRefresh: false);
            $keys = JWK::parseKeySet($jwks);
            try {
                $payload = (array) JWT::decode($idToken, $keys);
            } catch (\Firebase\JWT\UnexpectedValueException $e) {
                // Возможно ротация ключей — перетянем JWKS принудительно.
                Log::info('Telegram JWKS cache miss for current token, refreshing');
                $jwks = $this->fetchTelegramJwks(forceRefresh: true);
                $keys = JWK::parseKeySet($jwks);
                $payload = (array) JWT::decode($idToken, $keys);
            }
        } catch (\Throwable $e) {
            Log::warning('Telegram OAuth id_token verify failed', ['error' => $e->getMessage()]);
            return response()->json(['message' => 'Подпись id_token не сошлась'], 422);
        }

        // 3. Проверка claim'ов: iss + aud
        if (($payload['iss'] ?? null) !== 'https://oauth.telegram.org') {
            return response()->json(['message' => 'Неверный iss'], 422);
        }
        if ((string) ($payload['aud'] ?? '') !== (string) $clientId) {
            return response()->json(['message' => 'Неверный aud'], 422);
        }

        // 4. Достаём user-data
        $providerUid = (string) ($payload['id'] ?? $payload['sub'] ?? '');
        if ($providerUid === '') {
            return response()->json(['message' => 'В id_token нет id пользователя'], 422);
        }
        $displayName = (string) ($payload['name'] ?? $payload['preferred_username'] ?? 'TG ' . $providerUid);
        $photoUrl = isset($payload['picture']) ? (string) $payload['picture'] : null;

        // 5. Найти/создать
        $user = DB::transaction(function () use ($providerUid, $displayName, $payload) {
            $identity = OauthIdentity::where('provider', 'telegram')
                ->where('provider_uid', $providerUid)
                ->first();

            if ($identity) {
                $identity->update(['raw_profile' => $payload]);
                return $identity->user;
            }

            $user = User::create([
                'email' => null,
                'name' => $displayName,
                'role' => 'customer',
            ]);

            OauthIdentity::create([
                'user_id' => $user->id,
                'provider' => 'telegram',
                'provider_uid' => $providerUid,
                'raw_profile' => $payload,
            ]);
            return $user;
        });

        if ($user->is_blocked) {
            return response()->json(['message' => 'Аккаунт заблокирован'], 403);
        }

        $token = $this->issueToken($user, $request);

        if ($user->isEmailVerified()) {
            $this->linkGuestOrders($user);
        }

        return response()->json([
            'data' => [
                'token' => $token,
                'user' => $this->serializeUser($user->refresh()),
                'needs_email' => $user->email === null,
                'photo_url' => $photoUrl,
            ],
        ]);
    }

    // ---------- helpers ----------

    /**
     * Получить JWKS Telegram'а (с кэшем в Redis на 1 час).
     *
     * @param bool $forceRefresh инвалидировать кэш и перетянуть из сети.
     * @return array{keys: array<int, array<string, mixed>>}
     * @throws \RuntimeException если JWKS недоступен и кэша нет.
     */
    protected function fetchTelegramJwks(bool $forceRefresh = false): array
    {
        $cacheKey = 'telegram_jwks';

        if ($forceRefresh) {
            Cache::forget($cacheKey);
        } else {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && !empty($cached['keys'])) {
                return $cached;
            }
        }

        $resp = Http::connectTimeout(5)->timeout(15)
            ->retry(2, 500, function ($e) {
                return $e instanceof \Illuminate\Http\Client\ConnectionException;
            }, throw: false)
            ->get('https://oauth.telegram.org/.well-known/jwks.json');

        if (!$resp || !$resp->ok()) {
            throw new \RuntimeException('JWKS HTTP ' . ($resp ? $resp->status() : 'no response'));
        }

        $data = $resp->json();
        if (!is_array($data) || empty($data['keys'])) {
            throw new \RuntimeException('JWKS payload invalid');
        }

        Cache::put($cacheKey, $data, 3600);
        return $data;
    }

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
        // Pending email — последний неиспользованный и не истёкший EmailVerification.
        // Нужен фронту, чтобы:
        //   1) не отправлять на /account/profile с /verify-email если код уже отправлен;
        //   2) плашка «отправили код на X» переживала refresh страницы.
        $pendingEmail = EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->value('new_email');

        return [
            'id' => $user->id,
            'email' => $user->email,
            'name' => $user->name,
            'phone' => $user->phone,
            'role' => $user->role,
            'email_verified' => $user->isEmailVerified(),
            'pending_email' => $pendingEmail,
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
