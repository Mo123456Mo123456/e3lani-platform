"use client";

import { Button, Card, Input } from "@e3lani/ui";
import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const endpoint = step === "phone" ? "/api/auth/request-otp" : "/api/auth/verify-otp";
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(step === "phone" ? { phone } : { phone, code }),
    });
    const data = (await response.json()) as { code?: string };
    setBusy(false);
    if (!response.ok) {
      setError(data.code === "ADMIN_ROLE_REQUIRED" ? "هذا الحساب لا يملك صلاحية دخول الإدارة." : "تعذر التحقق من بيانات الدخول.");
      return;
    }
    if (step === "phone") setStep("code");
    else {
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") ? next : "/dashboard");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-e3-black px-4">
      <Card className="w-full max-w-md p-7">
        <div className="mb-7">
          <span className="rounded-lg bg-e3-yellow px-2 py-1 text-sm font-black">E3</span>
          <h1 className="mt-4 text-3xl font-black">لوحة إدارة إعلاني</h1>
          <p className="mt-2 text-sm text-black/55">دخول موظفي الإدارة المصرّح لهم فقط.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold">
            رقم الجوال
            <Input
              dir="ltr"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              disabled={step === "code"}
              className="mt-2 text-left"
              required
            />
          </label>
          {step === "code" ? (
            <label className="block text-sm font-bold">
              رمز التحقق
              <Input
                dir="ltr"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                className="mt-2 text-center tracking-[.5em]"
                required
              />
            </label>
          ) : null}
          {error ? <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p> : null}
          <Button className="w-full" disabled={busy}>
            {busy ? "جارٍ التحقق…" : step === "phone" ? "إرسال رمز التحقق" : "دخول آمن"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
