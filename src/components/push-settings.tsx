"use client";
import { useCallback, useEffect, useState } from "react";

type Cat = { id: string; name: string };
type Env =
  | { kind: "loading" }
  | { kind: "unsupported" }
  | { kind: "ios-needs-install"; tooOld: boolean }
  | { kind: "ios-too-old" }
  | { kind: "ready" };

function base64UrlToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function detectEnv(): Env {
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as unknown as { standalone?: boolean }).standalone === true;
  if (isIOS) {
    const m = /OS (\d+)_(\d+)/.exec(ua);
    const tooOld = m ? Number(m[1]) < 16 || (Number(m[1]) === 16 && Number(m[2]) < 4) : false;
    if (tooOld) return { kind: "ios-too-old" };
    if (!standalone) return { kind: "ios-needs-install", tooOld };
  }
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return { kind: "unsupported" };
  }
  return { kind: "ready" };
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Die Anfrage ist fehlgeschlagen.");
  return data;
}

export function PushSettings({ slug, vapidPublicKey, categories }: { slug: string; vapidPublicKey: string | null; categories: Cat[] }) {
  const [env, setEnv] = useState<Env>({ kind: "loading" });
  const [permission, setPermission] = useState<NotificationPermission | "unknown">("unknown");
  const [subscribed, setSubscribed] = useState(false);
  const [allCats, setAllCats] = useState(true);
  const [selected, setSelected] = useState<string[]>([]);
  const [onlyImportant, setOnlyImportant] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const getSub = useCallback(async () => {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    return { reg, sub: await reg.pushManager.getSubscription() };
  }, []);

  useEffect(() => {
    const e = detectEnv();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Browserfähigkeiten sind erst im Client bekannt
    setEnv(e);
    if (e.kind !== "ready") return;
    setPermission(Notification.permission);
    (async () => {
      try {
        const { sub } = await getSub();
        if (!sub) return;
        const st = await post("/api/push/status", { slug, endpoint: sub.endpoint });
        if (st.subscribed) {
          setSubscribed(true);
          const ids: string[] | null = st.prefs?.categoryIds ?? null;
          setAllCats(!ids || ids.length === 0);
          setSelected(ids ?? []);
          setOnlyImportant(Boolean(st.prefs?.onlyImportant));
          // Lebenszeichen (nur Tagesdatum) – verhindert Löschung aktiver Abos nach 180 Tagen
          await post("/api/push/subscribe", { slug, subscription: sub.toJSON(), categoryIds: ids, onlyImportant: Boolean(st.prefs?.onlyImportant) });
        }
      } catch {
        /* Status unbekannt – Nutzer kann neu aktivieren */
      }
    })();
  }, [slug, getSub]);

  async function enable() {
    if (!vapidPublicKey) return;
    setBusy(true);
    setMsg(null);
    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        setMsg({ kind: "err", text: "Sie haben Benachrichtigungen nicht erlaubt. Sie können das jederzeit in den Einstellungen Ihres Geräts ändern." });
        return;
      }
      const { reg } = await getSub();
      let sub = await reg.pushManager.getSubscription();
      if (!sub) {
        sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(vapidPublicKey) });
      }
      await post("/api/push/subscribe", { slug, subscription: sub.toJSON(), categoryIds: allCats ? null : selected, onlyImportant });
      setSubscribed(true);
      setMsg({ kind: "ok", text: "Benachrichtigungen sind aktiviert." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message || "Aktivierung fehlgeschlagen." });
    } finally {
      setBusy(false);
    }
  }

  async function savePrefs() {
    setBusy(true);
    setMsg(null);
    try {
      const { sub } = await getSub();
      if (!sub) throw new Error("Auf diesem Gerät ist kein Abo vorhanden. Bitte neu aktivieren.");
      await post("/api/push/subscribe", { slug, subscription: sub.toJSON(), categoryIds: allCats ? null : selected, onlyImportant });
      setMsg({ kind: "ok", text: "Einstellungen gespeichert." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMsg(null);
    try {
      const { sub } = await getSub();
      if (sub) await post("/api/push/unsubscribe", { slug, endpoint: sub.endpoint });
      setSubscribed(false);
      setMsg({ kind: "ok", text: "Benachrichtigungen für diesen Betriebsrat sind deaktiviert. Ihr Abo wurde gelöscht." });
    } catch (e) {
      setMsg({ kind: "err", text: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  async function testLocal() {
    const { reg } = await getSub();
    await reg.showNotification("Test: Betriebsrat Direkt", {
      body: "So sieht eine Benachrichtigung auf diesem Gerät aus.",
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      tag: "brd-test",
    });
  }

  if (env.kind === "loading") return <p className="text-muted">Prüfe die Möglichkeiten dieses Geräts …</p>;

  if (env.kind === "ios-too-old")
    return (
      <div className="card space-y-2">
        <h2 className="text-lg font-bold">iPhone/iPad: Update erforderlich</h2>
        <p>Push-Benachrichtigungen für Web-Apps gibt es auf dem iPhone ab iOS bzw. iPadOS 16.4. Bitte aktualisieren Sie Ihr Gerät unter „Einstellungen → Allgemein → Softwareupdate“. Die Mitteilungen können Sie natürlich trotzdem jederzeit hier lesen.</p>
      </div>
    );

  if (env.kind === "ios-needs-install")
    return (
      <div className="card space-y-3">
        <h2 className="text-lg font-bold">iPhone/iPad: zuerst zum Home-Bildschirm hinzufügen</h2>
        <p>Apple erlaubt Benachrichtigungen nur für Web-Apps, die auf dem Home-Bildschirm liegen. So geht es (einmalig, ca. 30 Sekunden):</p>
        <ol className="list-decimal space-y-2 pl-6">
          <li>Diese Seite in <strong>Safari</strong> öffnen.</li>
          <li>Unten (oder oben) auf das <strong>Teilen-Symbol</strong> tippen <span aria-hidden="true">(□ mit Pfeil nach oben)</span>.</li>
          <li><strong>„Zum Home-Bildschirm“</strong> wählen und „Hinzufügen“ tippen.</li>
          <li>Die App <strong>über das neue Symbol</strong> öffnen und hier „Benachrichtigungen aktivieren“ tippen.</li>
        </ol>
        <p className="hint">Voraussetzung: iOS/iPadOS 16.4 oder neuer.</p>
      </div>
    );

  if (env.kind === "unsupported")
    return (
      <div className="card">
        <h2 className="text-lg font-bold">Dieser Browser unterstützt keine Push-Benachrichtigungen</h2>
        <p className="mt-2">Bitte verwenden Sie einen aktuellen Browser (z. B. Chrome, Edge, Firefox oder Safari). Im privaten Modus sind Benachrichtigungen oft gesperrt.</p>
      </div>
    );

  if (!vapidPublicKey)
    return (
      <div className="card">
        <p>Push-Benachrichtigungen sind auf diesem Server noch nicht eingerichtet. Bitte wenden Sie sich an den Betriebsrat.</p>
      </div>
    );

  return (
    <div className="space-y-5">
      {msg ? (
        <p role={msg.kind === "err" ? "alert" : "status"} className={"rounded-lg border px-4 py-3 " + (msg.kind === "ok" ? "border-green-300 bg-green-50 text-green-900" : "border-red-300 bg-red-50 text-red-900")}>
          {msg.text}
        </p>
      ) : null}

      <div className="card space-y-3">
        <p className="text-lg font-bold">
          Status:{" "}
          {subscribed ? <span className="text-green-800">aktiv auf diesem Gerät</span> : <span className="text-muted">nicht aktiv</span>}
        </p>
        {permission === "denied" ? (
          <p className="rounded-lg bg-amber-50 p-3 text-amber-950">
            Benachrichtigungen sind für diese Seite im Browser blockiert. Bitte erlauben Sie sie in den Browser- bzw. Geräteeinstellungen und laden Sie die Seite neu.
          </p>
        ) : null}
      </div>

      <fieldset className="card space-y-3">
        <legend className="px-1 text-lg font-bold">Worüber möchten Sie informiert werden?</legend>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" className="h-5 w-5" checked={allCats} onChange={(e) => setAllCats(e.target.checked)} />
          Alle Themen
        </label>
        {!allCats ? (
          <div className="grid gap-1 pl-2 sm:grid-cols-2">
            {categories.map((c) => (
              <label key={c.id} className="flex min-h-11 items-center gap-3">
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  checked={selected.includes(c.id)}
                  onChange={(e) => setSelected((s) => (e.target.checked ? [...s, c.id] : s.filter((x) => x !== c.id)))}
                />
                {c.name}
              </label>
            ))}
          </div>
        ) : null}
        <label className="flex min-h-11 items-center gap-3 border-t border-slate-200 pt-3">
          <input type="checkbox" className="h-5 w-5" checked={onlyImportant} onChange={(e) => setOnlyImportant(e.target.checked)} />
          Nur wichtige und dringende Mitteilungen
        </label>
      </fieldset>

      <div className="flex flex-wrap gap-3">
        {!subscribed ? (
          <button type="button" className="btn-primary" onClick={enable} disabled={busy || permission === "denied" || (!allCats && selected.length === 0)}>
            {busy ? "Bitte warten …" : "Benachrichtigungen aktivieren"}
          </button>
        ) : (
          <>
            <button type="button" className="btn-primary" onClick={savePrefs} disabled={busy || (!allCats && selected.length === 0)}>
              Einstellungen speichern
            </button>
            <button type="button" className="btn-danger" onClick={disable} disabled={busy}>
              Benachrichtigungen deaktivieren
            </button>
            <button type="button" className="btn-ghost" onClick={testLocal}>
              Test auf diesem Gerät anzeigen
            </button>
          </>
        )}
      </div>
    </div>
  );
}
