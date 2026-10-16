import type { NextConfig } from "next";

/**
 * Bewusste Entscheidung: Cache Components ist AUS.
 * Diese App zeigt teils vertrauliche Inhalte (Belegschaft/Gremium). Jede Seite
 * wird daher pro Anfrage frisch gerendert, damit nie versehentlich ein
 * geschützter Inhalt in einem gemeinsamen Cache landet. Bei der zu erwartenden
 * Last (ein Betriebsrat, wenige tausend Beschäftigte) ist das unkritisch.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig: NextConfig = {
  cacheComponents: false,
  output: "standalone",
  poweredByHeader: false,
  serverExternalPackages: ["@electric-sql/pglite", "pg", "web-push"],
  experimental: {
    serverActions: {
      // Anhänge bis 5 MB + Formularfelder
      bodySizeLimit: "6mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
