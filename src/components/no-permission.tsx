import { Alert } from "./ui";
export function NoPermission() {
  return <Alert kind="error" title="Keine Berechtigung">Dieser Bereich ist Administratorinnen und Administratoren vorbehalten.</Alert>;
}
