ALTER TABLE "tenants" ADD COLUMN "imprint_text" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "privacy_controller" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "privacy_council_contact" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "privacy_dpo" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "privacy_authority" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "privacy_hosting" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "tenants" ADD COLUMN "legal_updated_at" timestamp with time zone;