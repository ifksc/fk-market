<?php

namespace App\Console\Commands;

use App\Models\Provider;
use App\Models\ProviderProduct;
use App\Services\Providers\ProductGrouper;
use Illuminate\Console\Command;

/**
 * php artisan providers:connect-all {provider=fkwallet}
 *   --status=active|draft    статус создаваемых товаров (default: draft)
 *   --limit=N                максимум сколько подключить за один прогон
 *   --dry                    без записи в БД (только посчитать)
 *
 * Идёт по unconnected provider_products поставщика и для каждого пытается
 * создать Product через ProductConnector. Те, для которых не хватает данных
 * (категория не зеркалирована или нет цены) — пропускаются и попадают в
 * итоговую таблицу skipped, чтобы админ мог разобраться руками.
 */
class ProvidersConnectAllCommand extends Command
{
    protected $signature = 'providers:connect-all {provider=fkwallet} {--status=draft} {--limit=} {--dry}';
    protected $description = 'Массово создать Product\'ы из каталога поставщика (1 leaf-категория = 1 Product, многотоварные категории дают variants)';

    public function handle(): int
    {
        $code = $this->argument('provider');
        $status = $this->option('status');
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;
        $dry = (bool) $this->option('dry');

        if (!in_array($status, ['draft', 'active'], true)) {
            $this->error("--status должен быть draft или active");
            return 1;
        }

        $provider = Provider::where('code', $code)->first();
        if (!$provider) {
            $this->error("Provider [{$code}] не найден");
            return 1;
        }

        // Считаем leaf-категории (без потомков с тем же провайдером)
        $total = \App\Models\Category::where('provider_id', $provider->id)
            ->whereDoesntHave('children', fn ($q) => $q->where('provider_id', $provider->id))
            ->count();
        $effective = $limit ? min($limit, $total) : $total;

        $this->info("→ Leaf-категорий FK: {$total}" . ($limit ? " (обработаем {$effective})" : ''));
        $this->info('  статус новых товаров: ' . $status . ($dry ? ' [DRY-RUN — БД не пишется]' : ''));

        if ($dry || $effective === 0) {
            $this->warn($dry ? 'DRY-RUN: выходим без записи' : 'Нечего подключать');
            return 0;
        }

        $progress = $this->output->createProgressBar($effective);
        $progress->start();

        $result = ProductGrouper::default()->groupAll($provider, [
            'status' => $status,
            'limit' => $limit,
            'onProgress' => function () use ($progress) { $progress->advance(); },
        ]);

        $progress->finish();
        $this->newLine(2);

        $this->info("✓ Создано Product'ов: {$result['created']}");
        if ($result['skipped'] > 0) {
            $this->warn("⚠  Пропущено: {$result['skipped']} категорий");
            $this->newLine();
            $rows = array_map(
                fn ($r) => [
                    $r['external_id'],
                    mb_strimwidth($r['name'], 0, 60, '…'),
                    $r['reason'],
                ],
                array_slice($result['skipped_items'], 0, 50),
            );
            $this->table(['ref', 'категория', 'причина'], $rows);
            if (count($result['skipped_items']) > 50) {
                $this->line('  ... и ещё ' . (count($result['skipped_items']) - 50) . ' (показаны первые 50)');
            }
        }

        return 0;
    }
}
