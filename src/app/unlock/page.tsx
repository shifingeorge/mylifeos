"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PinPad } from "@/components/PinPad";

export default function UnlockPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(pin: string) {
    setBusy(true);
    setError("");

    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pin }),
      });

      if (res.status === 204) {
        router.replace("/habits");
        return;
      }

      if (res.status === 429) {
        const { retryInMs } = (await res.json()) as { retryInMs: number };
        setError(`LOCKED ${Math.ceil(retryInMs / 1000)}S`);
        return;
      }

      setError("INVALID");
    } catch {
      setError("NO CONNECTION");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-10 px-6">
      <div className="text-center">
        <div className="text-[13px] tracking-[0.12em]">LIFE_OS</div>
        <div
          className="mt-1 text-[10px] tracking-[0.18em]"
          style={{ color: "var(--type-muted)" }}
        >
          ENTER PIN
        </div>
      </div>

      <PinPad onSubmit={submit} disabled={busy} />

      <div
        role="status"
        className="h-4 text-[10px] tracking-[0.18em]"
        style={{ color: "var(--alert)" }}
      >
        {error}
      </div>
    </main>
  );
}
