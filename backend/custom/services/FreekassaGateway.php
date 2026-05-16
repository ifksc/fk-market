<?php

namespace App\Services;

use App\Models\Order;
use App\Models\Payment;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Адаптер платёжной системы Freekassa.
 *
 * ВАЖНО: НЕ путать с FKwallet (App\Services\Providers\FkwalletProductsGateway) —
 * тот используется как ПОСТАВЩИК товаров (Online Products API), а этот класс —
 * платёжная система, через которую клиент платит за заказ.
 *
 * Поддерживает два режима, выбираемых через Setting `freekassa_mode`:
 *   • sci (default) — GET-форма на pay.fk.money с MD5-подписью
 *   • api           — POST на api.fk.life/v1/orders/create с HMAC-SHA256
 *
 * Webhook (POST на наш Result URL) одинаков для обоих режимов:
 *   MD5(merchant_id : amount : secret_word_2 : order_id) → SIGN.
 */
class FreekassaGateway
{
    /** Whitelist IP-адресов Freekassa, которые могут отправлять webhook. */
    public const WEBHOOK_ALLOWED_IPS = [
        '168.119.157.136',
        '168.119.60.227',
        '178.154.197.79',
        '51.250.54.238',
    ];

    public function __construct(
        protected string $merchantId,
        protected string $secretWord1,
        protected string $secretWord2,
        protected string $apiKey,
        protected bool $sandbox = false,
    ) {}

    public static function fromConfig(): self
    {
        return new self(
            merchantId: (string) config('services.freekassa.merchant_id'),
            secretWord1: (string) config('services.freekassa.secret_word_1'),
            secretWord2: (string) config('services.freekassa.secret_word_2'),
            apiKey: (string) config('services.freekassa.api_key'),
            sandbox: (bool) config('services.freekassa.sandbox'),
        );
    }

    /**
     * Главная точка: создать платёжную ссылку. Режим (sci/api) теперь приходит
     * от конкретного payment_method — каждый метод знает свой канал.
     */
    public function makePaymentUrl(Order $order, string $email, ?int $paymentSystemId = null, string $mode = 'sci'): string
    {
        return $mode === 'api'
            ? $this->createOrderViaApi($order, $email, $paymentSystemId)
            : $this->buildPaymentUrl($order, $email, $paymentSystemId);
    }

    /**
     * SCI: формируем URL на pay.fk.money с MD5-подписью.
     *
     * @param  int|null  $paymentSystemId  ID метода в Freekassa (i=N)
     */
    public function buildPaymentUrl(Order $order, string $email, ?int $paymentSystemId = null): string
    {
        $amount = number_format((float) $order->total, 2, '.', '');
        $orderId = $order->public_number;
        $currency = 'RUB';

        $sign = md5("{$this->merchantId}:{$amount}:{$this->secretWord1}:{$currency}:{$orderId}");

        $params = [
            'm' => $this->merchantId,
            'oa' => $amount,
            'o' => $orderId,
            's' => $sign,
            'currency' => $currency,
            'em' => $email,
            'lang' => 'ru',
            'us_order_id' => $order->id,
        ];
        if ($paymentSystemId !== null) {
            $params['i'] = $paymentSystemId;
        }

        $base = $this->sandbox
            ? 'https://pay.fk.money/?test=1&'
            : 'https://pay.fk.money/?';

        return $base . http_build_query($params);
    }

    /**
     * API: POST /v1/orders/create с HMAC-SHA256 подписью.
     * Возвращает location — URL платёжной страницы.
     */
    public function createOrderViaApi(Order $order, string $email, ?int $paymentSystemId = null): string
    {
        if ($this->apiKey === '') {
            throw new \RuntimeException('FREEKASSA_API_KEY не задан');
        }

        $body = [
            'shopId' => (int) $this->merchantId,
            'nonce' => time() * 1000 + random_int(100, 999),
            'paymentId' => (string) $order->public_number,
            'i' => $paymentSystemId ?? 0,
            'email' => $email,
            'ip' => request()?->ip() ?? '127.0.0.1',
            'amount' => round((float) $order->total, 2),
            'currency' => 'RUB',
        ];

        ksort($body);
        $body['signature'] = hash_hmac('sha256', implode('|', $body), $this->apiKey);

        $res = Http::timeout(20)->acceptJson()->asJson()
            ->post('https://api.fk.life/v1/orders/create', $body);

        if (!$res->ok()) {
            $msg = (string) ($res->json('message') ?? $res->body());
            Log::warning('Freekassa API create order failed', ['status' => $res->status(), 'body' => $msg]);
            throw new \RuntimeException("Freekassa API HTTP {$res->status()}: {$msg}");
        }

        $data = $res->json();
        $location = $data['location'] ?? null;
        if (!$location) {
            throw new \RuntimeException('Freekassa API не вернул location: ' . json_encode($data));
        }

        if (!empty($data['orderId']) && $order->payment) {
            $order->payment->update(['external_id' => (string) $data['orderId']]);
        }

        return (string) $location;
    }

    /** Проверка подписи вебхука. */
    public function verifyWebhookSignature(array $data): bool
    {
        $merchantId = $data['MERCHANT_ID'] ?? '';
        $amount = $data['AMOUNT'] ?? '';
        $orderId = $data['MERCHANT_ORDER_ID'] ?? '';
        $sign = strtolower((string) ($data['SIGN'] ?? ''));

        if ($merchantId !== $this->merchantId) {
            return false;
        }

        $expected = md5("{$merchantId}:{$amount}:{$this->secretWord2}:{$orderId}");
        if (!hash_equals($expected, $sign)) {
            Log::warning('Freekassa webhook: bad signature', [
                'expected' => $expected,
                'got' => $sign,
                'data' => $data,
            ]);
            return false;
        }
        return true;
    }

    public function isAllowedWebhookIp(string $ip): bool
    {
        return in_array($ip, self::WEBHOOK_ALLOWED_IPS, true);
    }

    /** Сохранить запись Payment до отправки пользователя на Freekassa. */
    public function recordPendingPayment(Order $order, string $paymentUrl, ?string $method = null): Payment
    {
        return Payment::create([
            'order_id' => $order->id,
            'provider' => 'freekassa',
            // Способ оплаты, выбранный покупателем на чекауте — надёжный источник.
            // Вебхук FK может уточнить его, но не затирает (см. PaymentWebhookController).
            'method' => $method,
            'amount' => $order->total,
            'currency' => $order->currency,
            'status' => 'pending',
            'redirect_url' => $paymentUrl,
        ]);
    }
}
