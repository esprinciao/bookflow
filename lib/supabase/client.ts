import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for Client Components (runs in the browser).
 *
 * Only ever uses the anon key, which is safe to ship to the browser because
 * every table is protected by row-level security. The anon key identifies the
 * project, it does not grant access — RLS policies decide what a given signed-in
 * user can read and write.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
