import { getDb } from "@/lib/db";
import { vapidConfig } from "@/lib/env";
import { loadTenant } from "@/lib/server/context";
import { listCategories } from "@/lib/services/directory";
import { PushSettings } from "@/components/push-settings";
import { PageTitle } from "@/components/ui";

export const metadata = { title: "Benachrichtigungen" };

export default async function PushPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  const cats = await listCategories(await getDb(), tenant.id);
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageTitle sub="Freiwillig, anonym und jederzeit abschaltbar.">Benachrichtigungen</PageTitle>
      <section className="card space-y-2" aria-labelledby="vorab">
        <h2 id="vorab" className="text-lg font-bold">Bevor Sie aktivieren</h2>
        <ul className="list-disc space-y-1 pl-6">
          <li>Sie erhalten einen kurzen Hinweis, wenn der Betriebsrat etwas Neues veröffentlicht.</li>
          <li>Auf dem Sperrbildschirm erscheint nur ein neutraler Text – keine vertraulichen Inhalte.</li>
          <li>Sie brauchen <strong>kein Konto</strong>. Wir speichern keinen Namen, keine E-Mail-Adresse, keine Telefonnummer und keinen Standort.</li>
          <li>Gespeichert wird nur die technische Push-Adresse Ihres Browsers und Ihre Themenauswahl. Wir erfahren nicht, ob oder wann Sie eine Mitteilung lesen.</li>
          <li>Der Betriebsrat sendet sparsam: höchstens wenige Benachrichtigungen pro Tag.</li>
          <li>Nach dem Klick auf „Aktivieren“ fragt Ihr Gerät um Erlaubnis.</li>
        </ul>
      </section>
      <PushSettings slug={slug} vapidPublicKey={vapidConfig()?.publicKey ?? null} categories={cats.map((c) => ({ id: c.id, name: c.name }))} />
      <details className="card">
        <summary className="cursor-pointer font-semibold text-brand-800">Technischer Hinweis zur Zustellung</summary>
        <p className="mt-2 text-sm text-muted">
          Benachrichtigungen werden verschlüsselt über den Push-Dienst Ihres Browserherstellers (z. B. Google, Apple, Mozilla, Microsoft) zugestellt. Dieser kann den Inhalt nicht lesen, sieht aber, dass eine Nachricht an Ihr Gerät geht. Eine Zustellung kann nicht garantiert werden, z. B. bei ausgeschaltetem Gerät, Energiesparmodus oder deaktivierten Mitteilungen.
        </p>
      </details>
    </div>
  );
}
