import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export async function adminApi<T>(path: string): Promise<T> {
  const access = (await cookies()).get("e3_admin_access")?.value;
  if (!access) redirect("/login");
  const response = await fetch(`${API_URL}/admin/${path}`, {
    headers: { authorization: `Bearer ${access}` },
    cache: "no-store",
  });
  if (response.status === 401 || response.status === 403) redirect("/login");
  if (!response.ok) throw new Error(`ADMIN_API_${response.status}`);
  return response.json() as Promise<T>;
}
