import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** SSR expects the JWT anon key from Dashboard → Settings → API → anon public (starts with eyJ). */
export function isJwtAnonKey(key: string) {
  return key.startsWith("eyJ");
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    return supabaseResponse;
  }

  if (!isJwtAnonKey(anon)) {
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[middleware] NEXT_PUBLIC_SUPABASE_ANON_KEY must be the JWT anon key (eyJ…), not sb_publishable_… See Supabase Dashboard → Settings → API."
      );
    }
    return supabaseResponse;
  }

  try {
    const supabase = createServerClient(url, anon, {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();
    if (error) {
      if (process.env.NODE_ENV === "development") {
        console.warn("[middleware] getUser:", error.message);
      }
    }

    const path = request.nextUrl.pathname;

    if (path.startsWith("/user") || path.startsWith("/admin")) {
      if (!user) {
        const nextUrl = request.nextUrl.clone();
        nextUrl.pathname = "/login";
        nextUrl.searchParams.set("next", path);
        return NextResponse.redirect(nextUrl);
      }
    }

    if (path.startsWith("/admin") && user) {
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError && process.env.NODE_ENV === "development") {
        console.warn("[middleware] profiles:", profileError.message);
      }

      if (profile?.role !== "admin") {
        const nextUrl = request.nextUrl.clone();
        nextUrl.pathname = "/user";
        return NextResponse.redirect(nextUrl);
      }
    }

    return supabaseResponse;
  } catch (e) {
    console.error("[middleware] Supabase session failed:", e);
    return NextResponse.next({ request });
  }
}
