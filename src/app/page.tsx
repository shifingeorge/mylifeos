import { redirect } from "next/navigation";

/**
 * No home screen, no dashboard, no summary. The app opens directly into the
 * thing you came to do. Design doc §4.
 */
export default function Home() {
  redirect("/habits");
}
