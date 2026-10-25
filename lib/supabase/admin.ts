import { createClient } from "@supabase/supabase-js";

/**
 * Supabase client using the service role key.
 *
 * This key bypasses row-level security entirely. It exists for exactly one
 * caller in this app — the payment webhook, which has no user session and must
 * confirm a booking it does not own.
 *
 * Rules, because the consequences of breaking them are total:
 *   - server-side only, never imported into a Client Component;
 *   - never behind a NEXT_PUBLIC_ variable, which would compile it into the
 *     JavaScript bundle sent to every visitor;
 *   - never used to serve a user request that a normal RLS-scoped client
 *     could serve instead.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set. The payment webhook cannot confirm bookings without it.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
