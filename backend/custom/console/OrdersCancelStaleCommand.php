<?php

namespace App\Console\Commands;

use App\Models\Order;
use Illuminate\Console\Command;

/**
 * php artisan orders:cancel-stale {--hours=12}
 *
 * Авто-отмена неоплаченных заказов: всё, что висит в статусе `pending`
 * дольше N часов (по умолчанию 12), переводится в `cancelled`.
 * Запускается по расписанию (см. AppServiceProvider::boot).
 *
 * Безопасно для mass-update: у `pending`-заказов ничего не выдано и склад
 * не зарезервирован — побочных эффектов нет.
 */
class OrdersCancelStaleCommand extends Command
{
    protected $signature = 'orders:cancel-stale {--hours=12}';
    protected $description = 'Отменяет неоплаченные заказы (pending) старше N часов';

    public function handle(): int
    {
        $hours = max(1, (int) $this->option('hours'));
        $cutoff = now()->subHours($hours);

        $count = Order::where('status', 'pending')
            ->where('created_at', '<', $cutoff)
            ->update(['status' => 'cancelled']);

        $this->info("Отменено просроченных заказов (старше {$hours} ч): {$count}");

        return self::SUCCESS;
    }
}
