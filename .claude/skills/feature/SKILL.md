---
name: feature
description: Neue Funktion in Betriebsrat Direkt umsetzen – von Plan über Tests bis npm run check. Verwenden, wenn der Nutzer eine neue Fachfunktion, Seite oder Aktion wünscht.
---

# Neue Funktion umsetzen

1. **Verstehen:** Rückfragen stellen, wenn Rolle, Sichtbarkeit (`public`/`staff`/`council`) oder Datenschutzfolgen unklar sind. Kurzen Plan zeigen und Zustimmung abwarten, bevor Code entsteht.
2. **Einordnen:** Wer darf das? Neue `Permission` in `src/lib/auth/permissions.ts` nötig? Welche Daten entstehen, sind sie personenbezogen?
3. **Test zuerst:** Integrationstest in `tests/integration/` für den Erfolgsfall, die Rechteprüfung (Redakteur ohne `canPublish`, fremder Mandant → 404) und ungültige Eingaben.
4. **Service:** Fachlogik in `src/lib/services/` mit `assertCan(...)` und `tenantId`-Filter; Eingaben über Zod-Schema in `src/lib/validation/schemas.ts`.
5. **Oberfläche:** Server Action in `src/app/admin/[slug]/actions.ts` bzw. Seite; vorhandene Bausteine aus `src/components/` nutzen. Texte auf Deutsch, verständlich für Nicht-Techniker. Vor dem Schreiben die passende Anleitung in `node_modules/next/dist/docs/` lesen.
6. **Barrierefreiheit & E2E:** Neue Seiten in `e2e/main.spec.ts` aufnehmen (axe-Prüfung).
7. **Prüfen:** `npm run check`; bei UI-Änderungen `npm run test:e2e`.
8. **Doku:** README-Funktionstabelle, `docs/ARCHITEKTUR.md` (Rollen), ggf. `docs/DATENSCHUTZ.md` / `docs/SICHERHEIT.md` aktualisieren.
9. **Abschluss:** Den `tenant-reviewer`-Agenten über den Diff laufen lassen und Befunde beheben.
