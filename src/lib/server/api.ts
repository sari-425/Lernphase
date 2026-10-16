import "server-only";
import { cookies } from "next/headers";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { getDb } from "@/lib/db";
import { sessionSecret } from "@/lib/env";
import { getTenantBySlug, hasStaffAccess } from "@/lib/services/tenants";
import { staffCookieName } from "./context";

export function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function readJson(req: Request, maxBytes = 10_000): Promise<unknown> {
  const len = Number(req.headers.get("content-length") ?? "0");
  if (len > maxBytes) throw new AppError("VALIDATION", "Anfrage zu groß.");
  const text = await req.text();
  if (text.length > maxBytes) throw new AppError("VALIDATION", "Anfrage zu groß.");
  try {
    return JSON.parse(text);
  } catch {
    throw new AppError("VALIDATION", "Ungültige Anfrage.");
  }
}

export function apiError(err: unknown) {
  if (err instanceof ZodError) return json({ error: "Ungültige Eingabe." }, 400);
  if (err instanceof AppError) {
    const status = { FORBIDDEN: 403, NOT_FOUND: 404, VALIDATION: 400, RATE_LIMITED: 429, CONFLICT: 409, UNAUTHENTICATED: 401, CONFIG: 503 }[err.code];
    return json({ error: err.message }, status);
  }
  console.error("[api] Fehler:", err instanceof Error ? err.message : err);
  return json({ error: "Interner Fehler." }, 500);
}

export async function tenantFromBody(slug: unknown) {
  if (typeof slug !== "string") throw new AppError("VALIDATION", "Betriebsrat fehlt.");
  const tenant = await getTenantBySlug(await getDb(), slug);
  if (!tenant) throw new AppError("NOT_FOUND", "Betriebsrat nicht gefunden.");
  const staff = hasStaffAccess(sessionSecret(), tenant, (await cookies()).get(staffCookieName(slug))?.value);
  return { tenant, staff };
}
