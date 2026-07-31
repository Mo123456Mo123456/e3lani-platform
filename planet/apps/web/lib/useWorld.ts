"use client";

import { useEffect, useState } from "react";
import type { WorldEvent, WorldMeta, WorldSnapshotView } from "@planet/shared-types";
import { api, apiHealthy } from "./api";
import { useEventsStore, useWorldStore } from "./store";

export interface GridData {
  width: number;
  height: number;
  seaLevel: number;
  elevation: number[];
  biome: number[];
  temperature: number[];
  moisture: number[];
  pollution: number[];
  ice: number[];
  river: number[];
}

interface WorldBundle {
  meta: WorldMeta;
  snapshot: WorldSnapshotView;
  grid: GridData;
  events: WorldEvent[];
}

let cached: WorldBundle | null = null;

/**
 * Load world data: live API first; when unreachable, generate the SAME world
 * client-side with the shared simulation engine (clearly labeled
 * "local-preview" — never presented as server data).
 */
export function useWorld(): { bundle: WorldBundle | null; mode: string; error: string | null } {
  const { meta, mode } = useWorldStore();
  const [bundle, setBundle] = useState<WorldBundle | null>(cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;
    let cancelled = false;
    (async () => {
      const live = await apiHealthy();
      if (cancelled) return;
      if (live) {
        try {
          const worlds = await api<{ id: string }[]>("/worlds");
          const worldId = worlds[0]?.id ?? "demo-world";
          const [snapshot, grid, events] = await Promise.all([
            api<WorldSnapshotView>(`/worlds/${worldId}/snapshot`),
            api<GridData>(`/worlds/${worldId}/grid`),
            api<{ events: WorldEvent[]; total: number }>(`/worlds/${worldId}/events?limit=40`),
          ]);
          if (cancelled) return;
          cached = { meta: snapshot.meta, snapshot, grid, events: events.events };
          useWorldStore.getState().setWorld(worldId, snapshot.meta, snapshot);
          useWorldStore.getState().setMode("live");
          useEventsStore.getState().prependMany(events.events);
          useEventsStore.getState().setTotal(events.total);
          setBundle(cached);
          return;
        } catch (err) {
          console.warn("live load failed, falling back to local preview", err);
        }
      }
      // Local preview: same engine, same seed, generated in-browser.
      const { createWorld, runTicks } = await import("@planet/simulation-models");
      const world = createWorld({
        worldId: "local-preview",
        name: "أوريليا (معاينة محلية)",
        seed: 20260730,
        yearsPerTick: 1,
        plantSpecies: 250,
        animalSpecies: 120,
        civilizations: 8,
        depositCount: 80,
      });
      runTicks(world, 60);
      if (cancelled) return;
      const local = buildLocalBundle(world);
      cached = local;
      useWorldStore.getState().setWorld(world.id, local.meta, local.snapshot);
      useWorldStore.getState().setMode("local-preview");
      useEventsStore.getState().prependMany(local.events);
      useEventsStore.getState().setTotal(local.events.length);
      setBundle(local);
      setError(null);
    })().catch((err) => setError(String(err)));
    return () => {
      cancelled = true;
    };
  }, []);

  return { bundle, mode: bundle ? (cached === bundle ? useWorldStore.getState().mode : mode) : "connecting", error };
  void meta;
}

function buildLocalBundle(world: import("@planet/simulation-models").WorldState): WorldBundle {
  const g = world.grid;
  const quantize = (arr: Float32Array, scale: number) => Array.from(arr, (v) => Math.round(v * scale));
  const meta: WorldMeta = {
    id: world.id,
    name: world.name,
    seed: world.seed,
    tick: world.tick,
    year: world.tick * world.yearsPerTick,
    yearsPerTick: world.yearsPerTick,
    gridWidth: g.width,
    gridHeight: g.height,
    createdAt: new Date().toISOString(),
    paused: false,
  };
  const living = world.civs.filter((c) => !c.fallen);
  const snapshot: WorldSnapshotView = {
    meta,
    stats: {
      species: world.species.filter((s) => s.kind === "fauna" && !s.extinct).length,
      plants: world.species.filter((s) => s.kind === "flora" && !s.extinct).length,
      civs: living.length,
      cities: world.cities.filter((c) => !c.fallen).length,
      technologies: world.techs.length,
      activeWars: world.wars.filter((w) => w.endedTick === undefined).length,
      alliances: world.alliances.filter((a) => !a.brokenTick).length,
      tradeRoutes: world.tradeRoutes.filter((r) => r.active).length,
      avgTemperature: 0,
      avgPollution: 0,
      totalPopulation: living.reduce((s, c) => s + c.population, 0),
    },
    civs: world.civs.map((c) => ({
      id: c.id, name: c.name, population: Math.round(c.population), capitalCell: c.capitalCell,
      cells: c.cells, techLevel: c.techLevel, government: c.government, military: c.military,
      economy: c.economy, stability: c.stability, happiness: c.happiness, pollution: c.pollutionOutput,
      culture: c.culture, language: c.language, fallen: c.fallen, foundedTick: c.foundedTick,
    })),
    cities: world.cities.map((c) => ({
      id: c.id, name: c.name, civId: c.civId, cell: c.cell,
      population: Math.round(c.population), foundedTick: c.foundedTick, fallen: c.fallen,
    })),
    tradeRoutes: world.tradeRoutes.map((r) => ({ id: r.id, fromCity: r.fromCity, toCity: r.toCity, path: r.path, active: r.active })),
    wars: world.wars.map((w) => ({
      id: w.id, attackerCiv: w.attacker, defenderCiv: w.defender, startedTick: w.startedTick,
      endedTick: w.endedTick, casualties: Math.round(w.casualties), reason: w.reason,
    })),
    alliances: world.alliances.map((a) => ({ id: a.id, civIds: a.civIds, createdTick: a.createdTick, brokenTick: a.brokenTick })),
    relations: [],
  };
  return {
    meta,
    snapshot,
    grid: {
      width: g.width, height: g.height, seaLevel: g.seaLevel,
      elevation: quantize(g.elevation, 1000),
      biome: Array.from(g.biome),
      temperature: quantize(g.temperature, 1000),
      moisture: quantize(g.moisture, 1000),
      pollution: quantize(g.pollution, 1000),
      ice: quantize(g.ice, 1000),
      river: Array.from(g.river),
    },
    events: world.events.slice(-60).reverse(),
  };
}
