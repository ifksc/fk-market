<?php

namespace App\Console\Commands;

use App\Models\FulfillmentTask;
use App\Models\OrderItem;
use App\Models\Provider;
use App\Services\Providers\FkwalletProductsGateway;
use Illuminate\Console\Command;

/**
 * php artisan withdrawals:check-pending {--timeout=30}
 *
 * Раз в 5 минут (через Laravel Schedule) проверяем все order_items
 * со status='in_progress' и provider_order_id у поставщика FK.
 *
 * Решения по статусам FK:
 *   • 1 → success → fulfillment_status=delivered, email
 *   • 8, 9, 10 → failed → fallback в manual (FulfillmentTask)
 *   • остальное → pending (ждём дальше)
 *
 * Если с момента создания заказа прошло больше --timeout минут (default 30) —
 * переводим в manual для разбора админом.
 */
class WithdrawalsCheckPendingCommand extends Command
{
    protected $signature = 'withdrawals:check-pending {--timeout=30}';
    protected $description = 'Проверить статусы pending withdrawal-заказов у поставщика';

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
                ->where('fulfillment_status', 'in_progress')
                ->whereNotNull('provider_order_id')
                ->whereHas('product', fn ($q) => $q->where('provider_id', $provider->id))
                ->with(['order', 'product'])
                ->get();

            if ($items->isEmpty()) {
                $this->line("[{$provider->code}] нет pending withdrawal");
                continue;
            }

            $this->info("[{$provider->code}] проверяем {$items->count()} заказов");

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
            $result = $gw->getWithdrawalStatus($providerOrderId);
            $status = isset($result['status']) ? (int) $result['status'] : null;

            if ($status === null) {
                $this->line("  #{$item->id} → нет статуса в ответе");
                return;
            }

            if (in_array($status, FkwalletProductsGateway::WITHDRAWAL_STATUS_SUCCESS, true)) {
                $amount = (float) ($item->params['amount'] ?? $item->price);
                $item->update([
                    'fulfillment_status' => 'delivered',
                    'delivered_payload' => "Steam пополнен на {$amount} ₽",
                    'delivered_at' => now(),
                ]);
                FulfillmentTask::where('order_item_id', $item->id)
                    ->update(['status' => 'done', 'result' => ['status' => $status], 'finished_at' => now()]);

                // Закрываем заказ если все позиции выданы
                $order = $item->order;
                if ($order && $order->items()->where('fulfillment_status', '!=', 'delivered')->doesntExist()) {
                    $order->update(['status' => 'completed', 'completed_at' => now()]);
                }
                $this->info("  #{$item->id} ✓ delivered (FK status={$status})");
                return;
            }

            if (in_array($status, FkwalletProductsGateway::WITHDRAWAL_STATUS_FAILED, true)) {
                $this->fallbackToManual($item, "FK withdrawal status={$status}");
                $this->warn("  #{$item->id} ✗ failed (FK status={$status})");
                return;
            }

            // Pending — смотрим на timeout
            $task = FulfillmentTask::where('order_item_id', $item->id)->first();
            $startedAt = $task?->started_at ?? $item->created_at;
            if ($startedAt && $startedAt->lt(now()->subMinutes($timeoutMin))) {
                $this->fallbackToManual($item, "Timeout {$timeoutMin} мин, FK status={$status}");
                $this->warn("  #{$item->id} ⏰ timeout (FK status={$status})");
                return;
            }

            $this->line("  #{$item->id} … pending (FK status={$status})");
        } catch (\Throwable $e) {
            $this->warn("  #{$item->id} ошибка: " . $e->getMessage());
        }
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
