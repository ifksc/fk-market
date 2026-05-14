<?php

namespace App\Console\Commands;

use App\Models\FulfillmentTask;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Provider;
use App\Services\Providers\FkwalletProductsGateway;
use Illuminate\Console\Command;

/**
 * php artisan op:check-pending {--timeout=240}
 *
 * Раз в минуту (через Laravel Schedule) добиваем все order_items, у которых:
 *   • есть provider_order_id у поставщика FKwallet
 *   • fulfillment_status ∈ {in_progress, queued} (queued = упало в ручную после polling timeout)
 *
 * Числовые статусы FK для Online Products:
 *   • 1                 → success → если есть coupon_code — отдаём; если нет (топап
 *                          типа Telegram Звёзд) — помечаем «доставлено напрямую»
 *   • 8, 9, 10          → failed → manual для разбора админом
 *   • остальное (0,2…)  → pending (ждём дальше, до --timeout минут с начала)
 *
 * Это бэкап-механизм для polling в FulfillViaApiJob, который у некоторых товаров
 * (Telegram Звёзды и т.п.) истекает быстрее, чем FK успевает их выдать.
 */
class OpCheckPendingCommand extends Command
{
    protected $signature = 'op:check-pending {--timeout=240}';
    protected $description = 'Проверить статусы pending OP-заказов у FKwallet и добить выдачу';

    public function handle(): int
    {
        $timeoutMin = (int) $this->option('timeout');
        $providers = Provider::where('code', 'fkwallet')->where('is_enabled', true)->get();
        if ($providers->isEmpty()) {
            $this->line('Нет включённых fkwallet-поставщиков');
            return 0;
        }

        foreach ($providers as $provider) {
            $gateway = FkwalletProductsGateway::fromConfig($provider->id);

            $items = OrderItem::query()
                ->whereIn('fulfillment_status', ['in_progress', 'queued'])
                ->whereNotNull('provider_order_id')
                ->whereHas('product', fn ($q) => $q->where('provider_id', $provider->id))
                ->with(['order', 'product'])
                ->get();

            if ($items->isEmpty()) {
                continue;
            }

            $this->info("[{$provider->code}] проверяем {$items->count()} OP-заказов");

            foreach ($items as $item) {
                $this->checkOne($gateway, $item, $timeoutMin);
            }
        }

        return 0;
    }

    protected function checkOne(FkwalletProductsGateway $gw, OrderItem $item, int $timeoutMin): void
    {
        $providerOrderId = (int) $item->provider_order_id;
        if (!$providerOrderId) return;

        try {
            $result = $gw->getStatus($providerOrderId);
            $rawStatus = $result['status'] ?? null;
            $couponCode = $result['coupon_code'] ?? null;
            $stateClass = $this->classify($rawStatus);

            if ($stateClass === 'success') {
                $payload = $couponCode ?: "Доставлено напрямую (FK order {$providerOrderId})";
                $item->update([
                    'fulfillment_status' => 'delivered',
                    'delivered_payload' => (string) $payload,
                    'delivered_at' => now(),
                ]);
                FulfillmentTask::where('order_item_id', $item->id)
                    ->update(['status' => 'done', 'result' => ['provider_order_id' => $providerOrderId, 'has_coupon' => (bool) $couponCode], 'finished_at' => now()]);

                $order = $item->order;
                if ($order && $order->items()->where('fulfillment_status', '!=', 'delivered')->doesntExist()) {
                    $order->update(['status' => 'completed', 'completed_at' => now()]);
                }
                $this->info("  #{$item->id} ✓ delivered (FK status={$rawStatus})");
                return;
            }

            if ($stateClass === 'failed') {
                $this->fallbackToManual($item, "FK OP status={$rawStatus}");
                $this->warn("  #{$item->id} ✗ failed (FK status={$rawStatus})");
                return;
            }

            // Pending — timeout
            $task = FulfillmentTask::where('order_item_id', $item->id)->first();
            $startedAt = $task?->started_at ?? $item->created_at;
            if ($startedAt && $startedAt->lt(now()->subMinutes($timeoutMin))) {
                $this->fallbackToManual($item, "Timeout {$timeoutMin} мин, FK OP status={$rawStatus}");
                $this->warn("  #{$item->id} ⏰ timeout (FK status={$rawStatus})");
                return;
            }

            $this->line("  #{$item->id} … pending (FK status={$rawStatus})");
        } catch (\Throwable $e) {
            $this->warn("  #{$item->id} ошибка: " . $e->getMessage());
        }
    }

    protected function classify($raw): string
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

    protected function fallbackToManual(OrderItem $item, string $reason): void
    {
        FulfillmentTask::updateOrCreate(
            ['order_item_id' => $item->id],
            [
                'mode' => 'manual',
                'provider_id' => $item->product->provider_id,
                'status' => 'queued',
                'input_params' => $item->params,
                'error_text' => mb_substr($reason, 0, 500),
                'deadline_at' => now()->addMinutes(240),
                'started_at' => null,
                'finished_at' => null,
            ],
        );
        $item->update(['fulfillment_status' => 'queued']);
    }
}
