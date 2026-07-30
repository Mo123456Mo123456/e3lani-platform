"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import { useRouter } from "next/navigation";

import { Button, Card, E3laniLogo } from "@e3lani/ui";

import { saveSession } from "@/lib/api";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function requestOtp(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/otp/request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!response.ok) throw new Error("تعذر إرسال رمز التحقق");
      setSent(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/api/v1/auth/otp/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone, code, deviceName: "E3lani Admin" }),
      });
      if (!response.ok) throw new Error("رمز التحقق غير صالح أو منتهي");
      const session = (await response.json()) as {
        accessToken: string;
        refreshToken: string;
        user: { staffRole: string };
      };
      if (session.user.staffRole === "USER") {
        throw new Error("هذا الحساب لا يملك صلاحية دخول لوحة الإدارة");
      }
      saveSession(session);
      router.replace("/");
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : "حدث خطأ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black px-4">
      <Card className="w-full max-w-md p-7">
        <E3laniLogo />
        <h1 className="mt-6 text-2xl font-black">دخول لوحة الإدارة</h1>
        <p className="mt-2 text-sm text-zinc-600">الدخول مخصص لأعضاء فريق إعلاني المصرح لهم.</p>
        <form onSubmit={sent ? verify : requestOtp} className="mt-7 space-y-4">
          <label className="block">
            <span className="mb-2 block text-sm font-bold">رقم الجوال</span>
            <input
              dir="ltr"
              inputMode="tel"
              required
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={sent}
              className="min-h-12 w-full rounded-xl border border-black/20 px-4"
            />
          </label>
          {sent && (
            <label className="block">
              <span className="mb-2 block text-sm font-bold">رمز التحقق</span>
              <input
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="min-h-12 w-full rounded-xl border border-black/20 px-4 text-center text-xl tracking-[0.4em]"
              />
            </label>
          )}
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          <Button className="w-full" disabled={busy} type="submit">
            {busy ? "جارٍ التحقق…" : sent ? "دخول" : "إرسال الرمز"}
          </Button>
          {sent && (
            <Button
              className="w-full"
              variant="ghost"
              type="button"
              onClick={() => {
                setSent(false);
                setCode("");
              }}
            >
              تغيير الرقم
            </Button>
          )}
        </form>
      </Card>
    </main>
  );
}
