"use client";
import { useEffect, useState } from "react";

/**
 * "Neu seit Ihrem letzten Besuch" – wird AUSSCHLIESSLICH im Browser gespeichert
 * (localStorage) und nie an den Server übertragen. Kein Lese-Tracking.
 */
const key = (slug: string) => `brd:lastVisit:${slug}`;

function readLastVisit(slug: string): number | null {
  try {
    const v = window.localStorage.getItem(key(slug));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function NewBadge({ slug, publishedAt }: { slug: string; publishedAt: string }) {
  const [isNew, setIsNew] = useState(false);
  useEffect(() => {
    const last = readLastVisit(slug);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage ist erst im Browser verfügbar
    setIsNew(last !== null && new Date(publishedAt).getTime() > last);
  }, [slug, publishedAt]);
  if (!isNew) return null;
  return <span className="rounded-full bg-accent-600 px-2.5 py-0.5 text-sm font-bold text-white">Neu</span>;
}

/** Merkt sich beim Verlassen der Startseite den Besuchszeitpunkt (nur lokal). */
export function VisitTracker({ slug }: { slug: string }) {
  useEffect(() => {
    return () => {
      try {
        window.localStorage.setItem(key(slug), String(Date.now()));
      } catch {
        /* privat-Modus o. ä. – dann eben ohne Neu-Markierung */
      }
    };
  }, [slug]);
  return null;
}
