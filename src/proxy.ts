import { NextResponse, type NextRequest } from "next/server";

/**
 * - Content-Security-Policy mit Nonce pro Anfrage (Schutz vor eingeschleustem Script)
 * - Schutz vor Cross-Site-Request-Forgery: zustandsändernde Anfragen müssen von
 *   derselben Herkunft kommen (zusätzlich zu SameSite-Cookies und der Origin-Prüfung
 *   von Next.js für Server Actions).
 */
export function proxy(request: NextRequest) {
  const method = request.method.toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const origin = request.headers.get("origin");
    const site = request.headers.get("sec-fetch-site");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    const isCron = request.nextUrl.pathname === "/api/cron";
    let sameOrigin = false;
    if (origin) {
      try {
        sameOrigin = new URL(origin).host === host;
      } catch {
        sameOrigin = false;
      }
    } else {
      sameOrigin = site === null || site === "same-origin" || site === "none";
    }
    if (!sameOrigin && !isCron) {
      return new NextResponse("Anfrage abgelehnt (fremde Herkunft).", { status: 403 });
    }
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const isDev = process.env.NODE_ENV === "development";
  const isHttps = request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    "connect-src 'self'",
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
