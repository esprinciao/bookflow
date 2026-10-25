import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Business } from "@/lib/types";

/**
 * The signed-in owner and their business.
 *
 * Middleware already blocks anonymous requests to protected routes, but this
 * verifies again rather than trusting that. Middleware can be bypassed by
 * configuration mistakes, and a page that reads tenant data should establish
 * its own tenant rather than assume one.
 *
 * The businesses row is guaranteed to exist by the handle_new_user trigger, so
 * a missing one means something is genuinely wrong — not a state to paper over.
 */
export async function requireBusiness(): Promise<{
  business: Business;
  email: string;
}> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // RLS restricts this to the caller's own row, so no owner_id filter is
  // needed for correctness — it is here to make the intent legible.
  const { data: business, error } = await supabase
    .from("businesses")
    .select("*")
    .eq("owner_id", user.id)
    .maybeSingle<Business>();

  if (error) throw new Error(`Could not load your business: ${error.message}`);
  if (!business) {
    throw new Error(
      "Signed in but no business row exists. The handle_new_user trigger did not run — check supabase/migrations/0001_businesses.sql is applied.",
    );
  }

  return { business, email: user.email ?? "" };
}
