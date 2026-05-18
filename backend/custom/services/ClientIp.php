<?php

namespace App\Services;

use Illuminate\Http\Request;

/**
 * Реальный IP клиента.
 *
 * Сайт за DDoS-Guard — настоящий IP приходит в заголовке DDG-Connecting-IP.
 * $request->ip() за nginx внутри Docker отдаёт IP бридж-сети (172.x), а не
 * покупателя. Фолбэк на $request->ip(), если заголовка нет.
 *
 * NB: для строгих проверок безопасности (IP-allowlist админки, whitelist
 * вебхука) у этих мест своя логика обработки отсутствующего заголовка —
 * этот хелпер для «лучшего предположения» (rate-limit, аудит, заказ).
 */
class ClientIp
{
    public static function resolve(Request $request): string
    {
        $header = $request->header('DDG-Connecting-IP');

        return is_string($header) && $header !== ''
            ? $header
            : (string) ($request->ip() ?? '');
    }
}
