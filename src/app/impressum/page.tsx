import Link from "next/link";
import { Alert } from "@/components/ui";

export const metadata = { title: "Impressum" };

export default function Impressum() {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-3xl flex-1 space-y-4 px-4 py-10">
      <h1 className="text-3xl font-bold text-brand-900">Impressum</h1>
      <Alert kind="warning" title="Vorlage">Bitte vor dem Betrieb vervollständigen (Angaben nach § 5 DDG bzw. § 18 MStV, soweit anwendbar).</Alert>
      <p>[Name / Bezeichnung des Anbieters]<br />[Anschrift]<br />[Kontakt: E-Mail, Telefon]</p>
      <p>Inhaltlich verantwortlich für die Mitteilungen ist der jeweilige Betriebsrat.</p>
      <p><Link className="link" href="/">Zur Startseite</Link></p>
    </main>
  );
}
