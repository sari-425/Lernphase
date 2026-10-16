"use client";
import { useState } from "react";

/** Teilt nur den Link (keine Inhalte, keine Tracking-Parameter). */
export function ShareButton({ title, path }: { title: string; path: string }) {
  const [copied, setCopied] = useState(false);
  async function onClick() {
    const url = new URL(path, window.location.origin).toString();
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* abgebrochen */
    }
  }
  return (
    <button type="button" onClick={onClick} className="btn-secondary">
      <span aria-hidden="true">🔗</span> {copied ? "Link kopiert" : "Link teilen"}
      <span className="sr-only" aria-live="polite">{copied ? "Link wurde in die Zwischenablage kopiert" : ""}</span>
    </button>
  );
}
