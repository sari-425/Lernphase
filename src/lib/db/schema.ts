import {
  pgTable,
  pgEnum,
  uuid,
  text,
  boolean,
  integer,
  timestamp,
  date,
  jsonb,
  bigserial,
  primaryKey,
  uniqueIndex,
  index,
  customType,
} from "drizzle-orm/pg-core";

const bytea = customType<{ data: Buffer; driverData: Buffer | Uint8Array }>({
  dataType() {
    return "bytea";
  },
  fromDriver(value) {
    return Buffer.isBuffer(value) ? value : Buffer.from(value);
  },
});

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: "date" });

export const roleEnum = pgEnum("member_role", ["admin", "editor"]);
export const messageStatusEnum = pgEnum("message_status", [
  "draft",
  "review",
  "published",
  "archived",
  "withdrawn",
]);
/**
 * public  = ohne Konto über den Link abrufbar
 * staff   = nur Belegschaft (mit Belegschafts-Zugangscode des Betriebsrats)
 * council = nur angemeldete Mitglieder des Betriebsrats (Gremium intern)
 */
export const visibilityEnum = pgEnum("message_visibility", ["public", "staff", "council"]);
export const priorityEnum = pgEnum("message_priority", ["normal", "high", "urgent"]);
export const dispatchStatusEnum = pgEnum("dispatch_status", [
  "pending",
  "sending",
  "done",
  "failed",
  "skipped",
]);

/** Ein Mandant = ein Betriebsrat mit eigenem Bereich und eigener Adresse (/b/<slug>). */
export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  companyName: text("company_name").notNull().default(""),
  slogan: text("slogan").notNull().default(""),
  sloganSub: text("slogan_sub").notNull().default(""),
  welcomeText: text("welcome_text").notNull().default(""),
  staffAccessCodeHash: text("staff_access_code_hash"),
  staffAccessVersion: integer("staff_access_version").notNull().default(1),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  displayName: text("display_name").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  /** TOTP-Geheimnis, verschlüsselt (AES-256-GCM) */
  totpSecretEnc: text("totp_secret_enc"),
  totpEnabled: boolean("totp_enabled").notNull().default(false),
  /** zuletzt verwendeter TOTP-Zeitschritt (Schutz vor Wiederverwendung) */
  totpLastStep: integer("totp_last_step"),
  /** SHA-256-Hashes der Wiederherstellungscodes */
  recoveryCodeHashes: jsonb("recovery_code_hashes").$type<string[] | null>(),
  createdAt: ts("created_at").notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull(),
    canPublish: boolean("can_publish").notNull().default(false),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.tenantId, t.userId] })],
);

/** Sitzungen: gespeichert wird nur der SHA-256-Hash des Tokens, nie das Token selbst. */
export const sessions = pgTable(
  "sessions",
  {
    idHash: text("id_hash").primaryKey(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    lastActiveAt: ts("last_active_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
  },
  (t) => [index("sessions_user_idx").on(t.userId), index("sessions_expires_idx").on(t.expiresAt)],
);

/** Einladungen ohne E-Mail-Versand: der Link wird persönlich übergeben. */
export const invitations = pgTable(
  "invitations",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    role: roleEnum("role").notNull(),
    canPublish: boolean("can_publish").notNull().default(false),
    note: text("note").notNull().default(""),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("invitations_tenant_idx").on(t.tenantId)],
);

export const categories = pgTable(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [uniqueIndex("categories_tenant_slug_uq").on(t.tenantId, t.slug)],
);

export const messages = pgTable(
  "messages",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    body: text("body").notNull(),
    categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
    priority: priorityEnum("priority").notNull().default("normal"),
    status: messageStatusEnum("status").notNull().default("draft"),
    // Sicherer Standard: intern (nur Gremium)
    visibility: visibilityEnum("visibility").notNull().default("council"),
    publishAt: ts("publish_at"),
    expiresAt: ts("expires_at"),
    linkUrl: text("link_url"),
    pushEnabled: boolean("push_enabled").notNull().default(false),
    pushTitle: text("push_title").notNull().default(""),
    pushBody: text("push_body").notNull().default(""),
    publishedBy: uuid("published_by").references(() => users.id, { onDelete: "set null" }),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    updatedBy: uuid("updated_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    updatedAt: ts("updated_at").notNull().defaultNow(),
  },
  (t) => [
    index("messages_tenant_status_idx").on(t.tenantId, t.status, t.publishAt),
    index("messages_tenant_category_idx").on(t.tenantId, t.categoryId),
  ],
);

export const attachments = pgTable(
  "attachments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    filename: text("filename").notNull(),
    mimeType: text("mime_type").notNull(),
    size: integer("size").notNull(),
    data: bytea("data").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("attachments_message_idx").on(t.messageId)],
);

export const contacts = pgTable(
  "contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    roleTitle: text("role_title").notNull().default(""),
    phone: text("phone").notNull().default(""),
    email: text("email").notNull().default(""),
    location: text("location").notNull().default(""),
    availability: text("availability").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("contacts_tenant_idx").on(t.tenantId)],
);

/**
 * Push-Abonnements sind anonym: kein Name, keine E-Mail, keine IP.
 * last_seen_on hat nur Tagesgenauigkeit (für die Löschfrist).
 */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    endpointHash: text("endpoint_hash").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    categoryIds: jsonb("category_ids").$type<string[] | null>(),
    onlyImportant: boolean("only_important").notNull().default(false),
    staffAccess: boolean("staff_access").notNull().default(false),
    staffAccessVersion: integer("staff_access_version"),
    createdOn: date("created_on", { mode: "string" }).notNull(),
    lastSeenOn: date("last_seen_on", { mode: "string" }).notNull(),
    failureCount: integer("failure_count").notNull().default(0),
  },
  (t) => [uniqueIndex("push_subs_tenant_endpoint_uq").on(t.tenantId, t.endpointHash)],
);

/** Genau ein Versandauftrag pro Mitteilung (UNIQUE) = Schutz vor Doppelversand. */
export const pushDispatches = pgTable(
  "push_dispatches",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    messageId: uuid("message_id")
      .notNull()
      .unique()
      .references(() => messages.id, { onDelete: "cascade" }),
    status: dispatchStatusEnum("status").notNull().default("pending"),
    notBefore: ts("not_before").notNull().defaultNow(),
    createdAt: ts("created_at").notNull().defaultNow(),
    startedAt: ts("started_at"),
    finishedAt: ts("finished_at"),
    targetCount: integer("target_count").notNull().default(0),
    acceptedCount: integer("accepted_count").notNull().default(0),
    failedCount: integer("failed_count").notNull().default(0),
    removedCount: integer("removed_count").notNull().default(0),
    note: text("note").notNull().default(""),
    triggeredBy: uuid("triggered_by").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [index("push_dispatches_status_idx").on(t.status, t.notBefore)],
);

/** Passwort-Zurücksetzen per Link, den ein Admin erzeugt (kein E-Mail-Versand). */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    tokenHash: text("token_hash").notNull().unique(),
    resetTotp: boolean("reset_totp").notNull().default(false),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    expiresAt: ts("expires_at").notNull(),
    usedAt: ts("used_at"),
  },
  (t) => [index("password_resets_user_idx").on(t.userId)],
);

export const pollStatusEnum = pgEnum("poll_status", ["draft", "open", "closed"]);

/**
 * Umfragen als anonymes, unverbindliches Stimmungsbild.
 * Keine Personendaten; Doppelabstimmung wird nur pro Gerät erschwert.
 */
export const polls = pgTable(
  "polls",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    question: text("question").notNull(),
    description: text("description").notNull().default(""),
    options: jsonb("options").$type<{ id: string; label: string }[]>().notNull(),
    visibility: visibilityEnum("visibility").notNull().default("staff"),
    status: pollStatusEnum("status").notNull().default("draft"),
    closesAt: ts("closes_at"),
    resultsPublic: boolean("results_public").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: ts("created_at").notNull().defaultNow(),
    openedAt: ts("opened_at"),
    closedAt: ts("closed_at"),
  },
  (t) => [index("polls_tenant_idx").on(t.tenantId, t.status)],
);

export const pollVotes = pgTable(
  "poll_votes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    pollId: uuid("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    /** HMAC(Geräte-Zufallswert, Umfrage) – nach Ende der Umfrage gelöscht (NULL) */
    voterHash: text("voter_hash"),
    optionId: text("option_id").notNull(),
  },
  (t) => [uniqueIndex("poll_votes_voter_uq").on(t.pollId, t.voterHash), index("poll_votes_poll_idx").on(t.pollId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    tenantId: uuid("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    targetId: text("target_id"),
    details: jsonb("details").$type<Record<string, unknown>>(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("audit_tenant_created_idx").on(t.tenantId, t.createdAt)],
);

/** Ratenbegrenzung. key ist ein HMAC (keine Klartext-IP, keine Klartext-E-Mail). */
export const rateLimitEvents = pgTable(
  "rate_limit_events",
  {
    id: bigserial("id", { mode: "number" }).primaryKey(),
    key: text("key").notNull(),
    createdAt: ts("created_at").notNull().defaultNow(),
  },
  (t) => [index("rate_limit_key_created_idx").on(t.key, t.createdAt)],
);

export type Tenant = typeof tenants.$inferSelect;
export type User = typeof users.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Contact = typeof contacts.$inferSelect;
export type PushSubscriptionRow = typeof pushSubscriptions.$inferSelect;
export type PushDispatch = typeof pushDispatches.$inferSelect;
export type Role = (typeof roleEnum.enumValues)[number];
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number];
export type Visibility = (typeof visibilityEnum.enumValues)[number];
export type Priority = (typeof priorityEnum.enumValues)[number];
export type Poll = typeof polls.$inferSelect;
