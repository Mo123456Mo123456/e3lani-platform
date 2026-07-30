import { NextResponse, type NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const authenticated = Boolean(request.cookies.get("e3_admin_access")?.value);
  if (!authenticated) {
    const login = new URL("/login", request.url);
    login.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(login);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/users/:path*", "/reports/:path*", "/pricing/:path*", "/settings/:path*", "/ticker/:path*", "/payments/:path*", "/audit/:path*"],
};
