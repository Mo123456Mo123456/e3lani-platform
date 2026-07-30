"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Panel, Spinner } from "@kawkab/ui";
import { api } from "@/lib/api";
import { useWorldStore } from "@/lib/store";
import { formatCompact } from "@/lib/format";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/i18n";

interface SpeciesRow {
  id: string;
  name: string;
  homeBiome: string;
  diet: string;
  globalPopulation: number;
  cellCount: number;
  extinct: boolean;
  originContributionId: string | null;
}

interface PlantRow {
  id: string;
  name: string;
  biomes: string[];
  coverage: number;
  extinct: boolean;
  traits: { luminosity?: number; pollutionAbsorption?: number };
  originContributionId: string | null;
}

export default function CreaturesPage() {
  const { t, locale } = useT();
  const planetId = useWorldStore((s) => s.planetId);
  const [tab, setTab] = useState<"species" | "plants">("species");
  const [query, setQuery] = useState("");
  const { data: species, isLoading } = useQuery({
    queryKey: ["species", planetId],
    queryFn: () => api<SpeciesRow[]>(`/api/worlds/${planetId}/species`),
    enabled: !!planetId,
  });
  const { data: plants } = useQuery({
    queryKey: ["plants", planetId],
    queryFn: () => api<PlantRow[]>(`/api/worlds/${planetId}/plants`),
    enabled: !!planetId,
  });

  const filteredSpecies = useMemo(
    () => (species ?? []).filter((s) => s.name.toLowerCase().includes(query.toLowerCase())).slice(0, 200),
    [species, query],
  );
  const filteredPlants = useMemo(
    () => (plants ?? []).filter((p) => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 200),
    [plants, query],
  );

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center gap-3 mb-4">
        <h1 className="text-xl font-bold">{t("nav.creatures")}</h1>
        <div className="flex gap-1 text-xs">
          <button onClick={() => setTab("species")} className={`px-3 py-1 rounded ${tab === "species" ? "bg-nature/15 text-nature" : "text-dim"}`}>
            {t("nav.creatures")} ({species?.length ?? 0})
          </button>
          <button onClick={() => setTab("plants")} className={`px-3 py-1 rounded ${tab === "plants" ? "bg-nature/15 text-nature" : "text-dim"}`}>
            {t("stats.plants")} ({plants?.length ?? 0})
          </button>
        </div>
        <div className="flex-1" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("explore.search")} className="bg-bg border border-line rounded px-3 py-1.5 text-sm w-48 focus:border-tech outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center p-10"><Spinner /></div>
      ) : tab === "species" ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredSpecies.map((sp) => (
            <div key={sp.id} className="rounded-lg border border-line bg-panel p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1" dir="ltr">{sp.name}</span>
                {sp.extinct && <Badge color="#f87171">{t("common.extinct")}</Badge>}
                {sp.originContributionId && <Badge color="#38bdf8">★</Badge>}
              </div>
              <div className="flex gap-2 mt-2 text-[11px] text-dim">
                <span>{t(`biome.${sp.homeBiome}` as MessageKey)}</span>·<span>{sp.diet}</span>
              </div>
              <div className="text-xs mt-1 tabular-nums text-nature">{formatCompact(sp.globalPopulation, locale)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredPlants.map((p) => (
            <div key={p.id} className="rounded-lg border border-line bg-panel p-3">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm flex-1" dir="ltr">{p.name}</span>
                {p.extinct && <Badge color="#f87171">{t("common.extinct")}</Badge>}
                {(p.traits.luminosity ?? 0) > 0.3 && <Badge color="#38bdf8">✦</Badge>}
                {p.originContributionId && <Badge color="#38bdf8">★</Badge>}
              </div>
              <div className="flex flex-wrap gap-1 mt-2">
                {p.biomes.map((b) => (
                  <span key={b} className="text-[10px] text-dim">{t(`biome.${b}` as MessageKey)}</span>
                ))}
              </div>
              <div className="text-xs mt-1 tabular-nums text-nature">{formatCompact(p.coverage, locale)}</div>
            </div>
          ))}
        </div>
      )}
      <div className="hidden"><Panel /></div>
    </div>
  );
}
