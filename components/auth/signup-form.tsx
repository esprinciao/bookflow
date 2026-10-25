"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUp, type AuthState } from "@/app/(auth)/actions";
import { Field, FormError, FormNotice, Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/ui/button";
import { useBrowserTimezone } from "@/lib/use-browser-timezone";

export function SignupForm() {
  const [state, formAction] = useActionState<AuthState, FormData>(signUp, {});

  // The server never sees the visitor's timezone, so it is read in the browser
  // and submitted along with the form. The trigger stores it on the business.
  const timezone = useBrowserTimezone();

  if (state.notice) {
    return <FormNotice>{state.notice}</FormNotice>;
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="timezone" value={timezone} />
      <FormError>{state.error}</FormError>

      <Field
        label="Business name"
        hint={`Your booking page will live at /book/your-business-name`}
      >
        <Input
          name="business_name"
          type="text"
          required
          autoFocus
          placeholder="Aisha's Hair Studio"
        />
      </Field>

      <Field label="Email">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          placeholder="you@example.com"
        />
      </Field>

      <Field label="Password" hint="At least 8 characters.">
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
      </Field>

      <p className="text-xs text-muted">
        Times will be shown in{" "}
        <span className="font-medium text-foreground">{timezone}</span>. You can
        change this later.
      </p>

      <SubmitButton pendingLabel="Creating your account…" className="w-full">
        Create account
      </SubmitButton>

      <p className="text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
