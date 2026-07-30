import { NextRequest, NextResponse } from "next/server";

const locales = ["ar", "en"] as const;

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasLocale = locales.some(
    (locale) => pathname === `/${locale}` || pathname.startsWith(`/${locale}/`),
  );

  if (hasLocale) return NextResponse.next();

  const url = request.nextUrl.clone();
  url.pathname = `/ar${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|icons|manifest.json|.*\\..*).*)"],
};
