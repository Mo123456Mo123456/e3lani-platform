
"use client";

import type { PlanetRegion } from "@kawkab/shared-types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContribution, previewContribution, confirmContribution } from "../lib/api";
import type { Locale } from "../lib/i18n";
import { dictionaries } from "../lib/i18n";
import { useWorldStore } from "../store/world-store";
import { useMemo, useState } from "react";

export function ContributionWizard({ planetId, regions, locale, onConfirmed }: { planetId: string; regions: PlanetRegion[]; locale: Locale; onConfirmed(result: any): void }) {
  const t = dictionaries[locale];
  const token = useWorldStore((state) => state.token);
  const client = useQueryClient();
  const [prompt, setPrompt] = useState(locale === "ar" ? "نبات ليلي يخزن الضوء قرب الأنهار" : "A night plant that stores light near rivers");
  const [category, setCategory] = useState("plant");
  const [targetRegionId, setTargetRegionId] = useState("");
  const [contributionId, setContributionId] = useState("");
  const [preview, setPreview] = useState<any>();

  const selectableRegions = useMemo(() => regions.filter((region) => region.biome !== "deep_ocean").slice(0, 80), [regions]);

  const createMutation = useMutation({
    mutationFn: () => createContribution(token, { planetId, prompt, category, locale, targetRegionId: targetRegionId || undefined }),
    onSuccess: (data) => setContributionId(data.contribution.id)
  });
  const previewMutation = useMutation({
    mutationFn: () => previewContribution(token, contributionId),
    onSuccess: (data) => setPreview(data)
  });
  const confirmMutation = useMutation({
    mutationFn: () => confirmContribution(token, contributionId),
    onSuccess: async (data) => {
      onConfirmed(data);
      await Promise.all([client.invalidateQueries({ queryKey: ["planet"] }), client.invalidateQueries({ queryKey: ["events"] }), client.invalidateQueries({ queryKey: ["timeline"] }), client.invalidateQueries({ queryKey: ["notifications"] })]);
    }
  });

  return (
    <div className="wizard">
      <strong>{t.stepCategory}</strong>
      <select value={category} onChange={(event) => setCategory(event.target.value)}>
        <option value="creature">{locale === "ar" ? "مخلوق" : "Creature"}</option>
        <option value="plant">{locale === "ar" ? "نبات" : "Plant"}</option>
        <option value="resource">{locale === "ar" ? "مورد" : "Resource"}</option>
        <option value="civilization">{locale === "ar" ? "حضارة" : "Civilization"}</option>
        <option value="invention">{locale === "ar" ? "اختراع" : "Invention"}</option>
        <option value="natural_phenomenon">{locale === "ar" ? "ظاهرة طبيعية" : "Natural phenomenon"}</option>
        <option value="disease">{locale === "ar" ? "مرض" : "Disease"}</option>
        <option value="culture">{locale === "ar" ? "ثقافة" : "Culture"}</option>
        <option value="world_law">{locale === "ar" ? "قانون عالمي" : "World law"}</option>
        <option value="custom">{locale === "ar" ? "عنصر مخصص" : "Custom"}</option>
      </select>
      <strong>{t.stepIdea}</strong>
      <textarea rows={4} value={prompt} onChange={(event) => setPrompt(event.target.value)} />
      <strong>{t.stepRegion}</strong>
      <select value={targetRegionId} onChange={(event) => setTargetRegionId(event.target.value)}>
        <option value="">Auto / تلقائي</option>
        {selectableRegions.map((region) => <option key={region.id} value={region.id}>{region.x},{region.y} - {region.biome} - cap {region.populationCapacity}</option>)}
      </select>
      {!token ? <small className="status-warn">{t.authRequired}</small> : null}
      <button className="primary-button" disabled={!token || createMutation.isPending} onClick={() => createMutation.mutate()}>{createMutation.isPending ? "..." : t.analyze}</button>
      {createMutation.data ? <pre>{JSON.stringify(createMutation.data.contribution.structuredPayload, null, 2)}</pre> : null}
      <strong>{t.stepPreview}</strong>
      <button className="secondary-button" disabled={!contributionId || previewMutation.isPending} onClick={() => previewMutation.mutate()}>{previewMutation.isPending ? "..." : t.preview}</button>
      {preview ? <div className="preview-box"><p>Success: {Math.round(preview.successProbability * 100)}%</p><p>Risks: {preview.risks.join(", ") || "none"}</p><pre>{JSON.stringify(preview.deltas, null, 2)}</pre></div> : null}
      <strong>{t.stepConfirm}</strong>
      <button className="primary-button" disabled={!preview || confirmMutation.isPending} onClick={() => confirmMutation.mutate()}>{confirmMutation.isPending ? "..." : t.confirm}</button>
      {confirmMutation.error ? <small className="status-warn">{String(confirmMutation.error.message)}</small> : null}
    </div>
  );
}
