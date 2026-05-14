<?php

namespace App\Services;

/**
 * DEPRECATED — оставлено для обратной совместимости.
 * Используйте App\Services\FreekassaGateway.
 *
 * FKwallet (api.fkwallet.io) — это поставщик товаров; платёжная система
 * теперь живёт в FreekassaGateway. Этот класс — просто алиас, чтобы
 * существующие DI-биндинги и type-hints не сломались. Удалить, когда
 * все usage будут переписаны.
 */
class FkwalletGateway extends FreekassaGateway
{
}
