"use client";

import { useEffect, useState } from "react";
import { Button, Card, Logo } from "@e3lani/ui";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export default function LoginPage() {
  const [step, setStep] = useState<"profile" | "otp">("profile");
  const [phone, setPhone] = useState("+9665");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [accountType, setAccountType] = useState("INDIVIDUAL");
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<Array<{ id: string; nameAr: string }>>([]);
  const [code, setCode] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`${api}/catalog`)
      .then((response) => response.json())
      .then((data) => setCities(data.regions.flatMap((region: { cities: typeof cities }) => region.cities)))
      .catch(() => setCities([]));
  }, []);

  async function requestOtp() {
    setError("");
    const response = await fetch(`${api}/auth/otp/request`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ phone })
    });
    if (!response.ok) {
      setError("تعذر إرسال رمز التحقق. تحقق من الرقم وحاول لاحقًا.");
      return;
    }
    setStep("otp");
  }

  async function verifyOtp() {
    setError("");
    const response = await fetch(`${api}/auth/otp/verify`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        phone,
        code,
        name,
        email: email || undefined,
        accountType,
        cityId,
        acceptedTerms: accepted
      })
    });
    if (!response.ok) {
      setError("رمز التحقق غير صحيح أو منتهي الصلاحية.");
      return;
    }
    const session = await response.json();
    localStorage.setItem("e3lani.accessToken", session.accessToken);
    localStorage.setItem("e3lani.refreshToken", session.refreshToken);
    const next = new URL(location.href).searchParams.get("next");
    location.assign(next?.startsWith("/") ? next : "/");
  }

  return (
    <main className="grid min-h-dvh place-items-center bg-muted p-4">
      <Card className="w-full max-w-md p-6">
        <Logo />
        <h1 className="mt-5 text-2xl font-black">الدخول أو إنشاء حساب</h1>
        <p className="mt-1 text-sm text-black/55">برقم الجوال ورمز تحقق لمرة واحدة فقط.</p>
        {step === "profile" ? (
          <div className="mt-6 grid gap-3">
            <input className="h-12 rounded-xl border px-3" value={name} onChange={(e) => setName(e.target.value)} placeholder="الاسم" />
            <input dir="ltr" className="h-12 rounded-xl border px-3 text-left" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+9665XXXXXXXX" />
            <select className="h-12 rounded-xl border px-3" value={accountType} onChange={(e) => setAccountType(e.target.value)}>
              <option value="INDIVIDUAL">فرد</option>
              <option value="STORE">متجر</option>
              <option value="BRAND">براند</option>
              <option value="COMPANY">شركة</option>
            </select>
            {accountType !== "INDIVIDUAL" && (
              <input dir="ltr" className="h-12 rounded-xl border px-3 text-left" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="البريد الإلكتروني التجاري" type="email" />
            )}
            <select className="h-12 rounded-xl border px-3" value={cityId} onChange={(e) => setCityId(e.target.value)}>
              <option value="">اختر المدينة</option>
              {cities.map((city) => <option key={city.id} value={city.id}>{city.nameAr}</option>)}
            </select>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              أوافق على شروط الاستخدام وسياسة الخصوصية.
            </label>
            <Button disabled={!name || !cityId || !accepted || phone.length !== 13} onClick={() => void requestOtp()}>
              إرسال رمز التحقق
            </Button>
          </div>
        ) : (
          <div className="mt-6 grid gap-3">
            <input inputMode="numeric" dir="ltr" className="h-14 rounded-xl border px-3 text-center text-2xl tracking-[0.4em]" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} placeholder="000000" />
            <Button disabled={code.length !== 6} onClick={() => void verifyOtp()}>تحقق ودخول</Button>
            <Button variant="outline" onClick={() => setStep("profile")}>تغيير البيانات</Button>
          </div>
        )}
        {error && <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      </Card>
    </main>
  );
}
