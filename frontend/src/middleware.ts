import createMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

const PROTECTED_PREFIXES = ["/dashboard", "/admin", "/promoter"];
const LOCALES = routing.locales as readonly string[];

function isProtected(pathname: string): boolean {
  // Strip locale prefix if present: /pl/dashboard → /dashboard
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      const stripped = pathname.slice(locale.length + 1) || "/";
      return PROTECTED_PREFIXES.some((p) => stripped.startsWith(p));
    }
  }
  return PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
}

function getLocale(pathname: string): string {
  for (const locale of LOCALES) {
    if (pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`) {
      return locale;
    }
  }
  return routing.defaultLocale;
}

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isProtected(pathname)) {
    const token = request.cookies.get("access_token")?.value;
    if (!token) {
      const locale = getLocale(pathname);
      const loginUrl = new URL(`/${locale}/login`, request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)" ],
};
