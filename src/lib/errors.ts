/** Fachlicher Fehler mit verständlicher, deutscher Meldung für die Oberfläche. */
export class AppError extends Error {
  constructor(
    public readonly code:
      | "FORBIDDEN"
      | "NOT_FOUND"
      | "VALIDATION"
      | "RATE_LIMITED"
      | "CONFLICT"
      | "UNAUTHENTICATED"
      | "CONFIG",
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (msg = "Dafür fehlt Ihnen die Berechtigung.") => new AppError("FORBIDDEN", msg);
export const notFound = (msg = "Nicht gefunden.") => new AppError("NOT_FOUND", msg);
export const invalid = (msg: string) => new AppError("VALIDATION", msg);
