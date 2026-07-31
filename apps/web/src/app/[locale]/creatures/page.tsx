"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge, Empty, Panel, Spinner, Tabs } from "@planet/ui";
import { useI18n } from "@/components/i18n-context";
import { api } from "@/lib/api";
import { TopBar } from "@/components/shell/TopBar";

export default function CreaturesPage() {
  const { dict } = useI18n();
  const [tab, setTab] = useState("species");
  const [page, setPage] = useState(1);
  const { data: planet } = useQuery({ queryKey: ["planet-current"], queryFn: () => api().getPlanet() });
  const { data: species, isLoading: loadingSpecies } = useQuery({
    queryKey: ["species", planet?.id, page],
    queryFn: () => api().getSpecies(planet!.id, page),
    enabled: Boolean(planet) && tab === "species",
  });
  const { data: plants, isLoading: loadingPlants } = useQuery({
    queryKey: ["plants", planet?.id, page],
    queryFn: () => api().getPlants(planet!.id, page),
    enabled: Boolean(planet) && tab === "plants",
  });

  return (
    <>
      <TopBar />
      <div className="page">
        <div className="page-header">
          <h1 className="page-title">{dict.nav.creatures}</h1>
        </div>
        <Tabs
          tabs={[
            { id: "species", label: `${dict.nav.creatures} (${species?.total ?? "…"})` },
            { id: "plants", label: `${dict.categories.plant} (${plants?.total ?? "…"})` },
          ]}
          active={tab}
          onChange={(t) => {
            setTab(t);
            setPage(1);
          }}
        />
        <div style={{ height: 16 }} />
        <Panel title="">
          {tab === "species" ? (
            loadingSpecies ? (
              <Spinner />
            ) : (
              <div className="table-wrap">
                <table className="pb-table">
                  <thead>
                    <tr>
                      <th>#</th><th>{dict.common.status}</th><th>diet</th><th>size</th>
                      <th>{dict.common.population}</th><th>cells</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(species?.items ?? []).map((sp) => (
                      <tr key={sp.id} style={{ opacity: sp.extinct ? 0.45 : 1 }}>
                        <td>{sp.name}{sp.contributionId ? " ★" : ""}</td>
                        <td>{sp.extinct ? <Badge tone="danger">{dict.common.extinct}</Badge> : <Badge tone="nature">{dict.common.active}</Badge>}</td>
                        <td>{sp.diet}</td>
                        <td>{sp.size.toFixed(2)}</td>
                        <td>{sp.totalPopulation.toLocaleString()}</td>
                        <td>{sp.cellCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : loadingPlants ? (
            <Spinner />
          ) : (
            <div className="table-wrap">
              <table className="pb-table">
                <thead>
                  <tr><th>#</th><th>biome</th><th>{dict.common.status}</th><th>cells</th></tr>
                </thead>
                <tbody>
                  {(plants?.items ?? []).map((p) => (
                    <tr key={p.id} style={{ opacity: p.extinct ? 0.45 : 1 }}>
                      <td>{p.name}{p.contributionId ? " ★" : ""}</td>
                      <td><Badge tone="nature">{p.homeBiome}</Badge></td>
                      <td>{p.extinct ? <Badge tone="danger">{dict.common.extinct}</Badge> : <Badge tone="nature">{dict.common.active}</Badge>}</td>
                      <td>{p.cellCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", marginTop: 14 }}>
            <button className="hud-chip" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>←</button>
            <span className="pb-dim">{page}</span>
            <button className="hud-chip" onClick={() => setPage((p) => p + 1)}>→</button>
          </div>
        </Panel>
      </div>
    </>
  );
}
