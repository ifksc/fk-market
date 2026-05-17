<?php

namespace App\Jobs;

use App\Mail\OrderDeliveredMail;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\Product;
use App\Models\StockItem;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;

/**
 * Главный диспетчер выдачи. Запускается после оплаты.
 * Для каждой позиции в зависимости от fulfillment_mode:
 *   stock  → берём ключ из склада сразу здесь
 *   api    → диспатчим FulfillViaApiJob
 *   manual → ставим fulfillment_task в очередь админа
 */
class FulfillOrderJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $tries = 3;
    public int $backoff = 30;

    public function __construct(public int $orderId) {}

    public function handle(): void
    {
        $order = Order::with(['items.product'])->find($this->orderId);
        if (!$order) {
            Log::warning('FulfillOrderJob: order not found', ['order_id' => $this->orderId]);
            return;
        }

        // Выдаём оплаченные и уже выдаваемые заказы (последнее — чтобы refulfill
        // и ретраи дорабатывали невыданные позиции).
        if (!in_array($order->status, ['paid', 'fulfilling'], true)) {
            Log::info('FulfillOrderJob: заказ не в состоянии выдачи', ['order_id' => $order->id, 'status' => $order->status]);
            return;
        }

        // Переход paid→fulfilling атомарно: продажи учитываем только если именно
        // этот проход выиграл переход. Защита от двойного счёта sales_count при
        // повторном запуске job'а или refulfill.
        $claimedSale = Order::whereKey($order->id)
            ->where('status', 'paid')
            ->update(['status' => 'fulfilling']) === 1;

        if ($claimedSale) {
            foreach ($order->items as $item) {
                if ($item->product_id) {
                    Product::whereKey($item->product_id)->increment('sales_count', $item->qty);
                }
            }
        }

        foreach ($order->items as $item) {
            try {
                $this->fulfillItem($item);
            } catch (\Throwable $e) {
                Log::error('FulfillOrderJob item failed', [
                    'order_id' => $order->id,
                    'item_id' => $item->id,
                    'error' => $e->getMessage(),
                ]);
                $item->update(['fulfillment_status' => 'failed']);
            }
        }

        // Если все позиции уже delivered (например все stock-режимы), закрываем заказ
        if ($order->items()->where('fulfillment_status', '!=', 'delivered')->doesntExist()) {
            $order->update(['status' => 'completed', 'completed_at' => now()]);
        }

        // Email с тем что есть (api ещё может быть в обработке — придёт второй email потом если запустим повторно)
        try {
            Mail::to($order->email)->send(new OrderDeliveredMail($order->id));
        } catch (\Throwable $e) {
            Log::error('Email send failed', ['order_id' => $order->id, 'error' => $e->getMessage()]);
        }
    }

    private function fulfillItem(OrderItem $item): void
    {
        // Уже выданную позицию не трогаем — иначе повторный запуск или refulfill
        // спишет ещё один ключ со склада и перезапишет delivered_payload.
        if ($item->fulfillment_status === 'delivered') {
            return;
        }

        $product = $item->product;
        if (!$product) return;

        switch ($product->fulfillment_mode) {
            case 'stock':
                $this->fulfillFromStock($item);
                break;

            case 'api':
                // Диспатчим отдельный job — он ходит в внешний API с polling'ом
                $item->update(['fulfillment_status' => 'in_progress']);
                FulfillViaApiJob::dispatch($item->id);
                break;

            case 'manual':
                $this->createManualTask($item);
                break;
        }
    }

    private function fulfillFromStock(OrderItem $item): void
    {
        DB::transaction(function () use ($item) {
            $stock = StockItem::where('product_id', $item->product_id)
                ->where('is_sold', false)
                ->lockForUpdate()
                ->first();

            if (!$stock) {
                throw new \RuntimeException("Out of stock for product {$item->product_id}");
            }

            $stock->update([
                'is_sold' => true,
                'sold_order_id' => $item->order_id,
                'sold_at' => now(),
            ]);

            $item->update([
                'stock_item_id' => $stock->id,
                'delivered_payload' => $stock->payload,
                'fulfillment_status' => 'delivered',
                'delivered_at' => now(),
            ]);

            // Пересчитываем кэш остатка: stock_available должен соответствовать
            // реальному числу непроданных ключей.
            $remaining = StockItem::where('product_id', $item->product_id)
                ->where('is_sold', false)
                ->count();
            Product::whereKey($item->product_id)->update(['stock_available' => $remaining]);
        });
    }

    private function createManualTask(OrderItem $item): void
    {
        \App\Models\FulfillmentTask::updateOrCreate(
            ['order_item_id' => $item->id],
            [
                'mode' => 'manual',
                'provider_id' => $item->product?->provider_id,
                'status' => 'queued',
                'input_params' => $item->params,
                'deadline_at' => now()->addMinutes((int) (\App\Models\Setting::get('order_sla_minutes_manual', 240))),
            ],
        );
        $item->update(['fulfillment_status' => 'queued']);
    }
}
