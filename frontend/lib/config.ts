// FK.market — единая точка конфигурации клиента.

/** Базовый URL API. NEXT_PUBLIC_* запекается в build-time. */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://fk.market/api';
