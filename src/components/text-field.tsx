import { FieldError } from "./ui";

export function TextField({
  name,
  label,
  hint,
  error,
  type = "text",
  required,
  defaultValue,
  autoComplete,
  maxLength,
  minLength,
  placeholder,
}: {
  name: string;
  label: string;
  hint?: string;
  error?: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
  autoComplete?: string;
  maxLength?: number;
  minLength?: number;
  placeholder?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;
  const errId = error ? `${name}-err` : undefined;
  return (
    <div>
      <label htmlFor={name} className="label">
        {label}
        {required ? <span className="text-red-800"> *</span> : null}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        autoComplete={autoComplete}
        maxLength={maxLength}
        minLength={minLength}
        placeholder={placeholder}
        aria-invalid={error ? true : undefined}
        aria-describedby={[hintId, errId].filter(Boolean).join(" ") || undefined}
        className={"input " + (error ? "border-red-700" : "")}
      />
      {hint ? <p id={hintId} className="hint">{hint}</p> : null}
      <FieldError id={errId} error={error} />
    </div>
  );
}
