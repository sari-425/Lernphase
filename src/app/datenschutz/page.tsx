import Link from "next/link";
import { Alert } from "@/components/ui";

export const metadata = { title: "Datenschutz" };

/**
 * ENTWURF einer Datenschutzerklärung. Vor dem Produktivbetrieb durch die/den
 * Datenschutzbeauftragte/n bzw. rechtlich prüfen lassen und Platzhalter [ … ] ersetzen.
 */
export default function Datenschutz() {
  return (
    <main id="inhalt" className="mx-auto w-full max-w-3xl flex-1 px-4 py-10">
      <article className="space-y-5 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand-900 [&_li]:ml-6 [&_li]:list-disc">
        <h1 className="text-3xl font-bold text-brand-900">Datenschutzerklärung</h1>
        <Alert kind="warning" title="Entwurf">
          Dieser Text ist ein Entwurf und muss vor dem echten Betrieb vom Betreiber geprüft und vervollständigt werden (Platzhalter in eckigen Klammern).
        </Alert>

        <h2>1. Kurz und verständlich</h2>
        <ul>
          <li>Zum Lesen der Mitteilungen brauchen Sie kein Konto. Wir fragen weder Namen noch E-Mail-Adresse noch Telefonnummer ab.</li>
          <li>Es gibt keine Werbung, keine Analyse- oder Marketing-Cookies, kein Tracking, keine Standortabfrage.</li>
          <li>Wir erfassen nicht, wer welche Mitteilung liest.</li>
          <li>Es werden keine Daten an KI-Anbieter übermittelt.</li>
          <li>Push-Benachrichtigungen sind freiwillig und jederzeit abschaltbar; dabei wird Ihr Abo sofort gelöscht.</li>
        </ul>

        <h2>2. Verantwortlicher</h2>
        <p>
          [Name und Anschrift des Verantwortlichen]. Hinweis: Nach § 79a BetrVG ist bei der Verarbeitung personenbezogener Daten durch den Betriebsrat in der Regel der Arbeitgeber datenschutzrechtlich Verantwortlicher; der Betriebsrat hat die Vorschriften über den Datenschutz einzuhalten. Arbeitgeber und Betriebsrat unterstützen sich gegenseitig. [Konkrete Ausgestaltung im Betrieb klären.]
        </p>
        <p>Inhaltlich verantwortlich für die Mitteilungen: [Betriebsrat, Anschrift, Kontakt]. Datenschutzbeauftragte/r: [Kontakt].</p>
        <p>Technischer Betrieb (Hosting): [Name des Hosting-Anbieters / Betreibers, Sitz] – als Auftragsverarbeiter gemäß Art. 28 DSGVO.</p>

        <h2>3. Aufruf der Seiten (Server-Protokolle)</h2>
        <p>
          Beim Aufruf überträgt Ihr Browser technisch notwendig Ihre IP-Adresse, Datum/Uhrzeit, die aufgerufene Adresse und Browserangaben. Die Anwendung selbst speichert keine IP-Adressen. Zur Abwehr von Angriffen werden bei Anmeldeversuchen, Codeeingaben und Push-Anmeldungen kurzzeitig nicht rückrechenbare Prüfwerte (HMAC) der IP-Adresse gespeichert und nach spätestens 24 Stunden gelöscht. Protokolle des Webservers/Hosters: [Speicherdauer, z. B. max. 7 Tage, ggf. IP-gekürzt – beim Hoster prüfen und konfigurieren].
          Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Funktionsfähigkeit) bzw. [bei Verantwortlichkeit des Arbeitgebers ggf. Art. 6 Abs. 1 lit. c/e i. V. m. BetrVG – prüfen].
        </p>

        <h2>4. Cookies und Speicherung auf Ihrem Gerät</h2>
        <ul>
          <li><strong>Belegschafts-Zugang</strong> (nur nach Eingabe des Codes): technisches Merkmal ohne Personenbezug, 180 Tage, löschbar über „Zugang entfernen“.</li>
          <li><strong>Anmeldung</strong> (nur Betriebsratsmitglieder): Sitzungs-Cookie, max. 7 Tage, Abmeldung nach 24 h Inaktivität.</li>
          <li><strong>„Neu“-Markierung</strong>: Zeitpunkt Ihres letzten Besuchs, ausschließlich lokal im Browser (localStorage), wird nie übertragen.</li>
          <li><strong>Service Worker</strong>: speichert nur Programmbestandteile und eine Offline-Seite, keine Mitteilungsinhalte.</li>
        </ul>
        <p>Diese Speicherungen sind für die von Ihnen ausdrücklich gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).</p>

        <h2>5. Push-Benachrichtigungen</h2>
        <p>
          Wenn Sie Benachrichtigungen aktivieren, speichern wir die von Ihrem Browser erzeugte Push-Adresse (Endpunkt und Schlüssel), Ihre Themenauswahl und das Datum der letzten Aktivierung (ohne Uhrzeit). Ein Name oder eine andere Kennung wird nicht gespeichert. Die Benachrichtigungen werden Ende-zu-Ende-verschlüsselt über den Push-Dienst Ihres Browserherstellers zugestellt (z. B. Google Firebase Cloud Messaging, Apple Push Notification Service, Mozilla Push Service, Microsoft Windows Push Notification Service). Diese Dienste können den Inhalt nicht lesen, erfahren aber, dass eine Nachricht an Ihr Gerät gesendet wird; dabei kann es zu Übermittlungen in Drittländer (z. B. USA) kommen [Rechtsgrundlage/Absicherung prüfen, z. B. EU-US Data Privacy Framework].
        </p>
        <p>
          Rechtsgrundlage: Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG), jederzeit widerrufbar über „Benachrichtigungen deaktivieren“ oder die Geräteeinstellungen. Löschung: sofort bei Abmeldung, sobald der Push-Dienst das Abo als ungültig meldet, nach 5 Fehlversuchen oder nach 180 Tagen ohne Aufruf der Einstellungsseite.
        </p>

        <h2>6. Konten von Betriebsratsmitgliedern</h2>
        <p>
          Für Mitglieder der Redaktion werden Name, E-Mail-Adresse, ein sicherer Passwort-Hash (scrypt), Rolle und ein Änderungsprotokoll (wer hat wann was veröffentlicht; 12 Monate) gespeichert. Löschung beim Entfernen aus dem Team.
        </p>

        <h2>7. Inhalte der Mitteilungen</h2>
        <p>Mitteilungen werden vom Betriebsrat erstellt. Sie sollen keine personenbezogenen Daten einzelner Beschäftigter enthalten; die Anwendung warnt vor der Veröffentlichung bei entsprechenden Hinweisen.</p>

        <h2>8. Ihre Rechte</h2>
        <p>
          Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit sowie Widerruf erteilter Einwilligungen und Beschwerde bei einer Aufsichtsbehörde [zuständige Behörde eintragen]. Da wir Leserinnen und Leser nicht identifizieren, können wir Daten oft keiner Person zuordnen (Art. 11 DSGVO); Ihr Push-Abo können Sie jederzeit selbst löschen.
        </p>
        <p className="text-sm text-muted">Stand: [Datum]</p>
        <p><Link className="link" href="/">Zur Startseite</Link></p>
      </article>
    </main>
  );
}
