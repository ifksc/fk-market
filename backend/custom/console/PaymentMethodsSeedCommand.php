<?php

namespace App\Console\Commands;

use App\Models\PaymentMethod;
use Illuminate\Console\Command;

/**
 * php artisan payment-methods:seed
 *
 * Создаёт базовые методы оплаты, если их ещё нет. Идемпотентная — повторный
 * запуск ничего не ломает, существующие записи не перетирает.
 *
 * FK IDs соответствуют стандартным значениям FreeKassa (могут отличаться
 * у разных мерчантов — поправить в админке /admin/payment-methods).
 */
class PaymentMethodsSeedCommand extends Command
{
    protected $signature = 'payment-methods:seed';
    protected $description = 'Заполнить таблицу payment_methods стандартными методами';

    public function handle(): int
    {
        $seed = [
            ['code' => 'card',   'name' => 'Банковская карта', 'description' => 'Visa, MasterCard, МИР',     'icon' => 'credit-card',   'fk_id' => 4,  'sort_order' => 10],
            ['code' => 'sbp',    'name' => 'СБП',              'description' => 'QR-код или перевод',         'icon' => 'qr-code',       'fk_id' => 42, 'sort_order' => 20],
            ['code' => 'wallet', 'name' => 'FKwallet-кошелёк', 'description' => 'Внутренний баланс',          'icon' => 'wallet',        'fk_id' => 6,  'sort_order' => 30],
            ['code' => 'crypto', 'name' => 'Криптовалюта',     'description' => 'USDT, BTC, ETH',             'icon' => 'bitcoin',       'fk_id' => 24, 'sort_order' => 40],
        ];

        foreach ($seed as $row) {
            $pm = PaymentMethod::firstOrCreate(['code' => $row['code']], $row + ['is_enabled' => true]);
            $this->line(($pm->wasRecentlyCreated ? '+ ' : '· ') . $pm->code . ' — ' . $pm->name);
        }

        $this->info('Готово. Перейди в /admin/payment-methods чтобы донастроить.');
        return 0;
    }
}
