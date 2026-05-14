<?php

namespace App\Jobs;

use App\Models\FulfillmentTask;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Provider;
use App\Services\Providers\FkwalletProductsGateway;
use App\Services\Providers\ProviderGateway;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;

/**
 * Выдача товара через API поставщика.
 *
 * Поток:
 *   1. Validate (бесплатная проверка возможности)
 *   2. Create → если coupon_code сразу пришёл, готово
 *   3. Иначе — polling /status с backoff (5/10/20/40/60/60/60/60/60 сек, ~5.5 мин)
 *   4. coupon_code → пишем в order_item.delivered_payload, ставим delivered
 *   5. Любая ошибка → fallback в manual (если включён) или failed
 *
 * Все вызовы провайдера логируются в provider_logs (через сам gateway).
 */
class FulfillViaApiJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 1;        // ретрай делаем сами через polling
    public int $timeout = 600;    // 10 мин на всё

    public function __construct(public int $orderItemId) {}

    public function handle(): void
    {
        $item = OrderItem::with(['product', 'order'])->find($this->orderItemId);
        if (!$item || !$item->product || $item->product->fulfillment_mode !== 'api') {
            Log::warning('FulfillViaApiJob: item не подходит', ['order_item_id' => $this->orderItemId]);
            return;
        }
        if ($item->fulfillment_status === 'delivered') return; // уже выдано

        $product = $item->product;
        $provider = $product->provider_id ? Provider::find($product->provider_id) : null;

        if (!$provider || !$provider->is_enabled) {
            $this->fallbackToManual($item, 'Поставщик отключён или не настроен');
            return;
        }

        $task = FulfillmentTask::firstOrCreate(
            ['order_item_id' => $item->id],
            [
                'mode' => 'api',
                'provider_id' => $provider->id,
                'status' => 'in_progress',
                'input_params' => $item->params,
                'started_at' => now(),
                'deadline_at' => now()->addMinutes(10),
            ],
        );
        if ($task->status !== 'in_progress') {
            $task->update(['status' => 'in_progress', 'started_at' => $task->started_at ?? now()]);
        }

        try {
            $gateway = $this->makeGateway($provider);
            $idempotenceKey = ($item->order->public_number ?? 'NO-ORDER') . '-' . $item->id;

            // Топап (amount_input) — отдельная ветка: withdrawal, без коупона.
            // Polling статуса делает отдельный cron-таск; здесь только запрос.
            if ($this->isTopupProduct($product)) {
                $this->dispatchWithdrawal($gateway, $idempotenceKey, $item, $task);
                return;
            }

            // Определяем external_id:
            //   • Если у Product одиночный provider_external_id — берём его.
            //   • Если null (Product групповой) — ищем по variant_select в required_params:
            //       пользователь выбрал label в чекауте → params.variant
            //       находим вариант с этим label → его external_id.
            $externalId = $this->resolveExternalId($product, $item->params);
            if (!$externalId) {
                throw new \RuntimeException('Не удалось определить external_id (variant не выбран или нет соответствия)');
            }

            // FK fields — без нашего variant (он internal).
            $fields = $this->prepareFields($item->params, $product->required_params);

            // 1. Validate
            $ok = $gateway->validate($idempotenceKey, $externalId, (float) $item->price, $fields);
            if (!$ok) {
                throw new \RuntimeException('Provider validate() returned false (товара нет в наличии или параметры не подходят)');
            }

            // 2. Create
            $result = $gateway->order($idempotenceKey, $externalId, (float) $item->price, $fields);
            $providerOrderId = isset($result['id']) ? (int) $result['id'] : null;
            $couponCode = $result['coupon_code'] ?? null;

            if ($providerOrderId) {
                $item->update(['provider_order_id' => (string) $providerOrderId]);
            }

            if ($couponCode) {
                $this->deliver($item, $task, (string) $couponCode, $providerOrderId);
                return;
            }

            // 3. Polling
            if (!$providerOrderId) {
                throw new \RuntimeException('Provider не вернул order_id и не вернул coupon_code');
            }
            $this->pollUntilDone($gateway, $providerOrderId, $item, $task);
        } catch (\Throwable $e) {
            Log::warning('FulfillViaApiJob failed', [
                'order_item_id' => $item->id,
                'error' => $e->getMessage(),
            ]);
            $task->update([
                'status' => 'failed',
                'error_text' => mb_substr($e->getMessage(), 0, 500),
                'finished_at' => now(),
            ]);
            $this->fallbackToManual($item, $e->getMessage());
        }
    }

    protected function makeGateway(Provider $provider): ProviderGateway
    {
        return match ($provider->code) {
            'fkwallet' => FkwalletProductsGateway::fromConfig($provider->id),
            default => throw new \RuntimeException("Нет gateway для [{$provider->code}]"),
        };
    }

    protected function pollUntilDone(ProviderGateway $gw, int $providerOrderId, OrderItem $item, FulfillmentTask $task): void
    {
        $delays = [5, 10, 20, 40, 60, 60, 60, 60, 60]; // ~5.5 мин суммарно
        foreach ($delays as $delay) {
            sleep($delay);
            $status = $gw->getStatus($providerOrderId);
            $couponCode = $status['coupon_code'] ?? null;

            // FK возвращает числовой статус для OP: 1 = success, [0,2,3,4,5,11] = pending,
            // [8,9,10] = failed. Также может прийти строковый ("completed", "failed" и т.п.).
            $rawStatus = $status['status'] ?? null;
            $stateClass = $this->classifyStatus($rawStatus);

            if ($stateClass === 'success') {
                // Для товаров с купоном — отдаём купон. Для топап-выдач (Telegram звёзды,
                // прямая выдача на аккаунт) coupon_code остаётся null, помечаем как доставленное.
                $payload = $couponCode ?: "Доставлено напрямую (FK order {$providerOrderId})";
                $this->deliver($item, $task, $payload, $providerOrderId);
                return;
            }
            if ($stateClass === 'failed') {
                throw new \RuntimeException("FK status={$rawStatus}, без coupon_code");
            }
            // pending — продолжаем polling
        }
        // Timeout не считаем фатальным — отдадим заказ на дополнение через cron op:check-pending.
        throw new \RuntimeException('Polling timeout: 5+ минут без финального статуса (будет добит cron op:check-pending)');
    }

    /** Возвращает 'success' | 'failed' | 'pending'. */
    protected function classifyStatus($raw): string
    {
        if (is_numeric($raw)) {
            $n = (int) $raw;
            if (in_array($n, [1], true)) return 'success';
            if (in_array($n, [8, 9, 10], true)) return 'failed';
            return 'pending';
        }
        $s = strtolower((string) $raw);
        if (in_array($s, ['ok', 'success', 'completed', 'paid', 'delivered'], true)) return 'success';
        if (in_array($s, ['failed', 'cancelled', 'error', 'rejected'], true)) return 'failed';
        return 'pending';
    }

    protected function deliver(OrderItem $item, FulfillmentTask $task, string $couponCode, ?int $providerOrderId): void
    {
        $item->update([
            'fulfillment_status' => 'delivered',
            'delivered_payload' => $couponCode,
            'delivered_at' => now(),
        ]);
        $task->update([
            'status' => 'done',
            'result' => ['provider_order_id' => $providerOrderId, 'has_coupon' => true],
            'finished_at' => now(),
        ]);

        // Закрываем заказ если все позиции выданы
        $order = $item->order ?? Order::find($item->order_id);
        if ($order && $order->items()->where('fulfillment_status', '!=', 'delivered')->doesntExist()) {
            $order->update(['status' => 'completed', 'completed_at' => now()]);
        }
    }

    protected function fallbackToManual(OrderItem $item, string $reason): void
    {
        $product = $item->product;
        if ($product && $product->fulfillment_fallback === 'manual') {
            FulfillmentTask::updateOrCreate(
                ['order_item_id' => $item->id],
                [
                    'mode' => 'manual',
                    'provider_id' => $product->provider_id,
                    'status' => 'queued',
                    'input_params' => $item->params,
                    'error_text' => "API упал: {$reason}",
                    'deadline_at' => now()->addMinutes(240),
                    'started_at' => null,
                    'finished_at' => null,
                ],
            );
            $item->update(['fulfillment_status' => 'queued']);
        } else {
            $item->update(['fulfillment_status' => 'failed']);
        }
    }

    /**
     * Превращает order_item.params в массив {key,value} для FK API.
     * Исключает ключи, которые являются «внутренними» (variant_select),
     * — они не должны улетать в FK.
     */
    protected function prepareFields(?array $itemParams, ?array $requiredParams): array
    {
        if (!$itemParams) return [];

        $internalKeys = [];
        foreach ($requiredParams ?? [] as $p) {
            if (($p['type'] ?? '') === 'variant_select') {
                $internalKeys[] = $p['name'] ?? 'variant';
            }
        }

        $fields = [];
        foreach ($itemParams as $key => $value) {
            if (in_array((string) $key, $internalKeys, true)) continue;
            $fields[] = ['key' => (string) $key, 'value' => (string) $value];
        }
        return $fields;
    }

    /**
     * Извлекает FK external_id для выдачи.
     *
     * Кейсы:
     *   1) У Product есть provider_external_id — используем его.
     *   2) У Product variant_select в required_params:
     *      берём params[variant], ищем вариант с label = это значение,
     *      возвращаем его external_id.
     */
    /** Топап-товар: динамическая сумма, withdrawal вместо op/create. */
    protected function isTopupProduct($product): bool
    {
        foreach ($product->required_params ?? [] as $p) {
            if (($p['type'] ?? '') === 'amount_input') return true;
        }
        return false;
    }

    /**
     * Делает withdrawal в FK для топап-товара. После запроса сохраняем
     * provider_order_id и переводим item в in_progress. Опрос статуса делает
     * отдельная команда withdrawals:check-pending (cron каждые 5 мин).
     */
    protected function dispatchWithdrawal(\App\Services\Providers\FkwalletProductsGateway $gateway, string $idempotenceKey, OrderItem $item, FulfillmentTask $task): void
    {
        $params = $item->params ?? [];
        $amount = (float) ($params['amount'] ?? 0);
        $login = (string) ($params['steam_login'] ?? '');

        // Находим payment_system_id (для Steam — 10) из required_params
        $paymentSystemId = 10;
        foreach ($item->product->required_params ?? [] as $p) {
            if (($p['type'] ?? '') === 'amount_input' && isset($p['payment_system_id'])) {
                $paymentSystemId = (int) $p['payment_system_id'];
                break;
            }
        }

        if ($amount <= 0 || $login === '') {
            $task->update(['status' => 'failed', 'error_text' => 'Нет amount/account', 'finished_at' => now()]);
            $this->fallbackToManual($item, 'Пустой amount или steam_login');
            return;
        }

        $result = $gateway->withdrawal($idempotenceKey, $amount, $login, $paymentSystemId, [
            'order_id' => (int) $item->id,
            'description' => 'fk.market #' . ($item->order->public_number ?? $item->id),
        ]);

        $providerOrderId = isset($result['id']) ? (int) $result['id'] : null;
        $status = isset($result['status']) ? (int) $result['status'] : null;

        if (!$providerOrderId) {
            throw new \RuntimeException('FK withdrawal не вернул id');
        }

        $item->update([
            'provider_order_id' => (string) $providerOrderId,
            'fulfillment_status' => 'in_progress',
        ]);
        $task->update([
            'status' => in_array($status, \App\Services\Providers\FkwalletProductsGateway::WITHDRAWAL_STATUS_SUCCESS, true)
                ? 'done' : 'in_progress',
            'result' => ['provider_order_id' => $providerOrderId, 'status' => $status],
        ]);

        // Если FK сразу вернул success — сразу же deliverим (редко, но бывает)
        if (in_array($status, \App\Services\Providers\FkwalletProductsGateway::WITHDRAWAL_STATUS_SUCCESS, true)) {
            $this->deliver($item, $task, "Steam пополнен на {$amount} ₽", $providerOrderId);
        }
    }

    protected function resolveExternalId($product, ?array $itemParams): ?int
    {
        if (!empty($product->provider_external_id)) {
            return (int) $product->provider_external_id;
        }

        foreach ($product->required_params ?? [] as $p) {
            if (($p['type'] ?? '') !== 'variant_select') continue;
            $key = $p['name'] ?? 'variant';
            $chosenLabel = $itemParams[$key] ?? null;
            if (!$chosenLabel) return null;
            foreach ($p['variants'] ?? [] as $v) {
                if (($v['label'] ?? null) === $chosenLabel) {
                    return isset($v['external_id']) ? (int) $v['external_id'] : null;
                }
            }
        }

        return null;
    }
}
