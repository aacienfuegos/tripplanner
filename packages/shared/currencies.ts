// Fuente de verdad para las monedas soportadas: reutilizada por los schemas
// Zod (web, android e import wizard) y por el cliente de tipo de cambio, para
// que un único allowlist cierre tanto la validación de formularios como las
// llamadas a la API externa de exchange rate.
export const CURRENCIES = ["EUR", "USD", "GBP", "JPY", "MXN", "ARS", "CLP", "COP"] as const;

export type Currency = (typeof CURRENCIES)[number];
