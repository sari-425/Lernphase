import { Alert } from "@/components/ui";
import { MessageBody } from "@/components/message-body";
import { legalIncomplete, type LegalTenant } from "@/lib/content/legal";
import { formatDate } from "@/lib/time";

/** Vom Betriebsrat gepflegter Text – ausschließlich über das sichere Textformat (kein HTML). */
function Field({ value }: { value: string }) {
  if (!value.trim()) return <p className="text-muted italic">– noch nicht angegeben –</p>;
  return <MessageBody body={value} />;
}

export function Imprint({ tenant }: { tenant: LegalTenant | null }) {
  return (
    <article className="space-y-4">
      <h1 className="text-3xl font-bold text-brand-900">Impressum</h1>
      {legalIncomplete(tenant, "imprint") ? (
        <Alert kind="warning" title="Angaben unvollständig">
          {tenant
            ? "Der Betriebsrat hat die Angaben für das Impressum noch nicht eingetragen."
            : "Das Impressum steht auf der Seite des jeweiligen Betriebsrats (Link „Impressum“ unten auf dessen Seite)."}
        </Alert>
      ) : null}
      {tenant ? <Field value={tenant.imprintText} /> : null}
      <p>Inhaltlich verantwortlich für die Mitteilungen ist der jeweilige Betriebsrat.</p>
    </article>
  );
}

export function Privacy({ tenant }: { tenant: LegalTenant | null }) {
  return (
    <article className="space-y-5 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-brand-900 [&_h3]:mt-4 [&_h3]:font-semibold [&_li]:ml-6 [&_li]:list-disc">
      <h1 className="text-3xl font-bold text-brand-900">Datenschutzerklärung</h1>
      {legalIncomplete(tenant, "privacy") ? (
        <Alert kind="warning" title="Angaben unvollständig">
          {tenant
            ? "Einige Angaben (z. B. Verantwortlicher, Hosting, Aufsichtsbehörde) hat der Betriebsrat noch nicht eingetragen."
            : "Die Angaben zum Verantwortlichen stehen in der Datenschutzerklärung auf der Seite des jeweiligen Betriebsrats."}
        </Alert>
      ) : null}

      <h2>1. Kurz und verständlich</h2>
      <ul>
        <li>Zum Lesen der Mitteilungen brauchen Sie kein Konto. Wir fragen weder Namen noch E-Mail-Adresse noch Telefonnummer ab.</li>
        <li>Es gibt keine Werbung, keine Analyse- oder Marketing-Cookies, kein Tracking, keine Standortabfrage.</li>
        <li>Wir erfassen nicht, wer welche Mitteilung liest.</li>
        <li>Es werden keine Daten an KI-Anbieter übermittelt.</li>
        <li>Push-Benachrichtigungen sind freiwillig und jederzeit abschaltbar; dabei wird Ihr Abo sofort gelöscht.</li>
      </ul>

      <h2>2. Verantwortlicher und Kontakt</h2>
      <h3>Verantwortlicher im Sinne der DSGVO</h3>
      {tenant ? <Field value={tenant.privacyController} /> : null}
      <p className="text-sm text-muted">
        Nach § 79a BetrVG ist bei der Verarbeitung personenbezogener Daten durch den Betriebsrat in der Regel der Arbeitgeber datenschutzrechtlich Verantwortlicher; der Betriebsrat hält die Vorschriften über den Datenschutz ein.
      </p>
      <h3>Inhaltlich verantwortlich für die Mitteilungen</h3>
      {tenant ? <Field value={tenant.privacyCouncilContact} /> : null}
      <h3>Datenschutzbeauftragte/r</h3>
      {tenant ? <Field value={tenant.privacyDpo} /> : null}
      <h3>Technischer Betrieb (Hosting)</h3>
      {tenant ? <Field value={tenant.privacyHosting} /> : null}
      <p className="text-sm text-muted">Der Hosting-Anbieter verarbeitet die Daten als Auftragsverarbeiter nach Art. 28 DSGVO.</p>

      <h2>3. Aufruf der Seiten</h2>
      <p>
        Beim Aufruf überträgt Ihr Browser technisch notwendig Ihre IP-Adresse, Datum/Uhrzeit, die aufgerufene Adresse und Browserangaben. Die Anwendung speichert keine IP-Adressen, und der Webserver führt in der Standardeinrichtung keine Zugriffsprotokolle. Zur Abwehr von Angriffen werden bei Anmeldeversuchen, Codeeingaben und Push-Anmeldungen kurzzeitig nicht rückrechenbare Prüfwerte (HMAC) der IP-Adresse gespeichert und nach spätestens 24 Stunden gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (Sicherheit und Funktionsfähigkeit).
      </p>

      <h2>4. Cookies und Speicherung auf Ihrem Gerät</h2>
      <ul>
        <li><strong>Belegschafts-Zugang</strong> (nur nach Eingabe des Codes): technisches Merkmal ohne Personenbezug, 180 Tage, löschbar über „Zugang entfernen“.</li>
        <li><strong>Anmeldung</strong> (nur Betriebsratsmitglieder): Sitzungs-Cookie, max. 7 Tage, Abmeldung nach 24 h Inaktivität.</li>
        <li><strong>„Neu“-Markierung</strong>: Zeitpunkt Ihres letzten Besuchs, ausschließlich lokal im Browser (localStorage), wird nie übertragen.</li>
        <li><strong>Service Worker</strong>: speichert nur Programmbestandteile und eine Offline-Seite, keine Mitteilungsinhalte.</li>
        <li><strong>Umfragen</strong> (nur wenn Sie abstimmen): zufälliger Gerätewert ohne Personenbezug, 12 Monate, damit pro Gerät nur einmal abgestimmt wird.</li>
      </ul>
      <p>Diese Speicherungen sind für die von Ihnen ausdrücklich gewünschten Funktionen unbedingt erforderlich (§ 25 Abs. 2 Nr. 2 TDDDG).</p>

      <h2>5. Push-Benachrichtigungen</h2>
      <p>
        Wenn Sie Benachrichtigungen aktivieren, speichern wir die von Ihrem Browser erzeugte Push-Adresse (Endpunkt und Schlüssel), Ihre Themenauswahl und das Datum der letzten Aktivierung (ohne Uhrzeit). Ein Name oder eine andere Kennung wird nicht gespeichert. Die Benachrichtigungen werden Ende-zu-Ende-verschlüsselt über den Push-Dienst Ihres Browserherstellers zugestellt (z. B. Google Firebase Cloud Messaging, Apple Push Notification Service, Mozilla Push Service, Microsoft Windows Push Notification Service). Diese Dienste können den Inhalt nicht lesen, erfahren aber, dass eine Nachricht an Ihr Gerät gesendet wird. Dabei kann es zu Übermittlungen in Drittländer (z. B. USA) kommen; dies erfolgt auf Grundlage Ihrer Einwilligung bzw. des EU-US Data Privacy Framework, soweit der jeweilige Anbieter danach zertifiziert ist.
      </p>
      <p>
        Rechtsgrundlage: Ihre Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG), jederzeit widerrufbar über „Benachrichtigungen deaktivieren“ oder die Geräteeinstellungen. Löschung: sofort bei Abmeldung, sobald der Push-Dienst das Abo als ungültig meldet, nach 5 Fehlversuchen oder nach 180 Tagen ohne Aufruf der Einstellungsseite.
      </p>

      <h2>6. Umfragen</h2>
      <p>
        Umfragen sind anonym. Gespeichert wird nur die gewählte Antwort und – solange die Umfrage läuft – eine nicht umkehrbare Prüfsumme aus dem zufälligen Gerätewert, um Mehrfachabstimmungen vom selben Gerät zu verhindern. Mit Ende der Umfrage wird auch diese Prüfsumme gelöscht; übrig bleibt nur die Anzahl der Stimmen. Name, IP-Adresse oder Zeitpunkt der Stimmabgabe werden nicht gespeichert. Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO; Speicherung auf dem Gerät: § 25 Abs. 2 Nr. 2 TDDDG.
      </p>

      <h2>7. Konten von Betriebsratsmitgliedern</h2>
      <p>
        Für Mitglieder der Redaktion werden Name, E-Mail-Adresse, ein sicherer Passwort-Hash (scrypt), Rolle und ein Änderungsprotokoll (wer hat wann was veröffentlicht; 12 Monate) gespeichert. Bei aktivierter Zwei-Faktor-Anmeldung zusätzlich das verschlüsselte TOTP-Geheimnis und Prüfsummen der Wiederherstellungscodes. Links zum Zurücksetzen des Passworts gelten 24 Stunden und werden spätestens 7 Tage danach gelöscht. Löschung des Kontos beim Entfernen aus dem Team.
      </p>

      <h2>8. Inhalte der Mitteilungen</h2>
      <p>Mitteilungen werden vom Betriebsrat erstellt. Sie sollen keine personenbezogenen Daten einzelner Beschäftigter enthalten; die Anwendung warnt vor der Veröffentlichung bei entsprechenden Hinweisen.</p>

      <h2>9. Ihre Rechte</h2>
      <p>
        Sie haben das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch, Datenübertragbarkeit sowie Widerruf erteilter Einwilligungen. Da wir Leserinnen und Leser nicht identifizieren, können wir Daten oft keiner Person zuordnen (Art. 11 DSGVO); Ihr Push-Abo können Sie jederzeit selbst löschen.
      </p>
      <h3>Beschwerde bei einer Aufsichtsbehörde</h3>
      {tenant ? <Field value={tenant.privacyAuthority} /> : null}
      {tenant?.legalUpdatedAt ? <p className="text-sm text-muted">Stand: {formatDate(tenant.legalUpdatedAt)}</p> : null}
    </article>
  );
}
