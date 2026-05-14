<?php

namespace App\Services\Providers;

/**
 * Единый интерфейс для всех поставщиков цифровых товаров.
 * Реализации: FkwalletProductsGateway (сейчас), позже Digiseller, Kinguin и т.д.
 */
interface ProviderGateway
{
    /** Список категорий поставщика. Возвращает плоский массив структур: [{id, name_ru, slug, parent_id, ...}] */
    public function listCategories(): array;

    /** Список товаров в категории. */
    public function listProducts(int $categoryId): array;

    /** Бесплатная проверка возможности заказа. true = можно заказывать. */
    public function validate(string $idempotenceKey, int $externalId, ?float $amount, array $fields): bool;

    /** Создать заказ у поставщика. Возвращает [id => provider_order_id, status => int, coupon_code => ?string]. */
    public function order(string $idempotenceKey, int $externalId, ?float $amount, array $fields): array;

    /** Опросить статус заказа. Возвращает [id, status, coupon_code]. */
    public function getStatus(int $providerOrderId): array;
}
