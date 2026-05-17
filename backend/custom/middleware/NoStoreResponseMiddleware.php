<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Запрещает кэширование ответа на любом уровне — браузер, CDN (DDoS-Guard),
 * промежуточные прокси. Вешается на аутентифицированные эндпоинты
 * (/api/me/*, /api/admin/*, /api/auth/me): это персональные данные.
 *
 * Без этого заголовка GET-ответы могли осесть в кэше — отсюда «устаревший»
 * список заказов в ЛК (новые заказы не видны), а в худшем случае общий
 * кэш CDN мог бы отдать данные одного пользователя другому.
 */
class NoStoreResponseMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $response = $next($request);
        $response->headers->set('Cache-Control', 'no-store, private, max-age=0');
        return $response;
    }
}
