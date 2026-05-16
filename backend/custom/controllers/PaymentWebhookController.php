<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Jobs\FulfillOrderJob;
use App\Models\Order;
use App\Services\FreekassaGateway;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

/**
 * POST /api/payments/fkwallet/webhook
 *
 * Free-Kassa дёргает этот URL после успешной оплаты.
 * Параметры (POST form-data):
 *   MERCHANT_ID, AMOUNT, intid, MERCHANT_ORDER_ID, P_EMAIL, P_PHONE, CUR_ID, SIGN, ...
 *
 * Если подпись правильная и сумма сходится — отдаём YES (FK так требует).
 * Иначе — что-то иное (не "YES").
 */
class PaymentWebhookController extends Controller
{
    public function __invoke(Request $request, FreekassaGateway $fk): Response
    {
        $data = $request->all();

        // Health-check: FK при сохранении URL в кабинете и/или клик по «Проверить URL»
        // приходит без MERCHANT_ID. Должны вернуть ровно «YES», иначе FK считает URL невалидным.
        if (empty($data['MERCHANT_ID'])) {
            return response('YES');
        }

        // Определяем реальный IP клиента. Сервер за Cloudflare → request->ip() даст
        // адрес CF, поэтому смотрим заголовки в порядке надёжности.
        $clientIp = $request->header('CF-Connecting-IP')
            ?? $request->header('X-Real-IP')
            ?? trim(explode(',', (string) $request->header('X-Forwarded-For', ''))[0])
            ?: $request->ip();

        Log::info('Freekassa webhook received', [
            'client_ip' => $clientIp,
            'remote_ip' => $request->ip(),
            'data' => $data,
        ]);

        // 0. IP whitelist — FK ходит с конкретных адресов.
        if (!$fk->isAllowedWebhookIp($clientIp)) {
            Log::warning('Freekassa webhook from disallowed IP', [
                'client_ip' => $clientIp,
                'headers' => [
                    'cf-connecting-ip' => $request->header('CF-Connecting-IP'),
                    'x-real-ip' => $request->header('X-Real-IP'),
                    'x-forwarded-for' => $request->header('X-Forwarded-For'),
                ],
            ]);
            return response('disallowed', 403);
        }

        // 1. Проверка подписи
        if (!$fk->verifyWebhookSignature($data)) {
            return response('bad signature', 400);
        }

        // 2. Поиск заказа
        $publicNumber = (string) ($data['MERCHANT_ORDER_ID'] ?? '');
        $order = Order::where('public_number', $publicNumber)->first();

        if (!$order) {
            Log::warning('FKwallet webhook: order not found', ['public_number' => $publicNumber]);
            return response('order not found', 404);
        }

        // 3. Проверка суммы — сравниваем как числа (FK может прислать "61", у нас "61.00").
        // Допускаем погрешность в 1 копейку из-за округлений.
        $expectedAmount = round((float) $order->total, 2);
        $receivedAmount = round((float) ($data['AMOUNT'] ?? 0), 2);
        if (abs($expectedAmount - $receivedAmount) > 0.01) {
            Log::warning('Freekassa webhook: amount mismatch', [
                'expected' => $expectedAmount,
                'got' => $receivedAmount,
            ]);
            return response('amount mismatch', 400);
        }

        // 4. Идемпотентность: если уже paid — отвечаем YES без повторных действий
        if ($order->status === 'paid' || $order->status === 'completed') {
            return response('YES');
        }

        // 5. Меняем статус и создаём задачу выдачи
        $order->update([
            'status' => 'paid',
            'paid_at' => now(),
        ]);

        // Канонический платёж заказа. Раньше тут было $order->payment без связи
        // payment() в модели — блок молча пропускался, платёж не обновлялся.
        $payment = $order->payment ?? $order->payments()->latest('id')->first();
        if ($payment) {
            $payment->update([
                'status' => 'paid',
                'paid_at' => now(),
                'provider_payment_id' => (string) ($data['intid'] ?? null),
                // Не затираем способ, выбранный покупателем на чекауте;
                // detectMethod — только fallback, если он не был сохранён.
                'method' => $payment->method ?: self::detectMethod($data),
                'raw_response' => $data,
            ]);
        }

        // 6. Запускаем выдачу в очереди
        FulfillOrderJob::dispatch($order->id);

        // FK требует ответ "YES" чтобы пометить заказ оплаченным у себя
        return response('YES');
    }

    /**
     * GET /api/payments/fkwallet/check — простой эндпоинт для проверки
     * статуса заказа фронтом после возврата с платёжки.
     */
    public function check(Request $request): \Illuminate\Http\JsonResponse
    {
        $data = $request->validate([
            'order' => ['required', 'string', 'max:32'],
        ]);

        $order = Order::where('public_number', $data['order'])->firstOrFail();

        return response()->json([
            'data' => [
                'public_number' => $order->public_number,
                'status' => $order->status,
                'total' => (float) $order->total,
                'email' => $order->email,
                'paid_at' => $order->paid_at?->toIso8601String(),
                'items' => $order->items->map(fn ($item) => [
                    'product_id' => $item->product_id,
                    'product_name' => $item->product?->name,
                    'qty' => $item->qty,
                    'price' => (float) $item->price,
                    'fulfillment_status' => $item->fulfillment_status,
                    'delivered_payload' => $item->fulfillment_status === 'delivered'
                        ? $item->delivered_payload
                        : null,
                    'delivered_at' => $item->delivered_at?->toIso8601String(),
                ]),
            ],
        ]);
    }

    private static function detectMethod(array $data): ?string
    {
        $payerType = strtolower((string) ($data['payer_account'] ?? $data['method'] ?? ''));
        if (str_contains($payerType, 'card')) return 'card';
        if (str_contains($payerType, 'sbp')) return 'sbp';
        if (str_contains($payerType, 'crypto')) return 'crypto';
        return null;
    }
}
