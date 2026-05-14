<?php

namespace App\Services\Providers;

use App\Models\ProviderLog;
use Illuminate\Support\Facades\Http;

/**
 * Адаптер FKwallet API (https://api.fkwallet.io/v1/).
 *
 * Авторизация (https://fkwallet.io/personal/settings/api-key):
 *   header X-Api-Key: {publicKey}
 *   header Authorization: Bearer {sign}
 *     где sign = sha256(json_encode(body) + privateKey)        — для POST
 *     или sign = sha256(privateKey)                            — для GET (пустое тело)
 *
 * Online Products endpoints:
 *   GET  /op/categories
 *   GET  /op/categories/{id}/products
 *   POST /op/validate
 *   POST /op/create
 *   GET  /op/status/{order_id}
 */
class FkwalletProductsGateway implements ProviderGateway
{
    public function __construct(
        protected string $publicKey,
        protected string $privateKey,
        protected string $baseUrl,
        protected int $defaultCurrencyId,
        protected int $providerId,
    ) {}

    public static function fromConfig(int $providerId): self
    {
        return new self(
            publicKey: (string) config('services.fkwallet_op.public_key'),
            privateKey: (string) config('services.fkwallet_op.private_key'),
            baseUrl: rtrim((string) config('services.fkwallet_op.base_url'), '/'),
            defaultCurrencyId: (int) config('services.fkwallet_op.default_currency_id', 1),
            providerId: $providerId,
        );
    }

    public function listCategories(): array
    {
        return $this->unwrap($this->call('GET', '/op/categories'));
    }

    public function listProducts(int $categoryId): array
    {
        return $this->unwrap($this->call('GET', "/op/categories/{$categoryId}/products"));
    }

    public function validate(string $idempotenceKey, int $externalId, ?float $amount, array $fields): bool
    {
        try {
            // FK на /op/validate отвечает:
            //   • HTTP 200 (тело может быть пустым [] / {"status":"ok"}) — параметры валидны
            //   • HTTP 409 {"message":"Duplicate idempotence key"} — этот ключ уже валидировался ранее,
            //     значит первый раз прошёл успешно; считаем валидным.
            //   • HTTP 4xx с другой message — невалидны (упадёт exception в call())
            $r = $this->call('POST', '/op/validate', $this->buildOrderBody($idempotenceKey, $externalId, $amount, $fields));
            $explicitFail = ($r['status'] ?? null) === 'error' || ($r['success'] ?? null) === false;
            return !$explicitFail;
        } catch (\Throwable $e) {
            // Дубликат ключа — повтор после успешной первой валидации, не считаем за ошибку.
            if (str_contains(strtolower($e->getMessage()), 'duplicate idempotence key')) {
                return true;
            }
            \Illuminate\Support\Facades\Log::info('FKwallet validate() failed', ['error' => $e->getMessage()]);
            return false;
        }
    }

    public function order(string $idempotenceKey, int $externalId, ?float $amount, array $fields): array
    {
        $r = $this->call('POST', '/op/create', $this->buildOrderBody($idempotenceKey, $externalId, $amount, $fields));
        // Возвращает {id, status, coupon_code}
        return $this->unwrapObject($r);
    }

    public function getStatus(int $providerOrderId): array
    {
        $r = $this->call('GET', "/op/status/{$providerOrderId}");
        return $this->unwrapObject($r);
    }

    // ---------- Withdrawal (вывод на платёжные системы — пополнение Steam и т.п.) ----------

    /** Числовые статусы FK withdrawal — финальный успех. */
    public const WITHDRAWAL_STATUS_SUCCESS = [1];
    /** В обработке: новый, in_progress, processing… */
    public const WITHDRAWAL_STATUS_PENDING = [0, 2, 3, 4, 5, 11];
    /** Финальный fail. */
    public const WITHDRAWAL_STATUS_FAILED = [8, 9, 10];

    /**
     * Валидация Steam-аккаунта. Не реквестим withdrawal без живого логина.
     */
    public function validateSteamAccount(string $login): bool
    {
        try {
            $r = $this->call('POST', '/steam/validate', ['account' => $login]);
            $data = $r['data'] ?? $r;
            return (bool) ($data['isValid'] ?? false);
        } catch (\Throwable $e) {
            // FK при invalid логине может ответить 4xx с message — считаем false
            return false;
        }
    }

    /**
     * POST /withdrawal — вывод средств в платёжную систему.
     *
     * @param  array<string,mixed>  $extra  необязательное, может содержать payment_system_id,
     *                                      currency_id, fee_from_balance, account, description, fields, order_id
     * @return array{id?:int,status?:int}
     */
    public function withdrawal(string $idempotenceKey, float $amount, string $account, int $paymentSystemId, array $extra = []): array
    {
        $body = array_merge([
            'amount' => $amount,
            'currency_id' => $this->defaultCurrencyId,
            'payment_system_id' => $paymentSystemId,
            'fee_from_balance' => 1, // комиссия из нашего баланса в FKwallet
            'account' => $account,
            'idempotence_key' => $idempotenceKey,
        ], $extra);

        $r = $this->call('POST', '/withdrawal', $body);
        return $this->unwrapObject($r);
    }

    /**
     * GET /withdrawal/{id} — текущий статус.
     * @return array{id?:int,status?:int}
     */
    public function getWithdrawalStatus(int $providerOrderId): array
    {
        $r = $this->call('GET', "/withdrawal/{$providerOrderId}?type=id");
        return $this->unwrapObject($r);
    }

    // ---------------- internals ----------------

    protected function buildOrderBody(string $idempotenceKey, int $externalId, ?float $amount, array $fields): array
    {
        $body = [
            'online_product_id' => $externalId,
            'currency_id' => $this->defaultCurrencyId,
            'idempotence_key' => $idempotenceKey,
            'fields' => $fields,
        ];
        if ($amount !== null) $body['amount'] = $amount;
        return $body;
    }

    /**
     * Достаёт массив данных из ответа FK (для list-эндпоинтов).
     * FK может вернуть один из:
     *   {"status":"ok","data":[...]}     → возвращаем [...]
     *   {"data":[...]}                   → возвращаем [...]
     *   [{...},{...}]                    → возвращаем как есть
     */
    protected function unwrap(array $response): array
    {
        if (isset($response['data']) && is_array($response['data'])) return $response['data'];
        if (array_is_list($response)) return $response;
        return [];
    }

    /**
     * Достаёт объект-результат из ответа FK (для одиночных результатов: order/status).
     * Возвращает плоский ассоциативный массив с id, status, coupon_code и т.п.
     */
    protected function unwrapObject(array $response): array
    {
        if (isset($response['data']) && is_array($response['data']) && !array_is_list($response['data'])) {
            return $response['data'];
        }
        if (!array_is_list($response)) return $response;
        return [];
    }

    /**
     * Низкоуровневый вызов API + логирование в provider_logs.
     */
    protected function call(string $method, string $path, array $body = null): array
    {
        if (empty($this->publicKey) || empty($this->privateKey)) {
            throw new \RuntimeException('FKWALLET_OP_KEY или FKWALLET_OP_PRIVATE_KEY не заданы в .env');
        }

        // URL формат FK: https://api.fkwallet.com/v1/{publicKey}{endpoint}
        $url = "{$this->baseUrl}/{$this->publicKey}{$path}";
        $logUrl = "{$this->baseUrl}/***{$path}"; // маскируем public_key в логе
        $start = microtime(true);

        // Подпись: sha256(json_body + privateKey) или sha256(privateKey) для GET без тела
        $bodyJson = $body !== null ? json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) : '';
        $sign = hash('sha256', $bodyJson . $this->privateKey);

        $headers = [
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
            'Authorization' => 'Bearer ' . $sign,
        ];

        try {
            $req = Http::timeout(30)->withHeaders($headers);
            $response = match (strtoupper($method)) {
                'POST' => $req->withBody($bodyJson ?: '{}', 'application/json')->post($url),
                default => $req->get($url),
            };
            $latencyMs = (int) ((microtime(true) - $start) * 1000);

            // Маскируем чувствительные данные в логе
            $logHeaders = $headers;
            $logHeaders['Authorization'] = 'Bearer ***';

            ProviderLog::create([
                'provider_id' => $this->providerId,
                'operation' => trim($path, '/'),
                'request' => $method . ' ' . $logUrl . "\n" .
                    json_encode($logHeaders, JSON_UNESCAPED_UNICODE) .
                    ($body ? "\nbody: " . json_encode($body, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE) : ''),
                'response' => mb_substr((string) $response->body(), 0, 5000),
                'status_code' => $response->status(),
                'success' => $response->ok(),
                'latency_ms' => $latencyMs,
            ]);

            // Парсим body вручную — Laravel ->json() возвращает null если Content-Type не application/json
            $parsed = json_decode((string) $response->body(), true) ?? [];

            if (!$response->ok()) {
                $msg = (string) ($parsed['message'] ?? $parsed['error'] ?? $response->body());
                throw new \RuntimeException("FKwallet API HTTP {$response->status()}: {$msg}");
            }

            return $parsed;
        } catch (\Throwable $e) {
            ProviderLog::create([
                'provider_id' => $this->providerId,
                'operation' => trim($path, '/'),
                'request' => $method . ' ' . $logUrl,
                'response' => null,
                'status_code' => null,
                'success' => false,
                'latency_ms' => (int) ((microtime(true) - $start) * 1000),
                'error_text' => mb_substr($e->getMessage(), 0, 500),
            ]);
            throw $e;
        }
    }
}
