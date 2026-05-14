<?php

namespace App\Providers;

use App\Services\FreekassaGateway;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Contracts\Console\Kernel as ConsoleKernel;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Регистрируем singleton'ы для нашего слоя сервисов.
     * Laravel автоматически вызовет fromConfig() при первой инъекции FkwalletGateway.
     */
    public function register(): void
    {
        $this->app->singleton(FreekassaGateway::class, function () {
            return FreekassaGateway::fromConfig();
        });
    }

    public function boot(): void
    {
        // Laravel Scheduler: каждые 5 минут вызываем providers:auto-sync —
        // она внутри решает, кому пора синкаться по индивидуальным настройкам.
        // Лочки withoutOverlapping + onOneServer защищают от двойных запусков.
        if ($this->app->runningInConsole()) {
            $this->callAfterResolving(Schedule::class, function (Schedule $schedule) {
                $schedule->command('providers:auto-sync')
                    ->everyFiveMinutes()
                    ->withoutOverlapping(10)
                    ->runInBackground();

                // Проверка статусов withdrawal (Steam-пополнения и т.п.)
                $schedule->command('withdrawals:check-pending')
                    ->everyFiveMinutes()
                    ->withoutOverlapping(10)
                    ->runInBackground();

                // Добивание висящих Online Products (Telegram Звёзды и т.п. —
                // FK выдаёт их дольше, чем умеет ждать sync polling в FulfillViaApiJob).
                $schedule->command('op:check-pending')
                    ->everyMinute()
                    ->withoutOverlapping(2)
                    ->runInBackground();
            });
        }
    }
}
