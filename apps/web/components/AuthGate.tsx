"use client";

import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { authApi, isSandboxRegistrationAllowed } from "../lib/api";
import { getCopy } from "../lib/i18n";
import type { AuthUser, Language } from "../lib/types";
import { Icon } from "./Icon";

interface AuthGateProps {
  language: Language;
  checking?: boolean | undefined;
  initialError?: string | undefined;
  onAuthenticated: (user: AuthUser) => void;
  onLanguageChange: (language: Language) => void;
}

export function AuthGate({
  language,
  checking = false,
  initialError,
  onAuthenticated,
  onLanguageChange,
}: AuthGateProps) {
  const t = getCopy(language);
  const allowRegistration = isSandboxRegistrationAllowed();
  const [flow, setFlow] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  const authentication = useMutation({
    mutationFn: () =>
      flow === "register"
        ? authApi.createSandboxAccount({ email, password, displayName })
        : authApi.login(email, password),
    onSuccess: onAuthenticated,
  });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    authentication.mutate();
  };

  return (
    <main className="auth-gate">
      <div className="auth-stars" aria-hidden="true" />
      <section
        aria-busy={checking || authentication.isPending}
        aria-labelledby="auth-title"
        className="auth-card"
      >
        <header className="auth-brand">
          <span className="brand-orbit" aria-hidden="true">
            <i />
          </span>
          <div>
            <strong>{t.brand}</strong>
            <small>{t.brandEyebrow}</small>
          </div>
          <button
            className="language-button"
            onClick={() => onLanguageChange(language === "ar" ? "en" : "ar")}
            type="button"
          >
            <Icon name="language" size={17} />
            {t.language}
          </button>
        </header>

        <div className="auth-planet" aria-hidden="true">
          <span />
          <i />
        </div>

        <div className="auth-heading">
          <span className="eyebrow">{t.livingPlanet}</span>
          <h1 id="auth-title">{t.authTitle}</h1>
          <p>{checking ? t.checkingSession : t.authText}</p>
        </div>

        {!checking && (
          <>
            <div className="auth-tabs">
              <button
                aria-pressed={flow === "login"}
                className={flow === "login" ? "is-active" : ""}
                onClick={() => {
                  authentication.reset();
                  setFlow("login");
                }}
                type="button"
              >
                {t.login}
              </button>
              {allowRegistration && (
                <button
                  aria-pressed={flow === "register"}
                  className={flow === "register" ? "is-active" : ""}
                  onClick={() => {
                    authentication.reset();
                    setFlow("register");
                  }}
                  type="button"
                >
                  {t.createAccount}
                </button>
              )}
            </div>

            <form className="auth-form" onSubmit={submit}>
              {flow === "register" && (
                <label>
                  <span>{t.displayName}</span>
                  <input
                    autoComplete="name"
                    maxLength={80}
                    minLength={2}
                    onChange={(event) => setDisplayName(event.target.value)}
                    required
                    value={displayName}
                  />
                </label>
              )}
              <label>
                <span>{t.email}</span>
                <input
                  autoComplete="email"
                  inputMode="email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
              </label>
              <label>
                <span>{t.password}</span>
                <input
                  autoComplete={
                    flow === "register" ? "new-password" : "current-password"
                  }
                  maxLength={128}
                  minLength={flow === "register" ? 12 : 1}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  type="password"
                  value={password}
                />
                {flow === "register" && <small>{t.passwordHint}</small>}
              </label>

              {(authentication.isError || initialError) && (
                <p className="auth-error" role="alert">
                  {authentication.error?.message ?? initialError}
                </p>
              )}

              <button
                className="primary-button auth-submit"
                disabled={authentication.isPending}
                type="submit"
              >
                {authentication.isPending
                  ? t.authenticating
                  : flow === "register"
                    ? t.createAccount
                    : t.login}
                <Icon name="arrow" size={17} />
              </button>
            </form>
            {flow === "register" && (
              <p className="auth-sandbox-note">{t.sandboxAccountHint}</p>
            )}
          </>
        )}

        {checking && <span className="planet-loader auth-loader" />}
      </section>
    </main>
  );
}
