<?php

namespace App\Console\Commands;

use App\Models\Category;
use App\Services\CategorySlug;
use Illuminate\Console\Command;

/**
 * php artisan categories:reslug
 *   --dry   только показать изменения, ничего не записывать
 *
 * Разовая команда: переводит slug'и категорий с технических (fk-11) на
 * читаемые (apple-wallet-code). Текущий slug сохраняется в legacy_slug —
 * по нему фронт делает 301-редирект со старых URL.
 *
 * Идемпотентна: категории с заполненным legacy_slug пропускаются.
 */
class CategoriesReslugCommand extends Command
{
    protected $signature = 'categories:reslug {--dry : показать изменения без записи}';

    protected $description = 'Перегенерировать slug категорий на читаемые';

    public function handle(): int
    {
        $dry = (bool) $this->option('dry');
        $updated = 0;
        $skipped = 0;

        foreach (Category::orderBy('id')->get() as $cat) {
            if ($cat->legacy_slug) {
                $skipped++;
                continue; // уже переименована ранее
            }

            $newSlug = CategorySlug::make($cat->name, $cat->id);
            if ($newSlug === $cat->slug) {
                $skipped++;
                continue; // slug и так читаемый
            }

            $this->line("  #{$cat->id}: {$cat->slug} → {$newSlug}");

            if (!$dry) {
                $cat->legacy_slug = $cat->slug;
                $cat->slug = $newSlug;
                $cat->save();
            }
            $updated++;
        }

        $verb = $dry ? 'будет изменено' : 'изменено';
        $this->info("Категорий {$verb}: {$updated}, пропущено: {$skipped}");

        return self::SUCCESS;
    }
}
