<?php

namespace App\Services\Providers;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

/**
 * Скачивает картинки/файлы поставщиков (FK logo, help_image и т.п.) в наш storage,
 * чтобы карточка товара не зависела от CDN провайдера.
 *
 * Идемпотентный: имя файла = sha1(url) + расширение. Если файл уже есть на диске,
 * повторно не качаем — возвращаем готовый локальный URL.
 *
 * Хранилище — public-диск Laravel (`storage/app/public/`). Доступно через
 * `php artisan storage:link` по адресу `https://fk.market/storage/...`.
 */
class MediaDownloader
{
    public function __construct(
        protected string $disk = 'public',
        protected int $timeout = 30,
    ) {}

    /**
     * Скачивает $url, кладёт под providers/{namespace}/{2byte-shard}/{hash}.{ext}.
     *
     * @return string|null Локальный URL (вида /storage/providers/...) или null если не получилось.
     */
    public function download(string $url, string $namespace = 'misc'): ?string
    {
        $url = trim($url);
        if ($url === '' || !preg_match('~^https?://~i', $url)) return null;

        // Если URL уже наш (локальный) — ничего не качаем.
        $appUrl = (string) config('app.url');
        if ($appUrl && str_starts_with($url, rtrim($appUrl, '/') . '/storage/')) {
            return $url;
        }

        $storage = Storage::disk($this->disk);
        $hash = sha1($url);
        $shard = substr($hash, 0, 2);
        $ext = $this->detectExt($url) ?? 'bin';
        $path = "providers/{$namespace}/{$shard}/{$hash}.{$ext}";

        if ($storage->exists($path)) {
            return $storage->url($path);
        }

        try {
            $res = Http::timeout($this->timeout)
                ->withHeaders(['User-Agent' => 'fk.market media fetcher'])
                ->get($url);
            if (!$res->successful()) {
                Log::info('MediaDownloader: non-200', ['url' => $url, 'status' => $res->status()]);
                return null;
            }

            $body = $res->body();
            if ($body === '') return null;

            // Если расширение не угадали по URL, попробуем по Content-Type
            if ($ext === 'bin') {
                $ct = strtolower((string) $res->header('Content-Type'));
                $guessed = match (true) {
                    str_contains($ct, 'png') => 'png',
                    str_contains($ct, 'jpeg') || str_contains($ct, 'jpg') => 'jpg',
                    str_contains($ct, 'gif') => 'gif',
                    str_contains($ct, 'webp') => 'webp',
                    str_contains($ct, 'svg') => 'svg',
                    default => 'jpg',
                };
                $path = "providers/{$namespace}/{$shard}/{$hash}.{$guessed}";
                if ($storage->exists($path)) {
                    return $storage->url($path);
                }
            }

            $storage->put($path, $body);
            return $storage->url($path);
        } catch (\Throwable $e) {
            Log::warning('MediaDownloader failed', ['url' => $url, 'error' => $e->getMessage()]);
            return null;
        }
    }

    protected function detectExt(string $url): ?string
    {
        $pathPart = parse_url($url, PHP_URL_PATH);
        if (!$pathPart) return null;
        $ext = strtolower((string) pathinfo($pathPart, PATHINFO_EXTENSION));
        return in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'], true)
            ? ($ext === 'jpeg' ? 'jpg' : $ext)
            : null;
    }
}
