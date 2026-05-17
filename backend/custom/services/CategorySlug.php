<?php

namespace App\Services;

use App\Models\Category;
use Illuminate\Support\Str;

/**
 * Генератор человекочитаемых slug'ов категорий.
 * Транслитерирует кириллицу и гарантирует уникальность
 * (проверка по slug и legacy_slug всех категорий).
 */
class CategorySlug
{
    /**
     * Сгенерировать уникальный читаемый slug из названия категории.
     *
     * @param  int|null  $ignoreId  id категории, которую не учитывать при проверке уникальности
     */
    public static function make(string $name, ?int $ignoreId = null): string
    {
        // 110 символов — запас под суффикс коллизии в колонке varchar(120).
        $base = trim(Str::limit(Translit::slugify($name), 110, ''), '-');
        if ($base === '') {
            $base = 'category';
        }

        $slug = $base;
        $i = 2;
        while (self::taken($slug, $ignoreId)) {
            $slug = $base . '-' . $i;
            $i++;
        }

        return $slug;
    }

    /** Занят ли slug другой категорией (по slug или legacy_slug)? */
    private static function taken(string $slug, ?int $ignoreId): bool
    {
        return Category::query()
            ->where(fn ($q) => $q->where('slug', $slug)->orWhere('legacy_slug', $slug))
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
    }
}
