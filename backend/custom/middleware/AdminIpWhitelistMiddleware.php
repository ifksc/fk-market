<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

/**
 * Ограничивает доступ к /api/admin/* по IP-адресу клиента — даже с верным
 * логином/паролем зайти можно только с разрешённых IP.
 *
 * Список — в env ADMIN_IP_ALLOWLIST (IP через запятую). Пусто → ограничение
 * ВЫКЛЮЧЕНО: защита от случайной блокировки всех (например, до того как
 * владелец задал список, или если переменную случайно очистили).
 *
 * Реальный IP берётся из заголовка DDG-Connecting-IP — его ставит DDoS-Guard
 * (так же, как в проверке IP вебхука FreeKassa). Если allowlist включён, а
 * заголовка нет — запрос отклоняется (fail-closed): легальный администратор
 * всегда приходит через DDoS-Guard.
 *
 * ВАЖНО: заголовок надёжен, только если origin закрыт фаерволом на диапазоны
 * DDoS-Guard. Иначе DDG-Connecting-IP можно подделать прямым запросом к origin.
 */
class AdminIpWhitelistMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        $allowed = array_values(array_filter(array_map(
            'trim',
            explode(',', (string) env('ADMIN_IP_ALLOWLIST', '')),
        )));

        // Список пуст — ограничение по IP выключено.
        if (empty($allowed)) {
            return $next($request);
        }

        $clientIp = $request->header('DDG-Connecting-IP');
        if ($clientIp !== null && in_array(trim($clientIp), $allowed, true)) {
            return $next($request);
        }

        return response()->json(['message' => 'Доступ к админке с этого IP запрещён'], 403);
    }
}
