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
    /** Карта транслитерации кириллицы → латиница. */
    private const TRANSLIT = [
        'а' => 'a', 'б' => 'b', 'в' => 'v', 'г' => 'g', 'д' => 'd', 'е' => 'e',
        'ё' => 'e', 'ж' => 'zh', 'з' => 'z', 'и' => 'i', 'й' => 'y', 'к' => 'k',
        'л' => 'l', 'м' => 'm', 'н' => 'n', 'о' => 'o', 'п' => 'p', 'р' => 'r',
        'с' => 's', 'т' => 't', 'у' => 'u', 'ф' => 'f', 'х' => 'h', 'ц' => 'ts',
        'ч' => 'ch', 'ш' => 'sh', 'щ' => 'sch', 'ъ' => '', 'ы' => 'y', 'ь' => '',
        'э' => 'e', 'ю' => 'yu', 'я' => 'ya',
        // украинские/казахские буквы — на случай таких названий
        'і' => 'i', 'ї' => 'yi', 'є' => 'ye', 'ґ' => 'g', 'ә' => 'a', 'қ' => 'k',
        'ұ' => 'u', 'ң' => 'n', 'ғ' => 'g', 'ө' => 'o', 'һ' => 'h',
    ];

    /**
     * Сгенерировать уникальный читаемый slug из названия товара.
     *
     * @param  int|null  $ignoreId  id товара, который не учитывать при проверке уникальности
     */
    public static function make(string $name, ?int $ignoreId = null): string
    {
        // 170 символов — запас под суффикс коллизии в колонке varchar(180).
        $base = trim(Str::limit(self::slugify($name), 170, ''), '-');
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

    /** Транслитерация кириллицы + нормализация в slug. */
    private static function slugify(string $name): string
    {
        $translit = strtr(mb_strtolower(trim($name)), self::TRANSLIT);

        return Str::slug($translit);
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
