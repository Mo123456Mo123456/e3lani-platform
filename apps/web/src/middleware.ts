import { NextResponse, type NextRequest } from "next/server";

const LOCALES = ["ar", "en"];
const DEFAULT_LOCALE = "ar";

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.includes(".") ||
    pathname === "/sw.js"
  ) {
    return NextResponse.next();
  }
  const hasLocale = LOCALES.some((l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`));
  if (hasLocale) return NextResponse.next();
  const saved = request.cookies.get("pb_locale")?.value;
  const locale = LOCALES.includes(saved ?? "") ? (saved as string) : DEFAULT_LOCALE;
  return NextResponse.redirect(new URL(`/${locale}${pathname === "/" ? "" : pathname}`, request.url));
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
