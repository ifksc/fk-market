<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Models\Provider;
use App\Models\ProviderProduct;
use App\Models\ProviderSyncRun;
use App\Services\Providers\FkwalletProductsGateway;
use App\Services\Providers\MediaDownloader;
use App\Services\Providers\ProductGrouper;
use App\Services\Providers\ProductRefresher;
use Illuminate\Console\Command;

/**
 * php artisan providers:sync [provider_code]
 *   --category=ID   только одна категория поставщика
 *   --dry           без записи в БД
 *
 * Запускается:
 *   • вручную из консоли
 *   • из админки (кнопка "Синхронизировать")
 *   • по cron'у (раз в час, добавим в schedule)
 */
class ProvidersSyncCommand extends Command
{
    protected $signature = 'providers:sync {provider=fkwallet} {--category=} {--dry} {--no-refresh} {--trigger=manual}';
    protected $description = 'Синхронизировать каталог поставщика товаров в provider_products';

    public function handle(): int
    {
        $code = $this->argument('provider');
        $provider = Provider::where('code', $code)->first();
        if (!$provider) {
            $this->error("Provider [{$code}] не найден");
            return 1;
        }
        if (!$provider->is_enabled) {
            $this->warn("Provider [{$code}] выключен (is_enabled=false)");
            return 0;
        }

        $gateway = match ($provider->code) {
            'fkwallet' => FkwalletProductsGateway::fromConfig($provider->id),
            default => null,
        };
        if (!$gateway) {
            $this->error("Нет реализации gateway для [{$code}]");
            return 1;
        }

        $dry = (bool) $this->option('dry');

        // Создаём запись о запуске (только если не dry-run)
        $run = null;
        if (!$dry) {
            $trigger = in_array($this->option('trigger'), ['cron', 'manual', 'api'], true)
                ? $this->option('trigger') : 'manual';
            $run = ProviderSyncRun::create([
                'provider_id' => $provider->id,
                'trigger' => $trigger,
                'status' => 'running',
                'started_at' => now(),
            ]);
        }

        $this->info("→ Получаю категории {$code}...");
        try {
            $categories = $gateway->listCategories();
        } catch (\Throwable $e) {
            $provider->update(['status' => 'error', 'last_error_at' => now(), 'last_error_text' => $e->getMessage()]);
            $run?->update(['status' => 'error', 'finished_at' => now(), 'error_text' => mb_substr($e->getMessage(), 0, 1000)]);
            $this->error("Ошибка получения категорий: {$e->getMessage()}");
            return 1;
        }
        $this->info('  категорий: ' . count($categories));

        if (!$dry) {
            $provider->update([
                'settings' => array_merge($provider->settings ?? [], ['categories_cache' => $categories]),
            ]);
        }

        // Зеркалим дерево категорий FK в нашу таблицу categories.
        // externalId (FK) → local categories.id — нужно для:
        //   1) суджеста при подключении товара
        //   2) корректного parent_id во втором проходе
        $externalToLocal = $dry ? [] : $this->syncCategoryTree($provider->id, $categories);

        $catFilter = $this->option('category');
        $cats = $catFilter
            ? array_values(array_filter($categories, fn ($c) => (int) ($c['id'] ?? 0) === (int) $catFilter))
            : $categories;

        $totalAdded = 0;
        $totalUpdated = 0;
        $now = now();

        foreach ($cats as $cat) {
            $catId = (int) ($cat['id'] ?? 0);
            if (!$catId) continue;

            $this->info("  → {$cat['name_ru']} (#{$catId})");
            try {
                $products = $gateway->listProducts($catId);
            } catch (\Throwable $e) {
                $this->warn("    ошибка: {$e->getMessage()}");
                continue;
            }

            foreach ($products as $p) {
                $externalId = $p['id'] ?? null;
                if (!$externalId) continue;
                if ($dry) {
                    $totalAdded++;
                    continue;
                }
                $existing = ProviderProduct::where('provider_id', $provider->id)
                    ->where('external_id', (string) $externalId)
                    ->first();

                $payload = [
                    'raw_meta' => array_merge($p, [
                        'category_id' => $catId,
                        'category_name' => $cat['name_ru'] ?? null,
                        // Локальный id нашей категории (для авто-привязки при подключении)
                        'local_category_id' => $externalToLocal[$catId] ?? null,
                    ]),
                    'price_in' => $p['price'] ?? null,
                    'last_seen_at' => $now,
                    'in_stock' => null, // FK не сообщает остаток
                ];
                if ($existing) {
                    $existing->update($payload);
                    $totalUpdated++;
                } else {
                    ProviderProduct::create($payload + [
                        'provider_id' => $provider->id,
                        'external_id' => (string) $externalId,
                    ]);
                    $totalAdded++;
                }
            }
        }

        // Устаревшие товары (не появлялись 24+ часа)
        $stale = 0;
        if (!$dry) {
            $stale = ProviderProduct::where('provider_id', $provider->id)
                ->where('last_seen_at', '<', now()->subDay())
                ->update(['in_stock' => 0]);

            $provider->update([
                'last_sync_at' => now(),
                'status' => 'ok',
                'last_error_at' => null,
                'last_error_text' => null,
            ]);
        }

        $this->info("✓ Готово: добавлено {$totalAdded}, обновлено {$totalUpdated}" . ($stale ? ", помечены как устаревшие: {$stale}" : ''));
        if ($dry) $this->warn('DRY-RUN: данные в БД не сохранены');

        // Сохраняем основные счётчики в run
        $run?->update([
            'categories_synced' => count($categories),
            'products_added' => $totalAdded,
            'products_updated' => $totalUpdated,
            'products_stale' => $stale,
        ]);

        // Шаг refresh: пересчёт цен и скрытие пропавших товаров.
        $refreshStats = ['updated' => 0, 'hidden' => 0, 'restored' => 0, 'variants_removed' => 0];
        if (!$dry && !$this->option('no-refresh')) {
            $settings = $provider->settings ?? [];
            $updatePrices = (bool) ($settings['auto_update_prices'] ?? true);
            $hideMissing = (bool) ($settings['auto_hide_missing'] ?? true);

            if ($updatePrices || $hideMissing) {
                $this->info('→ обновляю Product\'ы (цены/видимость)...');
                $refreshStats = (new ProductRefresher())->refresh($provider, [
                    'update_prices' => $updatePrices,
                    'hide_missing' => $hideMissing,
                ]);
                $this->info(sprintf(
                    '  обновлено: %d, скрыто: %d, восстановлено: %d, удалено вариантов: %d',
                    $refreshStats['updated'], $refreshStats['hidden'], $refreshStats['restored'], $refreshStats['variants_removed']
                ));
            }
        }

        // Шаг auto-connect: создаём Product'ы для НОВЫХ leaf-категорий, где ещё нет Product'а.
        // Идемпотентно: ProductGrouper берёт только provider_products с product_id=NULL.
        // Уже подключённых не трогает. Управляется флагом auto_connect_new_products
        // в provider.settings (default true).
        $connectStats = ['created' => 0, 'skipped' => 0];
        if (!$dry && !$this->option('no-refresh')) {
            $settings = $provider->settings ?? [];
            $autoConnect = (bool) ($settings['auto_connect_new_products'] ?? true);
            if ($autoConnect) {
                $this->info('→ подключаю новые товары (auto-connect)...');
                try {
                    $r = ProductGrouper::default()->groupAll($provider, ['status' => 'active']);
                    $connectStats = [
                        'created' => $r['created'] ?? 0,
                        'skipped' => $r['skipped'] ?? 0,
                    ];
                    $this->info(sprintf(
                        '  создано Product\'ов: %d, пропущено: %d',
                        $connectStats['created'], $connectStats['skipped']
                    ));
                } catch (\Throwable $e) {
                    $this->warn('  auto-connect упал: ' . $e->getMessage());
                }
            }
        }

        $run?->update([
            'status' => 'ok',
            'finished_at' => now(),
            'refresh_updated' => $refreshStats['updated'],
            'refresh_hidden' => $refreshStats['hidden'],
            'refresh_restored' => $refreshStats['restored'],
            'refresh_variants_removed' => $refreshStats['variants_removed'],
            'products_connected' => $connectStats['created'],
        ]);

        return 0;
    }

    /**
     * Зеркалит дерево категорий поставщика в нашу таблицу `categories`.
     *
     * Идёт двумя проходами:
     *   1. Все категории FK создаются/обновляются без parent_id (плоско).
     *   2. Потом проставляется parent_id согласно дереву FK (внешний parent_id → наш id).
     *
     * Возвращает map: external_id (int) → local categories.id (int).
     *
     * Категории нашего фронта (provider_id IS NULL) НЕ трогаем — они живут параллельно.
     *
     * @param  list<array<string,mixed>>  $categories  плоский массив категорий из FK
     * @return array<int,int>
     */
    protected function syncCategoryTree(int $providerId, array $categories): array
    {
        $this->info('  → зеркалю дерево категорий в нашу БД...');

        // Сортируем по полю sort (если есть) — чтобы наш порядок совпадал с FK.
        usort($categories, fn ($a, $b) => ((int) ($a['sort'] ?? 0)) <=> ((int) ($b['sort'] ?? 0)));

        $downloader = app(MediaDownloader::class);

        // Первый проход: upsert без parent_id
        $externalToLocal = [];
        $sortIdx = 0;
        foreach ($categories as $c) {
            $extId = (int) ($c['id'] ?? 0);
            if (!$extId) continue;

            $name = $c['name_ru'] ?? $c['name'] ?? ('FK #' . $extId);
            // Уникальный slug: префикс "fk-" + external id (даже если у FK совпадут slug-и, у нас не сломается)
            $slug = 'fk-' . $extId;

            // Картинка категории, если FK отдаёт (поля могут называться image / logo / icon)
            $imageRemote = $c['image'] ?? $c['logo'] ?? $c['icon'] ?? null;
            $imageLocal = is_string($imageRemote) ? $downloader->download($imageRemote, 'fkwallet/categories') : null;

            $cat = Category::updateOrCreate(
                [
                    'provider_id' => $providerId,
                    'provider_external_id' => (string) $extId,
                ],
                array_filter([
                    'slug' => $slug,
                    'name' => $name,
                    'image_url' => $imageLocal ?? (is_string($imageRemote) ? $imageRemote : null),
                    'sort_order' => $sortIdx++,
                    'is_active' => true,
                ], fn ($v) => $v !== null),
            );
            $externalToLocal[$extId] = $cat->id;
        }

        // Второй проход: проставляем parent_id по FK-иерархии
        $updated = 0;
        foreach ($categories as $c) {
            $extId = (int) ($c['id'] ?? 0);
            $extParent = (int) ($c['parent_id'] ?? 0);
            if (!$extId) continue;
            if (!$extParent) continue; // top-level в FK — у нас тоже top-level (parent_id=NULL)

            $localId = $externalToLocal[$extId] ?? null;
            $localParent = $externalToLocal[$extParent] ?? null;
            if (!$localId || !$localParent) continue;

            $row = Category::find($localId);
            if ($row && $row->parent_id !== $localParent) {
                $row->update(['parent_id' => $localParent]);
                $updated++;
            }
        }

        $this->info('    зеркалено: ' . count($externalToLocal) . ' категорий, родителей расставлено: ' . $updated);
        return $externalToLocal;
    }
}
