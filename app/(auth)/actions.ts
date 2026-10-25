"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthState = { error?: string; notice?: string };

/**
 * Only allow same-origin relative paths, so ?next= can't be turned into an
 * open redirect that bounces a freshly-authenticated user off to an attacker.
 *
 * "//evil.example" is protocol-relative and would leave the site. So is
 * "/\\evil.example" — browsers normalise the backslash to a forward slash,
 * which is why checking only for "//" is not enough.
 */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  if (!next.startsWith("/")) return "/dashboard";
  if (next.length > 1 && (next[1] === "/" || next[1] === "\\")) return "/dashboard";
  return next;
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const businessName = String(formData.get("business_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const timezone = String(formData.get("timezone") ?? "").trim() || "UTC";

  if (!businessName) return { error: "Tell us your business name." };
  if (!email) return { error: "Enter your email address." };
  if (password.length < 8) {
    return { error: "Use at least 8 characters for your password." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger, which creates the businesses row
      // and derives a URL-safe slug from the name. See 0001/0006/0007.
      data: { business_name: businessName, timezone },
    },
  });

  if (error) return { error: error.message };

  // When "Confirm email" is enabled in Supabase, signUp returns a user but no
  // session — there is nothing to redirect to yet.
  if (!data.session) {
    return {
      notice: `Almost there. We sent a confirmation link to ${email} — open it to finish setting up ${businessName}.`,
    };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function logIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!email || !password) return { error: "Enter your email and password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    // Deliberately vague. Saying "no account with that email" tells an attacker
    // which addresses are registered.
    return { error: "That email and password don't match an account." };
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function logOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
