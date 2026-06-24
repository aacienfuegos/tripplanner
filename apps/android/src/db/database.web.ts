// expo-sqlite's sync API uses Atomics.wait() which is blocked on the browser
// main thread (W3C restriction). This app targets Android — use apps/web instead.
export const db = null as never;
export function initDatabase(): void {}
