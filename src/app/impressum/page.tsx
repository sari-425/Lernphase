import Link from "next/link";
import { redirect } from "next/navigation";
import { Imprint } from "@/components/legal";
import { env } from "@/lib/env";

export const metadata = { title: "Impressum" };

/** Allgemeine Fassung; mit DEFAULT_TENANT_SLUG direkt die Fassung dieses Betriebsrats. */
export default function Impressum() {
  const def = env().DEFAULT_TENANT_SLUG;
  if (def) redirect(`/b/${def}/impressum`);
  return (
    <main id="inhalt" className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-10">
      <Imprint tenant={null} />
      <p><Link className="link" href="/">Zur Startseite</Link></p>
    </main>
  );
}
