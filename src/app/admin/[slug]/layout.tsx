import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { AdminNav } from "@/components/admin-nav";
import { Alert } from "@/components/ui";
import { readFlash, requireActor } from "@/lib/server/context";
import { logoutAction } from "@/app/login/actions";

export const metadata = { title: { default: "Verwaltung", template: "%s · Verwaltung" } };

export default async function AdminLayout({ children, params }: { children: React.ReactNode; params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { tenant, actor, user } = await requireActor(slug);
  const flash = await readFlash();
  return (
    <div className="flex min-h-full flex-col bg-slate-50">
      <header className="bg-brand-900 text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-2.5">
          <Link href={`/admin/${slug}`} className="flex min-w-0 flex-1 items-center gap-3 rounded">
            <span className="rounded-lg bg-[#111111] p-1"><LogoMark className="h-9 w-9" title="" /></span>
            <span className="min-w-0">
              <span className="block truncate font-bold">{tenant.name}</span>
              <span className="block text-xs text-white/80">Verwaltung · {actor.role === "admin" ? "Administrator/in" : actor.canPublish ? "Redaktion (mit Veröffentlichung)" : "Redaktion"}</span>
            </span>
          </Link>
          <Link href={`/b/${slug}`} className="btn-ghost px-3 text-sm text-white hover:bg-white/10">Ansicht für Beschäftigte</Link>
          <form action={logoutAction}>
            <button type="submit" className="btn-ghost px-3 text-sm text-white hover:bg-white/10" title={user.email}>Abmelden</button>
          </form>
        </div>
      </header>
      <AdminNav slug={slug} isAdmin={actor.role === "admin"} />
      <main id="inhalt" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
        {flash ? <div className="mb-5"><Alert kind={flash.kind}>{flash.text}</Alert></div> : null}
        {children}
      </main>
    </div>
  );
}
