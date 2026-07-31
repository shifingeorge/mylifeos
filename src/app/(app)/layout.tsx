import { TabBar } from "@/components/TabBar";
import { SyncRunner } from "@/components/SyncRunner";

/**
 * The frame every guarded screen sits in. The route group `(app)` shares this
 * layout without adding a segment to any URL — `/habits` stays `/habits`.
 */
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-full w-full max-w-2xl flex-1 flex-col">
      {/* One sync loop for every guarded screen, not one per screen. */}
      <SyncRunner />
      <div className="flex-1">{children}</div>
      <TabBar />
    </div>
  );
}
