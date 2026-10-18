import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { TenantNav, BellLink } from "@/components/tenant-nav";
import { loadTenant, readerAccess } from "@/lib/server/context";

type Props = { children: React.ReactNode; params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  return {
    title: { default: tenant.name, template: `%s · ${tenant.name}` },
    manifest: `/b/${slug}/manifest.webmanifest`,
    appleWebApp: { capable: true, title: "Betriebsrat", statusBarStyle: "black" },
  };
}

export default async function TenantLayout({ children, params }: Props) {
  const { slug } = await params;
  const tenant = await loadTenant(slug);
  const access = await readerAccess(slug);
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="bg-[#111111] text-white">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-2.5">
          <Link href={`/b/${slug}`} className="flex min-w-0 flex-1 items-center gap-3 rounded">
            <LogoMark className="h-11 w-11 shrink-0" title="" />
            <span className="min-w-0">
              <span className="block truncate text-base leading-tight font-bold">{tenant.name}</span>
              {tenant.companyName ? <span className="block truncate text-xs tracking-wider text-white/80 uppercase">{tenant.companyName}</span> : null}
            </span>
          </Link>
          {access.member ? (
            <Link href={`/admin/${slug}`} className="btn-ghost hidden px-3 text-sm text-white hover:bg-white/10 sm:inline-flex">
              Verwaltung
            </Link>
          ) : null}
          <BellLink slug={slug} />
        </div>
      </header>
      <TenantNav slug={slug} />
      <main id="inhalt" className="mx-auto w-full max-w-5xl flex-1 px-4 pt-5 pb-28 md:pb-10">
        {children}
      </main>
      <footer className="hidden border-t border-slate-200 bg-white py-5 text-center text-sm text-muted md:block">
        <Link href="/datenschutz" className="link">Datenschutz</Link> · <Link href="/impressum" className="link">Impressum</Link> · Keine Werbung, kein Tracking.
      </footer>
    </div>
  );
}
