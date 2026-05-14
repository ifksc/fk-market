<?php

namespace App\Console\Commands;

use App\Models\ProductImage;
use App\Models\Provider;
use App\Services\Providers\MediaDownloader;
use Illuminate\Console\Command;

/**
 * php artisan providers:sync-media {provider=fkwallet} [--limit=N] [--dry]
 *
 * Идёт по product_images товаров провайдера, скачивает их с CDN провайдера
 * в наш storage и подменяет url на локальный.
 *
 * Идемпотентная: если файл уже скачан, MediaDownloader его не качает повторно.
 * Можно безопасно запускать в cron.
 */
class ProvidersSyncMediaCommand extends Command
{
    protected $signature = 'providers:sync-media {provider=fkwallet} {--limit=} {--dry}';
    protected $description = 'Локализовать картинки товаров провайдера (скачать с CDN провайдера в наш storage)';

    public function handle(MediaDownloader $downloader): int
    {
        $code = $this->argument('provider');
        $provider = Provider::where('code', $code)->first();
        if (!$provider) {
            $this->error("Provider [{$code}] не найден");
            return 1;
        }
        $limit = $this->option('limit') ? (int) $this->option('limit') : null;
        $dry = (bool) $this->option('dry');

        // Все product_images продуктов этого провайдера, у которых URL ещё внешний.
        $appUrl = rtrim((string) config('app.url'), '/');
        $query = ProductImage::whereHas('product', fn ($q) => $q->where('provider_id', $provider->id));

        // Внешние = не начинаются с нашего домена / не относительные /storage
        $query->where(function ($q) use ($appUrl) {
            $q->where('url', 'not like', '/storage/%');
            if ($appUrl) $q->where('url', 'not like', $appUrl . '/storage/%');
        });

        $total = (clone $query)->count();
        $effective = $limit ? min($limit, $total) : $total;
        $this->info("→ Картинок к скачиванию: {$total}" . ($limit ? " (обработаем {$effective})" : ''));

        if ($dry || $effective === 0) {
            $this->warn($dry ? 'DRY-RUN: выходим без записи' : 'Нечего скачивать');
            return 0;
        }

        $bar = $this->output->createProgressBar($effective);
        $bar->start();

        $ok = 0;
        $fail = 0;
        $namespace = "{$provider->code}/products";

        $query->orderBy('id')
            ->when($limit, fn ($q) => $q->limit($limit))
            ->chunk(50, function ($images) use ($downloader, $namespace, $bar, &$ok, &$fail) {
                foreach ($images as $img) {
                    $localUrl = $downloader->download($img->url, $namespace);
                    if ($localUrl) {
                        $img->update(['url' => $localUrl]);
                        $ok++;
                    } else {
                        $fail++;
                    }
                    $bar->advance();
                }
            });

        $bar->finish();
        $this->newLine(2);
        $this->info("✓ Локализовано: {$ok}");
        if ($fail > 0) $this->warn("⚠  Не удалось скачать: {$fail}");
        return 0;
    }
}
