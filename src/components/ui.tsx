import type { Priority, Visibility, MessageStatus } from "@/lib/db/schema";

export function PriorityBadge({ priority }: { priority: Priority }) {
  if (priority === "normal") return null;
  const urgent = priority === "urgent";
  return (
    <span
      className={
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-sm font-bold " +
        (urgent ? "bg-red-700 text-white" : "bg-amber-100 text-amber-900 ring-1 ring-amber-300")
      }
    >
      <span aria-hidden="true">{urgent ? "‼" : "!"}</span>
      {urgent ? "Dringend" : "Wichtig"}
    </span>
  );
}

const VIS: Record<Visibility, { label: string; cls: string; desc: string }> = {
  public: { label: "Öffentlich", cls: "bg-slate-100 text-slate-800 ring-slate-300", desc: "Für alle mit dem Link abrufbar" },
  staff: { label: "Belegschaft", cls: "bg-accent-50 text-accent-600 ring-teal-300", desc: "Nur mit Belegschafts-Zugangscode" },
  council: { label: "Gremium intern", cls: "bg-violet-50 text-violet-800 ring-violet-300", desc: "Nur angemeldete Betriebsratsmitglieder" },
};

export function VisibilityBadge({ visibility }: { visibility: Visibility }) {
  const v = VIS[visibility];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-semibold ring-1 ${v.cls}`} title={v.desc}>
      {visibility === "public" ? "🌐 " : "🔒 "}
      {v.label}
    </span>
  );
}

export const visibilityDescription = (v: Visibility) => VIS[v].desc;
export const visibilityLabel = (v: Visibility) => VIS[v].label;

const STATUS: Record<MessageStatus | "scheduled", { label: string; cls: string }> = {
  draft: { label: "Entwurf", cls: "bg-slate-100 text-slate-800" },
  review: { label: "Zur Freigabe", cls: "bg-amber-100 text-amber-900" },
  published: { label: "Veröffentlicht", cls: "bg-green-100 text-green-900" },
  scheduled: { label: "Geplant", cls: "bg-blue-100 text-blue-900" },
  archived: { label: "Archiviert", cls: "bg-slate-200 text-slate-800" },
  withdrawn: { label: "Zurückgezogen", cls: "bg-red-100 text-red-900" },
};

export function StatusBadge({ status }: { status: MessageStatus | "scheduled" }) {
  const s = STATUS[status];
  return <span className={`inline-flex rounded-full px-2.5 py-0.5 text-sm font-semibold ${s.cls}`}>{s.label}</span>;
}

export function Alert({
  kind = "info",
  title,
  children,
}: {
  kind?: "info" | "success" | "warning" | "error";
  title?: string;
  children?: React.ReactNode;
}) {
  const cls = {
    info: "border-brand-200 bg-brand-50 text-brand-900",
    success: "border-green-300 bg-green-50 text-green-900",
    warning: "border-amber-300 bg-amber-50 text-amber-950",
    error: "border-red-300 bg-red-50 text-red-900",
  }[kind];
  return (
    <div className={`rounded-lg border px-4 py-3 ${cls}`} role={kind === "error" ? "alert" : "status"}>
      {title ? <p className="font-semibold">{title}</p> : null}
      {children ? <div className={title ? "mt-1" : ""}>{children}</div> : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 px-6 py-10 text-center">
      <p className="text-lg font-semibold">{title}</p>
      {children ? <div className="mt-2 text-muted">{children}</div> : null}
    </div>
  );
}

export function PageTitle({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h1 className="text-2xl font-bold tracking-tight text-brand-900 sm:text-3xl">{children}</h1>
      {sub ? <p className="mt-1 text-muted">{sub}</p> : null}
    </div>
  );
}

export function FieldError({ error, id }: { error?: string; id?: string }) {
  if (!error) return null;
  return (
    <p id={id} className="mt-1 text-sm font-medium text-red-800">
      {error}
    </p>
  );
}
