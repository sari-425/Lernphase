---
name: migration
description: Datenbankschema ändern und eine Drizzle-Migration erzeugen und prüfen. Verwenden, wenn Tabellen, Spalten, Indizes oder Constraints in src/lib/db/schema.ts geändert werden sollen.
---

# Schemaänderung mit Migration

1. **Planen:** Welche Tabellen sind betroffen? Enthält eine neue Tabelle Inhalte eines Betriebsrats, braucht sie `tenant_id` (FK auf `tenants`, `onDelete: "cascade"`) und einen Index darauf. Personenbezug? Dann Löschfrist in `src/lib/services/maintenance.ts` und `docs/DATENSCHUTZ.md` ergänzen.
2. **Schema ändern** in `src/lib/db/schema.ts` – Stil der bestehenden Tabellen übernehmen.
3. **Migration erzeugen:** `npm run db:generate`. Bestehende Dateien in `drizzle/` niemals bearbeiten.
4. **SQL prüfen:** Die neue Datei in `drizzle/` lesen. Achten auf: versehentliches `DROP`, `NOT NULL` ohne Default auf bestehende Tabellen (bricht vorhandene Daten), fehlende Indizes, Umbenennungen, die als Drop+Add erzeugt wurden.
5. **Services anpassen** in `src/lib/services/` – jede Abfrage mit `tenantId`-Filter.
6. **Tests:** Integrationstest ergänzen; bei neuen Inhaltstabellen einen Fall in `tests/integration/tenant-isolation.test.ts`.
7. **Prüfen:** `npm test`, danach `npm run check`.
8. **Doku:** Datenmodell-Tabelle in `docs/ARCHITEKTUR.md` aktualisieren.
