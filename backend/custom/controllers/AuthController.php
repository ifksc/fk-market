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
     * POST /api/me/logout-others
     * Завершает все сеансы пользователя, кроме текущего — выкидывает чужие
     * устройства, на которых остался залогиненный аккаунт.
     */
    public function logoutOthers(Request $request): JsonResponse
    {
        $user = $request->user();
        $currentId = $user->currentAccessToken()?->id;
        $count = $user->tokens()
            ->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))
            ->count();
        $user->tokens()
            ->when($currentId, fn ($q) => $q->where('id', '!=', $currentId))
            ->delete();

        return response()->json(['data' => ['ok' => true, 'revoked' => $count]]);
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

        // Берём new_email из текущего pending verification — чтобы resend
        // слал на тот же адрес, что и оригинальное письмо. Важно для:
        //   1) смены email (pending = новый адрес, user->email = старый);
        //   2) OAuth-юзеров (user->email = null, pending содержит указанный
        //      адрес — без этого Mail падал с "read property address on null").
        $pendingEmail = EmailVerification::where('user_id', $user->id)
            ->whereNull('used_at')
            ->where('expires_at', '>', now())
            ->latest('id')
            ->value('new_email');

        // Не на какой адрес слать — выходим с понятной ошибкой
        // вместо падения внутри почтового слоя.
        if (!$pendingEmail && !$user->email) {
            return response()->json([
                'message' => 'Сначала укажите email в профиле',
            ], 422);
        }

        $key = 'resend-verify:' . $user->id;
        if (RateLimiter::tooManyAttempts($key, 1)) {
            $seconds = RateLimiter::availableIn($key);
            return response()->json([
                'message' => "Письмо уже отправлено. Повторно — через {$seconds} сек.",
            ], 429);
        }
        RateLimiter::hit($key, 60);

        // Передаём $pendingEmail (может быть null для register-flow: тогда
        // EmailVerification::issue создаст запись с new_email=null, а
        // VerifyEmailMail::envelope() сам возьмёт $user->email).
        $verification = EmailVerification::issue($user, $pendingEmail);
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
        //   retry(3, 800)     — три перепопытки только на ConnectionException
        //                       (если Telegram ответил 4xx — code одноразовый,
        //                       повтор даст invalid_grant, ретрая делать нельзя).
        //                       4 попытки суммарно: при ~40% потерь handshake'ов
        //                       шанс успеха ≈ 1 − 0.4⁴ ≈ 97%;
        //   throw=false       — при провале всех попыток упадём в catch ниже.
        try {
            $resp = Http::asForm()
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(3, 800, function ($e) {
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
            // 422 (не 502): Cloudflare перехватывает 5xx и подменяет тело на свою error-page,
            // фронт не увидит наш message. Подробности — в журнале решений, VK OAuth.
            return response()->json(['message' => 'Telegram не вернул id_token'], 422);
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

    /**
     * POST /api/auth/oauth/vk/exchange
     *
     * VK ID OIDC + PKCE — структура та же, что и Telegram:
     *   1. Фронт генерирует state и code_verifier, редиректит на id.vk.com/authorize.
     *   2. VK возвращает ?code=...&state=...&device_id=... на /oauth/vk/callback.
     *   3. Фронт зовёт этот endpoint с code+verifier+device_id+redirect_uri.
     *   4. Мы меняем code на access_token + id_token (JWT) через id.vk.com/oauth2/auth,
     *      проверяем JWT по JWKS, достаём user-data, создаём/находим User,
     *      выдаём Sanctum-токен.
     *
     * Особенности VK по сравнению с Telegram:
     *   - token endpoint: /oauth2/auth (а не /token);
     *   - параметр device_id обязательный (VK PKCE-flow);
     *   - в JWT iss = "https://id.vk.com".
     *
     * Body: { code, code_verifier, device_id, redirect_uri }
     */
    public function oauthVkExchange(Request $request): JsonResponse
    {
        $input = $request->validate([
            'code' => ['required', 'string', 'max:1024'],
            'code_verifier' => ['required', 'string', 'min:43', 'max:128'],
            'device_id' => ['required', 'string', 'max:191'],
            'redirect_uri' => ['required', 'url', 'max:255'],
        ]);

        $clientId = (string) config('services.vk.client_id');
        $clientSecret = (string) config('services.vk.client_secret');
        if ($clientId === '' || $clientSecret === '') {
            return response()->json(['message' => 'VK OAuth не настроен'], 503);
        }

        // 1. Обмен code на токены (те же fast-fail настройки что у Telegram —
        // сетевые маршруты до id.vk.com из Yandex Cloud могут флакать).
        try {
            $resp = Http::asForm()
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(3, 800, function ($e) {
                    return $e instanceof \Illuminate\Http\Client\ConnectionException;
                }, throw: false)
                ->post('https://id.vk.com/oauth2/auth', [
                    'grant_type' => 'authorization_code',
                    'code' => $input['code'],
                    'code_verifier' => $input['code_verifier'],
                    'device_id' => $input['device_id'],
                    'redirect_uri' => $input['redirect_uri'],
                    'client_id' => $clientId,
                    'client_secret' => $clientSecret,
                ]);
        } catch (\Throwable $e) {
            Log::warning('VK OAuth token exchange failed', ['error' => $e->getMessage()]);
            return response()
                ->json(['message' => 'VK временно недоступен, попробуйте ещё раз'], 503)
                ->header('Retry-After', '5');
        }

        // VK ID часто отдаёт HTTP 200 + JSON `{"error": "...", "error_description": "..."}`
        // на невалидный code/device_id/verifier — это не успех. Проверяем явно error-поле
        // плюс HTTP-статус.
        if (!$resp->ok() || $resp->json('error')) {
            Log::warning('VK OAuth token error', ['status' => $resp->status(), 'body' => $resp->body()]);
            return response()->json(['message' => 'VK отверг код входа'], 422);
        }

        $accessToken = (string) $resp->json('access_token');
        if ($accessToken === '') {
            Log::warning('VK OAuth missing access_token', ['body' => $resp->body()]);
            return response()->json(['message' => 'VK не вернул access_token'], 422);
        }

        // 2. Получаем профиль через user_info.
        //
        // Почему не через id_token+JWKS: у VK ID нет публичного JWKS endpoint'а
        // (перепробованы /oauth2/public_keys, /public_key, /.well-known/* —
        // все 404, см. журнал решений 2026-05-16). access_token добыт
        // backend-to-backend по TLS с нашим client_secret — ему можно доверять
        // без проверки JWT-подписи, поэтому профиль берём через user_info.
        try {
            $userResp = Http::asForm()
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(3, 800, function ($e) {
                    return $e instanceof \Illuminate\Http\Client\ConnectionException;
                }, throw: false)
                ->post('https://id.vk.com/oauth2/user_info', [
                    'access_token' => $accessToken,
                    'client_id' => $clientId,
                ]);
        } catch (\Throwable $e) {
            Log::warning('VK OAuth user_info failed', ['error' => $e->getMessage()]);
            return response()
                ->json(['message' => 'VK временно недоступен, попробуйте ещё раз'], 503)
                ->header('Retry-After', '5');
        }

        if (!$userResp->ok() || $userResp->json('error')) {
            Log::warning('VK OAuth user_info error', ['status' => $userResp->status(), 'body' => $userResp->body()]);
            return response()->json(['message' => 'Не удалось получить профиль VK'], 422);
        }

        // VK ID отдаёт { "user": { user_id, first_name, last_name, email, avatar, ... } }.
        $vk = (array) ($userResp->json('user') ?? $userResp->json());

        // 3. Достаём user-data.
        $providerUid = (string) ($vk['user_id'] ?? $vk['id'] ?? '');
        if ($providerUid === '') {
            Log::warning('VK OAuth no user_id in user_info', ['body' => $userResp->body()]);
            return response()->json(['message' => 'VK не вернул id пользователя'], 422);
        }
        $email = null;
        if (!empty($vk['email']) && filter_var($vk['email'], FILTER_VALIDATE_EMAIL)) {
            // VK email уже верифицирован у провайдера (юзер логинится по нему).
            $email = mb_strtolower((string) $vk['email']);
        }
        $firstName = (string) ($vk['first_name'] ?? '');
        $lastName = (string) ($vk['last_name'] ?? '');
        $displayName = trim($firstName . ' ' . $lastName) ?: ('VK ' . $providerUid);
        $photoUrl = isset($vk['avatar']) ? (string) $vk['avatar'] : null;

        // 4. Найти/создать User. Если email с VK уже занят кем-то другим —
        // привязываем VK-identity к существующему юзеру (объединение аккаунтов).
        $user = DB::transaction(function () use ($providerUid, $displayName, $email, $vk) {
            $identity = OauthIdentity::where('provider', 'vk')
                ->where('provider_uid', $providerUid)
                ->first();

            if ($identity) {
                $identity->update(['raw_profile' => $vk]);
                return $identity->user;
            }

            // Привязываем к существующему аккаунту по email только если у того
            // email уже подтверждён. Иначе чужой неподтверждённый аккаунт можно
            // было бы захватить, заведя OAuth с его адресом.
            $existing = $email ? User::where('email', $email)->first() : null;
            if ($existing && $existing->email_verified_at) {
                OauthIdentity::create([
                    'user_id' => $existing->id,
                    'provider' => 'vk',
                    'provider_uid' => $providerUid,
                    'raw_profile' => $vk,
                ]);
                return $existing;
            }

            // Email конфликтует с неподтверждённым аккаунтом — не забираем чужой
            // адрес: создаём OAuth-аккаунт без email (юзер укажет свой сам).
            $ownEmail = $existing ? null : $email;
            $user = User::create([
                'email' => $ownEmail,
                'email_verified_at' => $ownEmail ? now() : null,
                'name' => $displayName,
                'role' => 'customer',
            ]);

            OauthIdentity::create([
                'user_id' => $user->id,
                'provider' => 'vk',
                'provider_uid' => $providerUid,
                'raw_profile' => $vk,
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

    /**
     * POST /api/auth/oauth/yandex/exchange
     *
     * Яндекс ID OAuth 2.0 + PKCE. Структура та же, что и VK:
     *   1. Фронт генерирует state и code_verifier, редиректит на oauth.yandex.ru/authorize.
     *   2. Яндекс возвращает ?code=...&state=... на /oauth/yandex/callback.
     *   3. Фронт зовёт этот endpoint с code+verifier+redirect_uri.
     *   4. Мы меняем code на access_token через oauth.yandex.ru/token,
     *      достаём профиль через login.yandex.ru/info, создаём/находим User,
     *      выдаём Sanctum-токен.
     *
     * Особенности Яндекса по сравнению с VK:
     *   - чистый OAuth 2.0 без OIDC — id_token не выдаётся, JWKS нет;
     *     профиль берём через login.yandex.ru/info (как user_info у VK);
     *   - device_id не нужен;
     *   - токен в user_info-запросе передаётся заголовком `Authorization: OAuth <token>`.
     *
     * Body: { code, code_verifier, redirect_uri }
     */
    public function oauthYandexExchange(Request $request): JsonResponse
    {
        $input = $request->validate([
            'code' => ['required', 'string', 'max:1024'],
            'code_verifier' => ['required', 'string', 'min:43', 'max:128'],
            'redirect_uri' => ['required', 'url', 'max:255'],
        ]);

        $clientId = (string) config('services.yandex.client_id');
        $clientSecret = (string) config('services.yandex.client_secret');
        if ($clientId === '' || $clientSecret === '') {
            return response()->json(['message' => 'Яндекс OAuth не настроен'], 503);
        }

        // 1. Обмен code на access_token (те же fast-fail настройки что у VK/Telegram).
        try {
            $resp = Http::asForm()
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(3, 800, function ($e) {
                    return $e instanceof \Illuminate\Http\Client\ConnectionException;
                }, throw: false)
                ->post('https://oauth.yandex.ru/token', [
                    'grant_type' => 'authorization_code',
                    'code' => $input['code'],
                    'code_verifier' => $input['code_verifier'],
                    'redirect_uri' => $input['redirect_uri'],
                    'client_id' => $clientId,
                    'client_secret' => $clientSecret,
                ]);
        } catch (\Throwable $e) {
            Log::warning('Yandex OAuth token exchange failed', ['error' => $e->getMessage()]);
            return response()
                ->json(['message' => 'Яндекс временно недоступен, попробуйте ещё раз'], 503)
                ->header('Retry-After', '5');
        }

        // Яндекс на невалидный code отдаёт 400 + JSON `{"error": "...", ...}`.
        if (!$resp->ok() || $resp->json('error')) {
            Log::warning('Yandex OAuth token error', ['status' => $resp->status(), 'body' => $resp->body()]);
            return response()->json(['message' => 'Яндекс отверг код входа'], 422);
        }

        $accessToken = (string) $resp->json('access_token');
        if ($accessToken === '') {
            Log::warning('Yandex OAuth missing access_token', ['body' => $resp->body()]);
            return response()->json(['message' => 'Яндекс не вернул access_token'], 422);
        }

        // 2. Получаем профиль через login.yandex.ru/info.
        // У Яндекса нет OIDC id_token — access_token добыт backend-to-backend
        // по TLS с нашим client_secret, ему можно доверять без JWT-проверки.
        try {
            $userResp = Http::withHeaders(['Authorization' => 'OAuth ' . $accessToken])
                ->connectTimeout(5)
                ->timeout(15)
                ->retry(3, 800, function ($e) {
                    return $e instanceof \Illuminate\Http\Client\ConnectionException;
                }, throw: false)
                ->get('https://login.yandex.ru/info', ['format' => 'json']);
        } catch (\Throwable $e) {
            Log::warning('Yandex OAuth info failed', ['error' => $e->getMessage()]);
            return response()
                ->json(['message' => 'Яндекс временно недоступен, попробуйте ещё раз'], 503)
                ->header('Retry-After', '5');
        }

        if (!$userResp->ok() || $userResp->json('error')) {
            Log::warning('Yandex OAuth info error', ['status' => $userResp->status(), 'body' => $userResp->body()]);
            return response()->json(['message' => 'Не удалось получить профиль Яндекса'], 422);
        }

        $ya = (array) $userResp->json();

        // 3. Достаём user-data.
        $providerUid = (string) ($ya['id'] ?? '');
        if ($providerUid === '') {
            Log::warning('Yandex OAuth no id in info', ['body' => $userResp->body()]);
            return response()->json(['message' => 'Яндекс не вернул id пользователя'], 422);
        }
        $email = null;
        $rawEmail = $ya['default_email'] ?? ($ya['emails'][0] ?? null);
        if (!empty($rawEmail) && filter_var($rawEmail, FILTER_VALIDATE_EMAIL)) {
            // Email аккаунта Яндекса подтверждён у провайдера.
            $email = mb_strtolower((string) $rawEmail);
        }
        $displayName = (string) ($ya['display_name'] ?? $ya['real_name'] ?? $ya['login'] ?? '');
        if ($displayName === '') {
            $displayName = 'Yandex ' . $providerUid;
        }
        $photoUrl = null;
        if (!empty($ya['default_avatar_id']) && empty($ya['is_avatar_empty'])) {
            $photoUrl = 'https://avatars.yandex.net/get-yapic/' . $ya['default_avatar_id'] . '/islands-200';
        }

        // 4. Найти/создать User. Если email с Яндекса уже занят кем-то другим —
        // привязываем Yandex-identity к существующему юзеру (объединение аккаунтов).
        $user = DB::transaction(function () use ($providerUid, $displayName, $email, $ya) {
            $identity = OauthIdentity::where('provider', 'yandex')
                ->where('provider_uid', $providerUid)
                ->first();

            if ($identity) {
                $identity->update(['raw_profile' => $ya]);
                return $identity->user;
            }

            // Привязка по email — только к аккаунту с уже подтверждённым email
            // (защита от захвата чужого неподтверждённого аккаунта).
            $existing = $email ? User::where('email', $email)->first() : null;
            if ($existing && $existing->email_verified_at) {
                OauthIdentity::create([
                    'user_id' => $existing->id,
                    'provider' => 'yandex',
                    'provider_uid' => $providerUid,
                    'raw_profile' => $ya,
                ]);
                return $existing;
            }

            // Email занят неподтверждённым аккаунтом — не забираем чужой адрес.
            $ownEmail = $existing ? null : $email;
            $user = User::create([
                'email' => $ownEmail,
                'email_verified_at' => $ownEmail ? now() : null,
                'name' => $displayName,
                'role' => 'customer',
            ]);

            OauthIdentity::create([
                'user_id' => $user->id,
                'provider' => 'yandex',
                'provider_uid' => $providerUid,
                'raw_profile' => $ya,
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
     * Получить JWKS OAuth-провайдера (с кэшем в Redis на 1 час).
     *
     * @param string $cacheKey   ключ в Redis-кэше (`telegram_jwks`, `vk_jwks`, …).
     * @param string $url        JWKS endpoint провайдера.
     * @param bool   $forceRefresh инвалидировать кэш и перетянуть из сети.
     * @return array{keys: array<int, array<string, mixed>>}
     * @throws \RuntimeException если JWKS недоступен и кэша нет.
     */
    protected function fetchOauthJwks(string $cacheKey, string $url, bool $forceRefresh = false): array
    {
        // Двухуровневый кэш:
        //   $cacheKey        — «свежий», TTL 1 час (триггерит периодический refresh);
        //   $cacheKey_stale  — последняя успешно загруженная копия, TTL 30 дней.
        // Если сеть до провайдера упала, а свежего кэша нет — отдаём stale:
        // JWKS-ключи у Telegram/VK меняются раз в месяцы, прошлый набор почти
        // наверняка ещё валиден. Это убирает «Подпись id_token не сошлась»
        // при transient-сбоях маршрута до oauth.telegram.org.
        $staleKey = $cacheKey . '_stale';

        if (!$forceRefresh) {
            $cached = Cache::get($cacheKey);
            if (is_array($cached) && !empty($cached['keys'])) {
                return $cached;
            }
        }

        $resp = Http::connectTimeout(5)->timeout(15)
            ->retry(3, 800, function ($e) {
                return $e instanceof \Illuminate\Http\Client\ConnectionException;
            }, throw: false)
            ->get($url);

        if ($resp && $resp->ok()) {
            $data = $resp->json();
            if (is_array($data) && !empty($data['keys'])) {
                Cache::put($cacheKey, $data, 3600);                 // свежий — 1 час
                Cache::put($staleKey, $data, 60 * 60 * 24 * 30);    // stale — 30 дней
                return $data;
            }
        }

        // Сеть не дала валидный JWKS — пробуем stale-копию.
        $stale = Cache::get($staleKey);
        if (is_array($stale) && !empty($stale['keys'])) {
            Log::warning('JWKS fetch failed, using stale copy', [
                'key' => $cacheKey,
                'http' => $resp ? $resp->status() : 'no response',
            ]);
            return $stale;
        }

        throw new \RuntimeException(
            'JWKS unavailable and no stale copy: ' . $cacheKey
            . ' (HTTP ' . ($resp ? $resp->status() : 'no response') . ')'
        );
    }

    /** Хелпер обратной совместимости — Telegram JWKS. */
    protected function fetchTelegramJwks(bool $forceRefresh = false): array
    {
        return $this->fetchOauthJwks(
            'telegram_jwks',
            'https://oauth.telegram.org/.well-known/jwks.json',
            $forceRefresh,
        );
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
