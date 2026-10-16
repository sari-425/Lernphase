import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Betriebsrat Direkt", template: "%s · Betriebsrat Direkt" },
  description: "Informationen Ihres Betriebsrats – direkt, sicher und ohne Tracking.",
  applicationName: "Betriebsrat Direkt",
  robots: { index: false, follow: false },
  formatDetection: { telephone: false },
  appleWebApp: { capable: true, title: "Betriebsrat", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#111111",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Liest die Anfrage-Header: dadurch wird jede Seite pro Anfrage gerendert und erhält
  // die CSP-Nonce (siehe src/proxy.ts). Bewusst kein statisches Zwischenspeichern.
  await headers();
  return (
    <html lang="de" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <a href="#inhalt" className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-white focus:p-3 focus:shadow">
          Zum Inhalt springen
        </a>
        {children}
      </body>
    </html>
  );
}
