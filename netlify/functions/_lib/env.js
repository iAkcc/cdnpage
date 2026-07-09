export function env(name, fallback) {
  const v = process.env[name] ?? fallback;
  if (v === undefined) return undefined;
  return v;
}

export function requireEnv(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Variable de entorno requerida: ${name}`);
  return v;
}
