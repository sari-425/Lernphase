"use client";
import { useEffect } from "react";

/** Registriert den Service Worker (Offline-Hinweis + Push-Empfang). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      /* ohne Service Worker funktioniert die Seite trotzdem */
    });
  }, []);
  return null;
}
