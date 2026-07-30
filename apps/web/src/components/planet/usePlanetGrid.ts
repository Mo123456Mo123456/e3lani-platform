"use client";

/**
 * Loads the planet: grid-config from the API, then deterministic local
 * regeneration inside a Web Worker (main-thread fallback for robustness).
 */
import { useEffect, useRef, useState } from "react";
import { generatePlanet, type PlanetGrid } from "@planet/simulation-models";
import { api } from "@/lib/api";
import { useAppStore } from "@/lib/store";

export function usePlanetGrid(planetId: string | null): { loading: boolean; error: string | null } {
  const setPlanetConfig = useAppStore((s) => s.setPlanetConfig);
  const setGrid = useAppStore((s) => s.setGrid);
  const setOverlay = useAppStore((s) => s.setOverlay);
  const applyTick = useAppStore((s) => s.applyTick);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    if (!planetId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const config = await api.gridConfig(planetId);
        if (cancelled) return;
        setPlanetConfig({ planetId, ...config });
        applyTick(config.currentTick, config.currentYear);
        setOverlay({ owners: config.overlay.owners, pollution: config.overlay.pollution });

        const request = {
          seed: config.seed,
          latBands: config.latBands,
          lonBands: config.lonBands,
          seaLevel: config.seaLevel,
          riverCount: config.riverCount,
          resourceDensity: config.resourceDensity,
        };

        const grid = await generateInWorker(request, workerRef);
        if (cancelled) return;
        // apply the live overlay onto the regenerated terrain
        for (const [idx, owner] of Object.entries(config.overlay.owners)) {
          const cell = grid.cells[Number(idx)];
          if (cell) cell.ownerId = owner;
        }
        for (const [idx, pollution] of Object.entries(config.overlay.pollution)) {
          const cell = grid.cells[Number(idx)];
          if (cell) cell.pollution = pollution;
        }
        setGrid(grid);
        setLoading(false);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "failed to load planet");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, [planetId, setPlanetConfig, setGrid, setOverlay, applyTick]);

  return { loading, error };
}

async function generateInWorker(
  request: Parameters<typeof generatePlanet>[0] & { seed: string },
  workerRef: React.MutableRefObject<Worker | null>,
): Promise<PlanetGrid> {
  try {
    const worker = new Worker(new URL("./grid.worker.ts", import.meta.url));
    workerRef.current = worker;
    return await new Promise<PlanetGrid>((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("worker timeout")), 20000);
      worker.onmessage = (event: MessageEvent<{ grid: PlanetGrid }>) => {
        clearTimeout(timeout);
        worker.terminate();
        resolve(event.data.grid);
      };
      worker.onerror = (err) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(err);
      };
      worker.postMessage(request);
    });
  } catch {
    // robust fallback: generate on the main thread
    return generatePlanet(request);
  }
}
