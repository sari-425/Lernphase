"use client";
import { useEffect } from "react";

/**
 * Registriert den Service Worker (Offline-Hinweis + Push-Empfang).
 * Im Entwicklungsmodus NICHT: Dort würde er bei gestopptem Server eine irreführende
 * Offline-Seite anzeigen. Bereits registrierte Service Worker werden dann entfernt.
 * (Die Push-Einstellungsseite registriert ihn bei Bedarf selbst, auch lokal.)
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") {
      if (window.location.pathname.endsWith("/benachrichtigungen")) return;
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
      return;
    }
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ohne Service Worker funktioniert die Seite trotzdem */
    });
  }, []);
  return null;
}
