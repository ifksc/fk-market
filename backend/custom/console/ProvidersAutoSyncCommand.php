<?php

namespace App\Console\Commands;

use App\Models\Provider;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

/**
 * php artisan providers:auto-sync
 *
 * Идёт по всем enabled провайдерам, у которых settings.auto_sync_enabled = true,
 * и запускает providers:sync, если с момента last_sync_at прошло >= interval_minutes.
 *
 * Эта команда вызывается из Laravel Scheduler каждые 5 минут — а уже сама команда
 * решает, кому пора синкаться, по индивидуальным настройкам поставщика.
 */
class ProvidersAutoSyncCommand extends Command
{
    protected $signature = 'providers:auto-sync';
    protected $description = 'Запустить sync для тех поставщиков, у которых пришло время по их настройкам';

    public function handle(): int
    {
        $providers = Provider::where('is_enabled', true)->get();
        if ($providers->isEmpty()) {
            $this->line('Нет включённых поставщиков');
            return 0;
        }

        foreach ($providers as $provider) {
            $settings = $provider->settings ?? [];
            $enabled = (bool) ($settings['auto_sync_enabled'] ?? false);
            if (!$enabled) {
                $this->line("[{$provider->code}] auto_sync выключен");
                continue;
            }

            $intervalMinutes = max(5, (int) ($settings['auto_sync_interval_minutes'] ?? 60));
            $lastSync = $provider->last_sync_at;
            $due = !$lastSync || $lastSync->lte(now()->subMinutes($intervalMinutes));

            if (!$due) {
                $minutesAgo = $lastSync ? (int) $lastSync->diffInMinutes(now()) : null;
                $this->line("[{$provider->code}] недавно синкан ({$minutesAgo} мин назад, интервал {$intervalMinutes}) — пропускаем");
                continue;
            }

            $this->info("[{$provider->code}] sync запущен (интервал {$intervalMinutes} мин)");
            try {
                $this->call('providers:sync', ['provider' => $provider->code, '--trigger' => 'cron']);
            } catch (\Throwable $e) {
                $this->warn("[{$provider->code}] ошибка: " . $e->getMessage());
            }
        }

        return 0;
    }
}
