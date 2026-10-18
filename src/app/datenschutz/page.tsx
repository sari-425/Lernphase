import Link from "next/link";
import { redirect } from "next/navigation";
import { Privacy } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = { title: "Datenschutz" };

/** Allgemeine Fassung; mit DEFAULT_TENANT_SLUG direkt die Fassung dieses Betriebsrats. */
export default function Datenschutz() {
  const def = env().DEFAULT_TENANT_SLUG;
  if (def) redirect(`/b/${def}/datenschutz`);
  return (
    <main id="inhalt" className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <Privacy tenant={null} />
      <p><Link className="link" href="/">Zur Startseite</Link></p>
    </main>
  );
}
