// Next resolves "server-only" to an empty module on the server; the package's
// own entry throws outside React Server Components, which is where Vitest runs.
export {};
