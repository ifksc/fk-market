<?php

namespace App\Console\Commands;

use App\Services\PriceRecomputer;
use Illuminate\Console\Command;

/**
 * php artisan pricing:recompute
 *   --provider=ID  только товары конкретного провайдера
 *   --category=ID  только указанная категория
 *
 * Пересчитывает price_final + variants[*].price у всех Product'ов
 * по текущим pricing_rules. Используется после правки наценок,
 * чтобы не пересохранять каждый товар руками.
 */
class PricingRecomputeCommand extends Command
{
    protected $signature = 'pricing:recompute {--provider=} {--category=}';
    protected $description = 'Пересчитать цены всех товаров по текущим pricing_rules';

    public function handle(PriceRecomputer $recomputer): int
    {
        $providerId = $this->option('provider') ? (int) $this->option('provider') : null;
        $categoryId = $this->option('category') ? (int) $this->option('category') : null;

        $this->info('→ Пересчитываю цены...');
        $fromId = null;
        $totalScanned = 0;
        $totalUpdated = 0;
        for ($pass = 0; $pass < 1000; $pass++) {
            $stats = $recomputer->recomputeAll([
                'from_id' => $fromId,
                'limit' => 500,
                'provider_id' => $providerId,
                'category_id' => $categoryId,
            ]);
            $totalScanned += $stats['scanned'];
            $totalUpdated += $stats['updated'];
            $fromId = $stats['last_id'];
            $this->line("  batch #" . ($pass + 1) . ": +{$stats['scanned']} (изменилось +{$stats['updated']})");
            if ($stats['done']) break;
        }
        $this->info("✓ Обработано: {$totalScanned}, изменилось: {$totalUpdated}");
        return 0;
    }
}
