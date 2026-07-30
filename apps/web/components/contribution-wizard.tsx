"use client";

import { useMutation } from "@tanstack/react-query";
import { createContribution } from "../lib/api";
import type { Locale } from "../lib/i18n";
import { dictionaries } from "../lib/i18n";
import { useWorldStore } from "../store/world-store";
import { useState } from "react";

export function ContributionWizard({ planetId, locale }: { planetId: string; locale: Locale }) {
  const t = dictionaries[locale];
  const token = useWorldStore((state) => state.token);
  const setToken = useWorldStore((state) => state.setToken);
  const [prompt, setPrompt] = useState(locale === "ar" ? "نبات ليلي يخزن الضوء قرب الأنهار" : "A night plant that stores light near rivers");
  const [category, setCategory] = useState("plant");
  const mutation = useMutation({
    mutationFn: () => createContribution(token, { planetId, prompt, category, locale })
  });

  return (
    <div className="wizard">
      <strong>{t.stepWrite}</strong>
      <textarea rows={5} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="creature">creature</option>
        <option value="plant">plant</option>
        <option value="resource">resource</option>
        <option value="civilization">civilization</option>
        <option value="invention">invention</option>
        <option value="natural_phenomenon">natural phenomenon</option>
        <option value="disease">disease</option>
        <option value="culture">culture</option>
        <option value="world_law">world law</option>
        <option value="custom">custom</option>
      </select>
      <input placeholder="JWT access token" value={token} onChange={(event) => setToken(event.target.value)} />
      {!token ? <small className="status-warn">{t.authRequired}</small> : null}
      <button className="primary-button" disabled={!token || mutation.isPending} onClick={() => mutation.mutate()}>
        {mutation.isPending ? "..." : t.submit}
      </button>
      <strong>{t.stepBalance}</strong>
      <pre>{mutation.data ? JSON.stringify(mutation.data, null, 2) : `${t.notEnabled}: moderation confirmation UI`}</pre>
      <strong>{t.stepConfirm}</strong>
      <small>{t.notEnabled}: confirmation button will call /contributions/:id/confirm after moderation.</small>
    </div>
  );
}
