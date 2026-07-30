import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function POST() {
  const store = await cookies();
  const access = store.get("e3_admin_access")?.value;
  if (access) {
    await fetch(`${API_URL}/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${access}` },
      cache: "no-store",
    }).catch(() => undefined);
  }
  const response = NextResponse.json({ success: true });
  response.cookies.delete("e3_admin_access");
  response.cookies.delete("e3_admin_refresh");
  return response;
}
