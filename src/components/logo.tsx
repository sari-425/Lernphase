/**
 * Logo "BR – Betriebsrat" nach der Vorlage (Rahmen, drei Personen mit offenem Buch, BR).
 * Reine Vektorgrafik ohne Schriftabhängigkeit – identisch mit public/icons/icon.svg.
 */
export function LogoMark({ className, title = "Betriebsrat" }: { className?: string; title?: string }) {
  return (
    <svg
      viewBox="0 0 400 400"
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      {...(title ? { role: "img", "aria-label": title } : { "aria-hidden": true, focusable: "false" })}
    >
      <LogoPaths fg="currentColor" bg="var(--logo-bg, #111111)" />
    </svg>
  );
}

export function LogoPaths({ fg, bg }: { fg: string; bg: string }) {
  return (
    <g>
      {/* Rahmen, unten offen */}
      <path d="M58 330 V92 Q58 50 100 50 H300 Q342 50 342 92 V330" fill="none" stroke={fg} strokeWidth="12" strokeLinecap="round" />
      {/* Personen links/rechts */}
      <circle cx="126" cy="116" r="25" fill={fg} />
      <circle cx="274" cy="116" r="25" fill={fg} />
      <path d="M90 178 Q90 150 118 150 H134 Q162 150 162 178 V232 H90 Z" fill={fg} />
      <path d="M238 178 Q238 150 266 150 H282 Q310 150 310 178 V232 H238 Z" fill={fg} />
      {/* Person Mitte, abgesetzt durch Hintergrundkontur */}
      <circle cx="200" cy="96" r="32" fill={fg} stroke={bg} strokeWidth="8" paintOrder="stroke" />
      <path d="M148 180 Q148 142 186 142 H214 Q252 142 252 180 V228 H148 Z" fill={fg} stroke={bg} strokeWidth="9" strokeLinejoin="round" paintOrder="stroke" />
      {/* offenes Buch */}
      <path d="M146 234 Q174 226 200 238 Q226 226 254 234 V246 Q226 238 200 250 Q174 238 146 246 Z" fill={fg} />
      {/* B */}
      <g fill="none" stroke={fg} strokeWidth="28">
        <path d="M94 252 V378" />
        <path d="M94 266 H150 A23.5 23.5 0 0 1 150 313 H94" />
        <path d="M94 313 H156 A25.5 25.5 0 0 1 156 364 H94" />
        {/* R */}
        <path d="M226 252 V378" />
        <path d="M226 266 H284 A23.5 23.5 0 0 1 284 313 H226" />
        <path d="M268 313 L316 378" />
      </g>
    </g>
  );
}

/** Dunkle Marken-Kachel wie in der Vorlage: Zeichen + BETRIEBSRAT + Betrieb + Slogan. */
export function BrandPanel({
  companyName,
  slogan,
  sloganSub,
  compact = false,
}: {
  companyName?: string;
  slogan?: string;
  sloganSub?: string;
  compact?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-[#111111] px-6 py-6 text-center text-white shadow-sm">
      <LogoMark className={compact ? "mx-auto h-24 w-24" : "mx-auto h-36 w-36 sm:h-44 sm:w-44"} />
      <p className={"mt-2 font-extrabold " + (compact ? "text-xl tracking-[0.12em]" : "text-2xl tracking-[0.18em] sm:text-3xl")}>BETRIEBSRAT</p>
      {companyName ? (
        <>
          <div className="mx-auto my-2 h-px w-4/5 bg-white/80" aria-hidden="true" />
          <p className="text-sm tracking-[0.3em] text-white/90 uppercase">{companyName}</p>
        </>
      ) : null}
      {slogan ? <p className="mt-3 text-lg font-bold tracking-wide uppercase">{slogan}</p> : null}
      {sloganSub ? <p className="text-xs tracking-[0.2em] text-white/85 uppercase">{sloganSub}</p> : null}
    </div>
  );
}
