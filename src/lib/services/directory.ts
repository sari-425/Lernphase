import { and, asc, eq, sql } from "drizzle-orm";
import type { DB } from "@/lib/db/client";
import { categories, contacts, messages } from "@/lib/db/schema";
import { assertCan, type Actor } from "@/lib/auth/permissions";
import { invalid, notFound } from "@/lib/errors";
import { audit } from "./audit";

// ---------- Kategorien ----------

export async function listCategories(db: DB, tenantId: string) {
  return db
    .select()
    .from(categories)
    .where(eq(categories.tenantId, tenantId))
    .orderBy(asc(categories.sortOrder), asc(categories.name));
}

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "kategorie"
  );
}

export async function createCategory(db: DB, actor: Actor, input: { name: string; sortOrder: number }) {
  assertCan(actor, "categories.manage");
  let slug = slugify(input.name);
  const existing = await listCategories(db, actor.tenantId);
  if (existing.length >= 30) throw invalid("Höchstens 30 Kategorien möglich.");
  if (existing.some((c) => c.slug === slug)) slug = `${slug}-${existing.length + 1}`;
  const [c] = await db.insert(categories).values({ tenantId: actor.tenantId, slug, ...input }).returning();
  await audit(db, actor, "category.create", c.id);
  return c;
}

export async function updateCategory(db: DB, actor: Actor, id: string, input: { name: string; sortOrder: number }) {
  assertCan(actor, "categories.manage");
  const r = await db
    .update(categories)
    .set(input)
    .where(and(eq(categories.id, id), eq(categories.tenantId, actor.tenantId)))
    .returning({ id: categories.id });
  if (!r.length) throw notFound("Kategorie nicht gefunden.");
}

export async function deleteCategory(db: DB, actor: Actor, id: string) {
  assertCan(actor, "categories.manage");
  const [used] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(messages)
    .where(and(eq(messages.tenantId, actor.tenantId), eq(messages.categoryId, id)));
  if ((used?.n ?? 0) > 0) throw invalid("Die Kategorie wird noch von Mitteilungen verwendet.");
  await db.delete(categories).where(and(eq(categories.id, id), eq(categories.tenantId, actor.tenantId)));
  await audit(db, actor, "category.delete", id);
}

// ---------- Ansprechpartner ----------

export type ContactInput = {
  name: string;
  roleTitle: string;
  phone: string;
  email: string;
  location: string;
  availability: string;
  sortOrder: number;
};

export async function listContacts(db: DB, tenantId: string) {
  return db
    .select()
    .from(contacts)
    .where(eq(contacts.tenantId, tenantId))
    .orderBy(asc(contacts.sortOrder), asc(contacts.name));
}

export async function createContact(db: DB, actor: Actor, input: ContactInput) {
  assertCan(actor, "contacts.manage");
  const [c] = await db.insert(contacts).values({ tenantId: actor.tenantId, ...input }).returning();
  await audit(db, actor, "contact.create", c.id);
  return c;
}

export async function updateContact(db: DB, actor: Actor, id: string, input: ContactInput) {
  assertCan(actor, "contacts.manage");
  const r = await db
    .update(contacts)
    .set(input)
    .where(and(eq(contacts.id, id), eq(contacts.tenantId, actor.tenantId)))
    .returning({ id: contacts.id });
  if (!r.length) throw notFound("Ansprechpartner nicht gefunden.");
}

export async function deleteContact(db: DB, actor: Actor, id: string) {
  assertCan(actor, "contacts.manage");
  await db.delete(contacts).where(and(eq(contacts.id, id), eq(contacts.tenantId, actor.tenantId)));
  await audit(db, actor, "contact.delete", id);
}
