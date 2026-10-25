import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 *
 * The session lives in cookies, so this client reads them on the way in and
 * writes refreshed ones on the way out. It still uses the anon key and still
 * runs under row-level security — it is the *user's* client, executing on the
 * server, not an admin client.
 *
 * Must be awaited: `cookies()` is async in the App Router.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Components cannot set cookies. This is expected and safe:
            // middleware.ts refreshes the session on every request, so the
            // cookie is already current by the time we get here.
          }
        },
      },
    },
  );
}
