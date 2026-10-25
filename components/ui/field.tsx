export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint ? <span className="mt-1.5 block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Input({ className = "", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      className={
        "block w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm " +
        "placeholder:text-muted focus:border-brand focus:outline-none " +
        "focus:ring-2 focus:ring-brand/30 " +
        className
      }
      {...props}
    />
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p
      role="alert"
      className="rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300"
    >
      {children}
    </p>
  );
}

export function FormNotice({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <p className="rounded-lg border border-border bg-surface px-3 py-2.5 text-sm">
      {children}
    </p>
  );
}
