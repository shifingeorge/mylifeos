import { AppHeader } from "@/components/AppHeader";

/**
 * A placeholder, not a feature. TabBar has always had four tabs and MONEY
 * is one of them, so without this the tap lands on Next's default 404 —
 * which renders outside the `(app)` group and therefore has no tab bar at
 * all. The only way back is the browser's back gesture, which a standalone
 * PWA barely offers. An empty screen inside the shell is recoverable; a
 * bare error page is not.
 */
export default function MoneyPage() {
  return (
    <main className="w-full pb-6">
      <AppHeader title="MONEY" />
      <p
        className="px-3 py-8 text-center text-[11px] tracking-[0.1em]"
        style={{ color: "var(--type-muted)" }}
      >
        ARRIVES NEXT PHASE
      </p>
    </main>
  );
}
