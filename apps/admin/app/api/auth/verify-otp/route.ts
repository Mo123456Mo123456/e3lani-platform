import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
const adminRoles = new Set([
  "MODERATOR",
  "SUPPORT",
  "CAMPAIGN_MANAGER",
  "FINANCE",
  "CONTENT_MANAGER",
  "ADMIN",
  "SUPER_ADMIN",
]);

function tokenRoles(token: string): string[] {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString("utf8")) as {
      roles?: string[];
    };
    return payload.roles ?? [];
  } catch {
    return [];
  }
}

export async function POST(request: Request) {
  const response = await fetch(`${API_URL}/auth/otp/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: await request.text(),
    cache: "no-store",
  });
  const data = (await response.json()) as {
    accessToken?: string;
    refreshToken?: string;
    registrationRequired?: boolean;
  };
  if (!response.ok) return NextResponse.json(data, { status: response.status });
  if (!data.accessToken || !data.refreshToken || !tokenRoles(data.accessToken).some((role) => adminRoles.has(role))) {
    return NextResponse.json({ code: "ADMIN_ROLE_REQUIRED" }, { status: 403 });
  }
  const result = NextResponse.json({ success: true });
  result.cookies.set("e3_admin_access", data.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 15 * 60,
    path: "/",
  });
  result.cookies.set("e3_admin_refresh", data.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 30 * 24 * 60 * 60,
    path: "/api/auth",
  });
  return result;
}
