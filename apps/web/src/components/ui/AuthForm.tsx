"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { getApiErrorMessage } from "@/lib/api";
import { useLoginMutation, useRegisterMutation } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth-store";
import { useI18n } from "@/stores/locale-store";
import { AppShell } from "@/components/ui/AppShell";
import styles from "@/app/app.module.css";

export function AuthForm({ mode }: { mode: "login" | "register" }) {
  const router = useRouter();
  const { t } = useI18n();
  const setAuth = useAuthStore((state) => state.setAuth);
  const loginMutation = useLoginMutation();
  const registerMutation = useRegisterMutation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const mutation = mode === "login" ? loginMutation : registerMutation;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError(null);

    try {
      const response =
        mode === "login"
          ? await loginMutation.mutateAsync({ email, password })
          : await registerMutation.mutateAsync({ email, password, displayName });
      const token = response.token ?? response.accessToken;

      if (!token) {
        setLocalError("Auth response did not include a token.");
        return;
      }

      setAuth(token, response.user);
      router.push("/me");
    } catch {
      // The mutation keeps the API error for the visible inline state.
    }
  }

  return (
    <AppShell>
      <section className={styles.authHero}>
        <span className={styles.eyebrow}>{t.taglineEn}</span>
        <h1>{mode === "login" ? t.auth.loginTitle : t.auth.registerTitle}</h1>
        <p>{t.auth.loginHelp}</p>
      </section>

      <div className={styles.authLayout}>
        <form className={styles.formCard} onSubmit={handleSubmit}>
          <div className={styles.formGrid}>
            {mode === "register" ? (
              <label className={styles.field}>
                <span>{t.auth.displayName}</span>
                <input className={styles.input} required value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
              </label>
            ) : null}
            <label className={styles.field}>
              <span>{t.auth.email}</span>
              <input className={styles.input} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
            </label>
            <label className={styles.field}>
              <span>{t.auth.password}</span>
              <input className={styles.input} type="password" required minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} />
            </label>
            {localError || mutation.error ? (
              <div className={styles.errorBadge} role="alert">
                {t.auth.authError}: {localError ?? getApiErrorMessage(mutation.error)}
              </div>
            ) : null}
            <button className={styles.button} type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? t.states.loading : mode === "login" ? t.actions.login : t.actions.register}
            </button>
            <p className={styles.hint}>
              {mode === "login" ? t.auth.noAccount : t.auth.hasAccount}{" "}
              <Link className={styles.navLink} href={mode === "login" ? "/register" : "/login"}>
                {mode === "login" ? t.actions.register : t.actions.login}
              </Link>
            </p>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
