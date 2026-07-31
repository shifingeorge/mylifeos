/**
 * Deployment configuration check.
 *
 * A missing or mangled environment variable in Vercel produces a 500 at the
 * moment you try to unlock, with nothing in the response explaining why. This
 * turns that into one curl: which variables are set, which database the
 * instance is pointed at, and which environment it thinks it is.
 *
 * It reports names, booleans and the database HOST only. No value is ever
 * echoed back, because the endpoint is unauthenticated by necessity — it has
 * to be reachable precisely when auth is the thing that is broken.
 */

const REQUIRED = ["DATABASE_URL", "PIN_HASH", "AUTH_SECRET"] as const;

export interface ConfigReport {
  ok: boolean;
  env: "dev" | "prod";
  missing: string[];
  problems: string[];
  dbHost: string | null;
}

export function configReport(
  env: Record<string, string | undefined>,
): ConfigReport {
  // An empty string counts as missing. Vercel stores blank values without
  // complaint, and a blank secret fails identically to an absent one.
  const missing = REQUIRED.filter((k) => !env[k]);
  const problems: string[] = [];

  const hash = env.PIN_HASH;
  if (hash && !hash.startsWith("$argon2id$")) {
    // Almost always the dotenv `$` expansion trap documented in .env.example.
    problems.push("PIN_HASH is not an argon2id hash");
  }

  let dbHost: string | null = null;
  if (env.DATABASE_URL) {
    try {
      dbHost = new URL(env.DATABASE_URL).host;
    } catch {
      dbHost = "unparseable";
      problems.push("DATABASE_URL is not a valid URL");
    }
  }

  return {
    ok: missing.length === 0 && problems.length === 0,
    env: env.NEXT_PUBLIC_ENV_LABEL === "dev" ? "dev" : "prod",
    missing,
    problems,
    dbHost,
  };
}
