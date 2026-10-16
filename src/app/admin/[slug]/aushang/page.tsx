import { headers } from "next/headers";
import QRCode from "qrcode";
import { requireActor } from "@/lib/server/context";
import { env } from "@/lib/env";
import { BrandPanel } from "@/components/logo";
import { PrintButton } from "@/components/print-button";

export const metadata = { title: "Aushang" };

export default async function Aushang({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ code?: string }> }) {
  const { slug } = await params;
  const { code } = await searchParams;
  const { tenant } = await requireActor(slug);
  const h = await headers();
  const base = env().APP_URL ?? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${base}/b/${slug}`;
  const qr = await QRCode.toDataURL(url, { margin: 1, width: 600, errorCorrectionLevel: "M" });
  const withCodeLine = code === "1";
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <PrintButton />
        <a className="btn-secondary" href={withCodeLine ? `?` : `?code=1`}>{withCodeLine ? "Ohne Zeile für Zugangscode" : "Mit Zeile für Zugangscode (handschriftlich)"}</a>
        <p className="w-full text-sm text-muted">Tipp: Den Belegschafts-Zugangscode nie öffentlich sichtbar aushängen, wenn der Aushang auch für Besucher sichtbar ist.</p>
      </div>
      <article className="mx-auto max-w-[190mm] rounded-2xl border-2 border-slate-300 bg-white p-8 text-center print:border-0 print:p-0">
        <div className="mx-auto max-w-sm"><BrandPanel companyName={tenant.companyName} slogan={tenant.slogan} sloganSub={tenant.sloganSub} compact /></div>
        <h1 className="mt-6 text-3xl font-extrabold text-brand-900">Infos vom Betriebsrat aufs Handy</h1>
        <p className="mt-2 text-lg">Aktuell, direkt, ohne Anmeldung. Keine Werbung, kein Tracking.</p>
        {/* eslint-disable-next-line @next/next/no-img-element -- lokal erzeugter QR-Code */}
        <img src={qr} alt={`QR-Code zu ${url}`} width={260} height={260} className="mx-auto mt-6" />
        <p className="mt-3 text-xl font-bold break-all">{url.replace(/^https?:\/\//, "")}</p>
        <ol className="mx-auto mt-6 max-w-md list-decimal space-y-1 text-left text-lg">
          <li>QR-Code mit der Handykamera scannen</li>
          <li>Optional: „Zum Home-Bildschirm hinzufügen“ – dann wirkt es wie eine App</li>
          <li>Optional: unter „Benachrichtigungen“ Hinweise bei neuen Mitteilungen aktivieren</li>
        </ol>
        {withCodeLine ? <p className="mt-8 text-left text-lg">Belegschafts-Zugangscode: ________________________</p> : null}
        <p className="mt-8 text-sm text-slate-600">{tenant.name}</p>
      </article>
    </div>
  );
}
