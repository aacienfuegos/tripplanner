export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Falta la variable ${name}: ver "Tests" en docs/tecnico.md`);
  return value;
}
