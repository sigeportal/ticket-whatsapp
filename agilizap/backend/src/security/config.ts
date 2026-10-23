const known = new Set([
  "mysecret", "myanothersecret", "agilizap_db_pass_alterar", "agilizap_redis_pass_alterar",
  "kZaOTd+YZpjRUyyuQUpigJaEMk4vcW4YOymKPZX0Ts8=", "dBSXqFg9TaNUEDXVp6fhMTRLBysP+j2DSqf7+raxD3A="
]);
export const requireSecret = (name: string): string => {
  const value = process.env[name];
  if (!value || value.length < 32 || known.has(value) || new Set(value).size < 12) {
    throw new Error(`Unsafe or missing configuration: ${name}`);
  }
  return value;
};
export const validateRuntimeConfig = (): void => {
  const access = requireSecret("JWT_SECRET");
  if (access === requireSecret("JWT_REFRESH_SECRET")) throw new Error("JWT secrets must differ");
  if (process.env.NODE_ENV === "production") {
    for (const name of ["BACKEND_URL", "FRONTEND_URL"]) {
      if (!process.env[name]?.startsWith("https://")) throw new Error(`HTTPS required: ${name}`);
    }
    for (const name of ["DB_PASS", "REDIS_PASSWORD"]) requireSecret(name);
  }
};
