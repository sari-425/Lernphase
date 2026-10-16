"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ICONS: Record<string, React.ReactNode> = {
  start: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  aktuell: <path d="M4 5h16v14H4zM8 9h8M8 13h8M8 17h5" fill="none" stroke="currentColor" strokeWidth="2" />,
  themen: <path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="none" stroke="currentColor" strokeWidth="2" />,
  archiv: <path d="M3 5h18v4H3zM5 9v10h14V9M10 13h4" fill="none" stroke="currentColor" strokeWidth="2" />,
  kontakt: <path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0z" />,
  push: <path d="M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 15a2 2 0 0 0 4 0" />,
};

export function TenantNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/b/${slug}`;
  const items = [
    { href: base, label: "Start", icon: "start", exact: true },
    { href: `${base}/mitteilungen`, label: "Aktuell", icon: "aktuell" },
    { href: `${base}/kategorien`, label: "Themen", icon: "themen" },
    { href: `${base}/archiv`, label: "Archiv & Suche", short: "Archiv", icon: "archiv" },
    { href: `${base}/umfragen`, label: "Umfragen", icon: "themen", desktopOnly: true },
    { href: `${base}/kontakt`, label: "Ansprechpartner", short: "Kontakt", icon: "kontakt" },
    { href: `${base}/benachrichtigungen`, label: "Benachrichtigungen", short: "Push", icon: "push", desktopOnly: true },
  ];
  const isActive = (href: string, exact?: boolean) => (exact ? pathname === href : pathname === href || pathname.startsWith(href + "/"));
  return (
    <>
      {/* Desktop */}
      <nav aria-label="Hauptnavigation" className="hidden overflow-x-auto border-b border-slate-200 bg-white md:block">
        <ul className="mx-auto flex max-w-5xl gap-1 px-4 whitespace-nowrap">
          {items.map((it) => (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={isActive(it.href, it.exact) ? "page" : undefined}
                className={
                  "inline-flex min-h-12 items-center border-b-3 px-3 font-semibold " +
                  (isActive(it.href, it.exact) ? "border-brand-700 text-brand-900" : "border-transparent text-muted hover:text-brand-800")
                }
              >
                {it.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {/* Smartphone: feste Leiste unten, große Tippflächen */}
      <nav aria-label="Hauptnavigation" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <ul className="grid grid-cols-5">
          {items
            .filter((it) => !it.desktopOnly)
            .map((it) => {
              const active = isActive(it.href, it.exact);
              return (
                <li key={it.href}>
                  <Link
                    href={it.href}
                    aria-current={active ? "page" : undefined}
                    className={"flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold " + (active ? "text-brand-800" : "text-slate-600")}
                  >
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
                      {ICONS[it.icon]}
                    </svg>
                    {it.short ?? it.label}
                  </Link>
                </li>
              );
            })}
        </ul>
      </nav>
    </>
  );
}

export function BellLink({ slug }: { slug: string }) {
  return (
    <Link href={`/b/${slug}/benachrichtigungen`} className="btn-ghost px-2 text-white hover:bg-white/10 md:hidden" aria-label="Benachrichtigungen einstellen">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="currentColor" aria-hidden="true">
        {ICONS.push}
      </svg>
    </Link>
  );
}
