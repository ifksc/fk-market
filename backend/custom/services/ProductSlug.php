<?php

namespace App\Services;

use App\Models\Product;
use Illuminate\Support\Str;

/**
 * Генератор человекочитаемых slug'ов товаров.
 * Транслитерирует кириллицу в латиницу и гарантирует уникальность
 * (проверка по slug и legacy_slug всех товаров).
 */
class ProductSlug
{
    /**
     * Сгенерировать уникальный читаемый slug из названия товара.
     *
     * @param  int|null  $ignoreId  id товара, который не учитывать при проверке уникальности
     */
    public static function make(string $name, ?int $ignoreId = null): string
    {
        // 170 символов — запас под суффикс коллизии в колонке varchar(180).
        $base = trim(Str::limit(Translit::slugify($name), 170, ''), '-');
        if ($base === '') {
            $base = 'tovar';
        }

        $slug = $base;
        $i = 2;
        while (self::taken($slug, $ignoreId)) {
            $slug = $base . '-' . $i;
            $i++;
        }

        return $slug;
    }

    /** Занят ли slug другим товаром (по slug или legacy_slug)? */
    private static function taken(string $slug, ?int $ignoreId): bool
    {
        return Product::query()
            ->where(fn ($q) => $q->where('slug', $slug)->orWhere('legacy_slug', $slug))
            ->when($ignoreId, fn ($q) => $q->where('id', '!=', $ignoreId))
            ->exists();
    }
}
