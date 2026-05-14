<?php

namespace App\Services\Providers;

use App\Models\Provider;
use App\Models\ProviderProduct;
use Illuminate\Support\Facades\DB;

/**
 * Массовое подключение всех unconnected provider_products к нашему каталогу.
 * Использует ProductConnector построчно. Возвращает счётчики и список
 * пропущенных товаров (для отображения в UI / CLI).
 *
 * Используется и в Artisan-команде, и в API-эндпоинте — единая логика.
 */
class BulkConnector
{
    public function __construct(
        protected ProductConnector $connector,
    ) {}

    public static function default(): self
    {
        return new self(ProductConnector::default());
    }

    /**
     * @param  array<string,mixed>  $opts
     *      status     ('draft'|'active', default 'draft')
     *      limit      (int|null)                       — сколько товаров обработать за прогон
     *      from_id    (int|null)                       — обрабатывать только pp.id > from_id (курсор)
     *      onProgress (callable(int $processed, int $total): void)
     *
     * @return array{
     *   total: int,                                                    // unconnected с id > from_id (на момент старта)
     *   processed: int,
     *   created: int,
     *   skipped: int,
     *   skipped_items: list<array{external_id:string,name:string,reason:string}>,
     *   last_id: int|null,                                             // максимум pp.id, обработанный в этом батче
     *   done: bool                                                     // больше нечего обрабатывать
     * }
     */
    public function run(Provider $provider, array $opts = []): array
    {
        $status = $opts['status'] ?? 'draft';
        $limit = $opts['limit'] ?? null;
        $fromId = $opts['from_id'] ?? null;
        $onProgress = $opts['onProgress'] ?? null;

        $base = ProviderProduct::where('provider_id', $provider->id)->whereNull('product_id');
        if ($fromId) $base->where('id', '>', (int) $fromId);

        $total = (clone $base)->count();
        $effective = $limit ? min($limit, $total) : $total;

        $created = 0;
        $skipped = [];
        $processed = 0;
        $lastId = $fromId;

        // Идём по id ASC, чтобы курсор был детерминирован.
        $query = (clone $base)->orderBy('id');
        if ($limit) $query->limit($limit);

        // Получаем пачкой — limit уже ограничивает память (default 200).
        $items = $query->get();

        foreach ($items as $pp) {
            try {
                DB::beginTransaction();
                $result = $this->connector->connect($pp, ['status' => $status]);
                DB::commit();
            } catch (\Throwable $e) {
                DB::rollBack();
                $result = ['status' => 'skipped', 'reason' => 'exception: ' . $e->getMessage()];
            }

            if ($result['status'] === 'connected') {
                $created++;
            } else {
                $skipped[] = [
                    'external_id' => (string) $pp->external_id,
                    'name' => (string) ($pp->raw_meta['name_ru'] ?? '—'),
                    'reason' => $result['reason'] ?? '—',
                ];
            }

            $processed++;
            $lastId = $pp->id;
            if ($onProgress) $onProgress($processed, $effective);
        }

        $done = $processed === 0 || $processed >= $total;

        return [
            'total' => $total,
            'processed' => $processed,
            'created' => $created,
            'skipped' => count($skipped),
            'skipped_items' => $skipped,
            'last_id' => $lastId,
            'done' => $done,
        ];
    }
}
