"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav({ slug, isAdmin }: { slug: string; isAdmin: boolean }) {
  const pathname = usePathname();
  const base = `/admin/${slug}`;
  const items = [
    { href: base, label: "Übersicht", exact: true },
    { href: `${base}/mitteilungen`, label: "Mitteilungen" },
    ...(isAdmin
      ? [
          { href: `${base}/team`, label: "Team" },
          { href: `${base}/kontakte`, label: "Ansprechpartner" },
          { href: `${base}/kategorien`, label: "Kategorien" },
          { href: `${base}/einstellungen`, label: "Einstellungen" },
          { href: `${base}/protokoll`, label: "Protokoll" },
        ]
      : []),
  ];
  return (
    <nav aria-label="Verwaltung" className="overflow-x-auto border-b border-slate-200 bg-white">
      <ul className="mx-auto flex max-w-6xl gap-1 px-4">
        {items.map((it) => {
          const active = it.exact ? pathname === it.href : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                aria-current={active ? "page" : undefined}
                className={"inline-flex min-h-12 items-center border-b-3 px-3 font-semibold whitespace-nowrap " + (active ? "border-brand-700 text-brand-900" : "border-transparent text-muted hover:text-brand-800")}
              >
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
