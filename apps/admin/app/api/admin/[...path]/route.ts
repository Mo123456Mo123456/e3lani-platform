import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  const access = (await cookies()).get("e3_admin_access")?.value;
  if (!access) return NextResponse.json({ code: "UNAUTHORIZED" }, { status: 401 });
  const source = new URL(request.url);
  const target = `${API_URL}/admin/${path.map(encodeURIComponent).join("/")}${source.search}`;
  const response = await fetch(target, {
    method: request.method,
    headers: {
      authorization: `Bearer ${access}`,
      ...(request.method === "GET" ? {} : { "content-type": "application/json" }),
    },
    body: request.method === "GET" ? undefined : await request.text(),
    cache: "no-store",
  });
  return new NextResponse(await response.text(), {
    status: response.status,
    headers: { "content-type": "application/json" },
  });
}

export const GET = proxy;
export const PATCH = proxy;
