import { describe, it, expect } from "vitest";
import { configReport } from "@/lib/config";

describe("configReport", () => {
  it("reports every required variable as missing when none are set", () => {
    const r = configReport({});
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["DATABASE_URL", "PIN_HASH", "AUTH_SECRET"]);
  });

  it("is ok once all three required variables are present", () => {
    const r = configReport({
      DATABASE_URL: "postgresql://u:p@h/db",
      PIN_HASH: "$argon2id$v=19$m=19456,t=2,p=1$salt$hash",
      AUTH_SECRET: "s",
    });
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([]);
  });

  it("never echoes a value back — only names and booleans", () => {
    const r = configReport({
      DATABASE_URL: "postgresql://user:SUPERSECRET@host/db",
      PIN_HASH: "$argon2id$hash",
      AUTH_SECRET: "signing-key",
    });
    const dumped = JSON.stringify(r);
    expect(dumped).not.toContain("SUPERSECRET");
    expect(dumped).not.toContain("signing-key");
    expect(dumped).not.toContain("argon2");
  });

  it("treats an empty string as missing, not as set", () => {
    // Vercel happily stores an empty value, and a blank PIN_HASH fails at
    // request time with a 500 that says nothing. Catch it here instead.
    const r = configReport({
      DATABASE_URL: "postgresql://u:p@h/db",
      PIN_HASH: "",
      AUTH_SECRET: "s",
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["PIN_HASH"]);
  });

  it("flags a PIN_HASH mangled by dotenv expansion", () => {
    // The exact failure this project already hit once: unescaped $ in a local
    // .env leaves '=19=19456,t=2,p=1'. It is present, non-empty, and useless.
    const r = configReport({
      DATABASE_URL: "postgresql://u:p@h/db",
      PIN_HASH: "=19=19456,t=2,p=1",
      AUTH_SECRET: "s",
    });
    expect(r.ok).toBe(false);
    expect(r.problems).toContain("PIN_HASH is not an argon2id hash");
  });

  it("reports the environment label, defaulting to prod", () => {
    expect(configReport({}).env).toBe("prod");
    expect(configReport({ NEXT_PUBLIC_ENV_LABEL: "dev" }).env).toBe("dev");
    expect(configReport({ NEXT_PUBLIC_ENV_LABEL: "prod" }).env).toBe("prod");
  });

  it("names which Neon host is in use without exposing the password", () => {
    const r = configReport({
      DATABASE_URL:
        "postgresql://neondb_owner:npg_secret@ep-flat-unit-123-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require",
    });
    expect(r.dbHost).toBe("ep-flat-unit-123-pooler.eu-west-2.aws.neon.tech");
    expect(JSON.stringify(r)).not.toContain("npg_secret");
  });

  it("does not throw on a DATABASE_URL that is not a URL", () => {
    const r = configReport({ DATABASE_URL: "not a url" });
    expect(r.dbHost).toBe("unparseable");
    expect(r.problems).toContain("DATABASE_URL is not a valid URL");
  });
});
