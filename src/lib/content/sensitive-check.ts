/**
 * Warnt vor Inhalten, die vor einer Veröffentlichung an die Belegschaft
 * besonders geprüft werden sollten (personenbezogene Daten, Personalangelegenheiten,
 * interne Gremiumsinhalte). Das ist eine HILFE, keine Garantie – die Verantwortung
 * für den Inhalt bleibt beim Betriebsrat.
 */
export interface SensitiveWarning {
  kind: "email" | "phone" | "iban" | "date_of_birth" | "keyword";
  label: string;
  match: string;
}

const KEYWORDS: Array<[RegExp, string]> = [
  [/\b(fristlose?n?\s+)?kündigung(en)?\s+(von|des|der|gegen)\b/i, "Kündigung einer Person"],
  [/\babmahnung(en)?\b/i, "Abmahnung"],
  [/\b(krankgeschrieben|arbeitsunfähig|krankmeldung|diagnose|erkrank\w*)\b/i, "Gesundheitsdaten"],
  [/\b(schwerbehindert\w*|schwerbehinderung|gdb\s*\d+)\b/i, "Schwerbehinderung"],
  [/\bpersonalakte\b/i, "Personalakte"],
  [/\b(lohnpfändung|pfändung)\b/i, "Pfändung"],
  [/\b(bem|betriebliches eingliederungsmanagement)\b/i, "BEM-Verfahren"],
  [/\b(schwanger\w*|mutterschutz)\b/i, "Schwangerschaft/Mutterschutz"],
  [/\b(gewerkschaftsmitglied\w*|religion|konfession)\b/i, "besondere Kategorie (Art. 9 DSGVO)"],
  [/\b(streng\s+)?vertraulich\b/i, "als vertraulich gekennzeichnet"],
  [/\b(nur\s+für\s+(das\s+)?gremium|gremiumsintern|nicht\s+zur\s+weitergabe)\b/i, "gremiumsintern"],
  [/\b(personalnummer|pers\.?-?nr\.?)\s*:?\s*\d+/i, "Personalnummer"],
];

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE = /(?:\+49|0049|\b0)[\s/-]?\d{2,5}[\s/-]?\d{3,}(?:[\s/-]?\d+)*/g;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){3,7}(?:\s?[A-Z0-9]{1,3})?\b/g;
const DOB = /\b(geb\.?|geboren(\s+am)?)\s*:?\s*\d{1,2}\.\s?\d{1,2}\.\s?\d{2,4}/gi;

export function checkSensitive(text: string): SensitiveWarning[] {
  const out: SensitiveWarning[] = [];
  const seen = new Set<string>();
  const add = (w: SensitiveWarning) => {
    const k = `${w.kind}|${w.label}|${w.match.toLowerCase()}`;
    if (!seen.has(k)) {
      seen.add(k);
      out.push(w);
    }
  };
  for (const m of text.matchAll(EMAIL)) add({ kind: "email", label: "E-Mail-Adresse", match: m[0] });
  for (const m of text.matchAll(PHONE)) {
    if (m[0].replace(/\D/g, "").length >= 7) add({ kind: "phone", label: "Telefonnummer", match: m[0].trim() });
  }
  for (const m of text.matchAll(IBAN)) add({ kind: "iban", label: "Bankverbindung (IBAN)", match: m[0] });
  for (const m of text.matchAll(DOB)) add({ kind: "date_of_birth", label: "Geburtsdatum", match: m[0] });
  for (const [re, label] of KEYWORDS) {
    const m = text.match(re);
    if (m) add({ kind: "keyword", label, match: m[0] });
  }
  return out;
}
