import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Routes that require a signed-in business owner. */
const PROTECTED = ["/dashboard", "/services", "/staff", "/availability", "/bookings"];

/** Routes that a signed-in owner has no reason to see. */
const AUTH_ONLY = ["/login", "/signup"];

const startsWithAny = (path: string, prefixes: string[]) =>
  prefixes.some((p) => path === p || path.startsWith(`${p}/`));

/**
 * Refreshes the Supabase session on every matched request and enforces route
 * access.
 *
 * Two things here are easy to get subtly wrong:
 *
 * 1. The cookies Supabase writes during a token refresh must end up on the
 *    response that is actually returned. That is why `supabaseResponse` is
 *    rebuilt inside setAll instead of being created once up front — otherwise
 *    a refreshed token is silently dropped and the user is logged out at a
 *    seemingly random moment.
 *
 * 2. `getUser()`, not `getSession()`. getSession reads the cookie and trusts
 *    it; getUser verifies the JWT with the auth server. Middleware is a
 *    security boundary, so it has to be the one that verifies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  if (!user && startsWithAny(pathname, PROTECTED)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/login";
    // Remember where they were headed so login can send them back.
    redirect.searchParams.set("next", pathname);
    return NextResponse.redirect(redirect);
  }

  if (user && startsWithAny(pathname, AUTH_ONLY)) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/dashboard";
    redirect.search = "";
    return NextResponse.redirect(redirect);
  }

  return supabaseResponse;
}
