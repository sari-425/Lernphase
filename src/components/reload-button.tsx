"use client";
export function ReloadButton() {
  return (
    <button type="button" className="btn-primary" onClick={() => window.location.reload()}>
      Erneut versuchen
    </button>
  );
}
