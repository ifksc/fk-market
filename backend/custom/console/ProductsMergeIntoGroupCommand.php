<?php

namespace App\Console\Commands;

use App\Models\Product;
use App\Models\ProviderProduct;
use App\Services\Providers\ProductGrouper;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

/**
 * php artisan products:merge-into-group {product} {--into=} {--dry} {--force}
 *
 * Сливает отдельный (ошибочно ставший standalone) товар в групповую карточку:
 * его provider_products становятся вариантами группы, варианты группы
 * пересобираются, а сам товар архивируется (status=archived, не удаляется).
 *
 * Нужно для разовой починки случаев, когда номинал появился у поставщика
 * после создания группы и был подключён отдельной карточкой. Новые такие
 * случаи закрывает ProductGrouper::attachToGroup при синке — эта команда
 * правит уже существующие дубли.
 *
 *   {product}   id или slug сливаемого товара
 *   --into=ID   id целевого группового товара (по умолчанию — групповой
 *               Product в той же категории и у того же поставщика)
 *   --dry       показать, что будет сделано, без записи
 *   --force     не спрашивать подтверждение
 */
class ProductsMergeIntoGroupCommand extends Command
{
    protected $signature = 'products:merge-into-group {product} {--into=} {--dry} {--force}';
    protected $description = 'Слить отдельный товар в групповую карточку (варианты + архивация дубля)';

    public function handle(): int
    {
        $ref = (string) $this->argument('product');
        $standalone = is_numeric($ref)
            ? Product::find((int) $ref)
            : Product::where('slug', $ref)->first();
        if (!$standalone) {
            $this->error("Товар [{$ref}] не найден");
            return 1;
        }
        if (!$standalone->provider_id) {
            $this->error("Товар #{$standalone->id} не из синхронизации поставщика");
            return 1;
        }

        // Целевая групповая карточка
        $intoId = $this->option('into');
        if ($intoId) {
            $group = Product::find((int) $intoId);
        } else {
            $group = Product::where('provider_id', $standalone->provider_id)
                ->where('category_id', $standalone->category_id)
                ->whereNull('provider_external_id')
                ->where('id', '!=', $standalone->id)
                ->first();
        }
        if (!$group) {
            $this->error('Целевая групповая карточка не найдена. Укажите --into=ID явно.');
            return 1;
        }
        if ($group->id === $standalone->id) {
            $this->error('Нельзя слить товар сам в себя');
            return 1;
        }
        if (!is_null($group->provider_external_id)) {
            $this->error("Товар #{$group->id} не групповой (provider_external_id задан)");
            return 1;
        }

        $pps = ProviderProduct::where('product_id', $standalone->id)->get();
        if ($pps->isEmpty()) {
            $this->error("У товара #{$standalone->id} нет provider_products — сливать нечего");
            return 1;
        }

        $this->info("Слияние:");
        $this->line("  откуда: #{$standalone->id} «{$standalone->name}» ({$standalone->slug})");
        $this->line("  куда:   #{$group->id} «{$group->name}» ({$group->slug})");
        $this->line("  provider_products к переносу: {$pps->count()}");
        $this->line("  товар #{$standalone->id} будет заархивирован (status=archived)");

        if ($this->option('dry')) {
            $this->warn('DRY-RUN: изменения не сохранены');
            return 0;
        }

        if (!$this->option('force')
            && !$this->confirm("Перенести варианты и заархивировать товар #{$standalone->id}?", false)) {
            $this->line('Отменено');
            return 0;
        }

        DB::transaction(function () use ($standalone, $group, $pps) {
            foreach ($pps as $pp) {
                $pp->update(['product_id' => $group->id]);
            }
            ProductGrouper::default()->syncGroupVariants($group);
            $standalone->update(['status' => 'archived']);
        });

        $group->refresh();
        $this->info("✓ Готово. Товар #{$standalone->id} заархивирован; "
            . "у группы #{$group->id} вариантов: {$group->variants_count}.");
        return 0;
    }
}
