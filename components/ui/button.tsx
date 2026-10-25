"use client";

import { useFormStatus } from "react-dom";

type Variant = "primary" | "secondary" | "danger";

const base =
  "inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-medium " +
  "transition-colors disabled:cursor-not-allowed disabled:opacity-60 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-brand-contrast hover:bg-brand-hover",
  secondary: "border border-border hover:bg-surface",
  danger: "border border-border text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30",
};

export function Button({
  variant = "primary",
  className = "",
  ...props
}: React.ComponentProps<"button"> & { variant?: Variant }) {
  return <button className={`${base} ${variants[variant]} ${className}`} {...props} />;
}

/**
 * Submit button wired to the enclosing form's pending state.
 *
 * useFormStatus only reports the status of a parent <form>, which is why this
 * has to be its own component rather than a prop on the page — a component
 * cannot read the status of a form it renders itself.
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  variant?: Variant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {pending ? (pendingLabel ?? children) : children}
    </Button>
  );
}
