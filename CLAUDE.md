@AGENTS.md

# Betriebsrat Direkt – Hinweise für Claude

Datenschutzfreundliche PWA für Betriebsräte (Next.js 16 App Router, React 19, Drizzle + PostgreSQL/PGlite, Zod, web-push).
Ausführlich: `docs/ARCHITEKTUR.md`, `docs/SICHERHEIT.md`, `docs/DATENSCHUTZ.md`. Diese Dokumente aktuell halten, wenn sich Verhalten ändert.

## Sprache
- Oberfläche, Doku, Commit-Nachrichten und Code-Kommentare auf **Deutsch**. Bezeichner im Code auf Englisch (wie bestehend).
- Routen-Segmente sind deutsch (`/admin/[slug]/mitteilungen`, `/b/[slug]/…`).

## Befehle
- `npm run lint` · `npm run typecheck` · `npm test` (Vitest + PGlite, ~30 s)
- Einzelner Test: `npx vitest run tests/unit/permissions.test.ts`
- `npm run test:e2e` braucht vorher `npm run build`
- `npm run test:pg` nur mit `TEST_DATABASE_URL` auf eine **leere** Testdatenbank
- **Definition von „fertig“: `npm run check` ist grün** (lint + typecheck + test + build), bei UI-Änderungen zusätzlich `npm run test:e2e`.

## Architektur-Regeln (nicht verhandelbar)
- **Fachlogik gehört in `src/lib/services/`** und ist ohne Next.js testbar. Seiten und Server Actions (`src/app/admin/[slug]/actions.ts`) rufen nur Services auf.
- **Mandantentrennung:** Jede Abfrage auf Inhaltstabellen filtert nach `tenantId` des Akteurs. Fremder Mandant → 404, nie 403 (Existenz nicht bestätigen). Neue Tabellen mit Inhalten bekommen `tenant_id` und einen Fall in `tests/integration/tenant-isolation.test.ts`.
- **Berechtigungen:** Jede schreibende Service-Funktion ruft `assertCan(actor, …)` aus `src/lib/auth/permissions.ts` auf. UI-Ausblenden ist nur Zusatz.
- **Eingaben** werden mit Zod-Schemas aus `src/lib/validation/schemas.ts` validiert.
- Server-Code, der Geheimnisse oder Cookies berührt, beginnt mit `import "server-only"`.
- **Kein `dangerouslySetInnerHTML`**, keine HTML-/Markdown-Bibliothek – Inhalte laufen über `src/lib/content/format.ts`.
- Cache Components bleiben **aus**; alles dynamisch gerendert (keine vertraulichen Inhalte in gemeinsamen Caches).
- Keine neuen externen Dienste (kein Tracking, keine KI-APIs, kein E-Mail-Versand, keine CDNs). Neue Abhängigkeiten nur mit Begründung.

## Datenschutz
- Keine personenbezogenen Daten oder Mitteilungsinhalte in Logs, Fehlermeldungen oder `audit_log` (dort nur wer/wann/was).
- Push-Abos und Umfrage-Stimmen bleiben anonym. „Gelesen“ wird nie erfasst.
- Beschäftigte haben kein Konto – keine Funktion einbauen, die sie identifiziert.

## Datenbank
- Schema: `src/lib/db/schema.ts`. Nach Änderungen `npm run db:generate` und die erzeugte SQL in `drizzle/` prüfen.
- Bestehende Migrationen in `drizzle/` **nie** von Hand ändern – immer eine neue erzeugen.
- Lokale Dev-Daten liegen in `.data/` (PGlite, nur ein Prozess gleichzeitig).

## Tests
- Neue Fachlogik → Integrationstest in `tests/integration/` (Helfer: `tests/helpers/db.ts`, Fake-Push-Dienst: `tests/helpers/fake-push-service.ts`).
- Barrierefreiheit: E2E-Tests prüfen mit axe (WCAG 2.2 AA). Neue Seiten in `e2e/main.spec.ts` aufnehmen.
- Niemals Tests überspringen oder abschwächen, um grün zu werden. Keine echten Schlüssel in Tests.

## Geheimnisse
- `.env*` (außer `.env.example`) nicht lesen, nicht ausgeben, nicht committen. Neue Variablen in `.env.example` und `src/lib/env.ts` dokumentieren.
