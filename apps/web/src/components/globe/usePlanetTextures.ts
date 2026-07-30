"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import type { LayerPayload, WorldDelta } from "@kawkab/shared-types";
import { useWorldStore } from "@/lib/store";
import { blendCell, cellColor, overlayColor, paintCell } from "./painter";
import type { GenerateRequest, GenerateResponse } from "./worker";

export interface PlanetTextures {
  dayTexture: THREE.CanvasTexture | null;
  nightTexture: THREE.Texture | null;
  cloudsTexture: THREE.Texture | null;
  ready: boolean;
  applyDelta: (delta: WorldDelta) => void;
  applyLayer: (layer: LayerPayload | null) => void;
}

/**
 * Owns the equirectangular canvases: the worker paints the base from the seed;
 * deltas and overlay layers are composited on the main thread.
 * `lights` (cities + luminous plants) must arrive before generation starts.
 */
export function usePlanetTextures(lights: GenerateRequest["lights"] | null): PlanetTextures {
  const seed = useWorldStore((s) => s.seed);
  const gridWidth = useWorldStore((s) => s.gridWidth);
  const gridHeight = useWorldStore((s) => s.gridHeight);
  const quality = useWorldStore((s) => s.quality);
  const [ready, setReady] = useState(false);

  const baseRef = useRef<HTMLCanvasElement | null>(null); // terrain from worker
  const compositeRef = useRef<HTMLCanvasElement | null>(null);
  const dayTexRef = useRef<THREE.CanvasTexture | null>(null);
  const nightTexRef = useRef<THREE.Texture | null>(null);
  const cloudsTexRef = useRef<THREE.Texture | null>(null);
  const staticsRef = useRef<Float32Array | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const layerRef = useRef<LayerPayload | null>(null);
  const scaleRef = useRef(4);
  const gridRef = useRef({ w: gridWidth, h: gridHeight });

  const scale = quality === "ultra" ? 8 : quality === "high" ? 6 : quality === "medium" ? 4 : 3;

  const redrawComposite = useCallback(() => {
    const base = baseRef.current;
    const composite = compositeRef.current;
    if (!base || !composite) return;
    const ctx = composite.getContext("2d")!;
    ctx.clearRect(0, 0, composite.width, composite.height);
    ctx.drawImage(base, 0, 0);
    // overlay pass
    const layer = layerRef.current;
    if (layer) {
      const s = scaleRef.current;
      const { w, h } = gridRef.current;
      const img = ctx.getImageData(0, 0, composite.width, composite.height);
      for (const cell of layer.cells) {
        if (cell.value <= 0.01) continue;
        const rgba = overlayColor(layer.layer, cell.value, cell.color);
        if (rgba[3] <= 0) continue;
        blendCell(img, cell.index % w, Math.floor(cell.index / w), s, rgba);
      }
      ctx.putImageData(img, 0, 0);
      void h;
    }
    if (dayTexRef.current) dayTexRef.current.needsUpdate = true;
  }, []);

  const applyLayer = useCallback(
    (layer: LayerPayload | null) => {
      layerRef.current = layer;
      redrawComposite();
    },
    [redrawComposite],
  );

  const applyDelta = useCallback(
    (delta: WorldDelta) => {
      const composite = compositeRef.current;
      const base = baseRef.current;
      const statics = staticsRef.current;
      if (!composite || !base || !statics) return;
      const s = scaleRef.current;
      const { w, h } = gridRef.current;
      // repaint into BASE first (terrain truth), then re-run overlay pass
      const bctx = base.getContext("2d")!;
      const img = bctx.getImageData(0, 0, base.width, base.height);
      for (const region of delta.changedRegions) {
        const elevation = statics[region.index * 2] ?? 0;
        const river = statics[region.index * 2 + 1] ?? 0;
        const isOcean = region.isOcean ?? elevation <= 0;
        const rgb = cellColor({
          biome: region.biome ?? (isOcean ? "ocean" : "plains"),
          elevation,
          river,
          isOcean,
          hasIce: region.hasIce ?? false,
        });
        paintCell(img, region.index % w, Math.floor(region.index / w), s, rgb, isOcean);
      }
      bctx.putImageData(img, 0, 0);
      redrawComposite();
      void h;
    },
    [redrawComposite],
  );

  useEffect(() => {
    if (!seed || !lights) return;
    setReady(false);
    gridRef.current = { w: gridWidth, h: gridHeight };
    scaleRef.current = scale;

    const worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
    workerRef.current = worker;
    let cancelled = false;

    worker.onmessage = async (ev: MessageEvent<GenerateResponse>) => {
      if (cancelled || ev.data.type !== "generated") return;
      const { terrain, lights, clouds, statics, scale: s } = ev.data;
      staticsRef.current = new Float32Array(statics);
      const w = gridWidth * s;
      const h = gridHeight * s;

      const base = document.createElement("canvas");
      base.width = w;
      base.height = h;
      base.getContext("2d")!.drawImage(terrain, 0, 0);
      baseRef.current = base;

      const composite = document.createElement("canvas");
      composite.width = w;
      composite.height = h;
      compositeRef.current = composite;

      if (!dayTexRef.current) {
        dayTexRef.current = new THREE.CanvasTexture(composite);
        dayTexRef.current.colorSpace = THREE.SRGBColorSpace;
        dayTexRef.current.anisotropy = 4;
      }
      nightTexRef.current = new THREE.Texture(lights);
      nightTexRef.current.needsUpdate = true;
      cloudsTexRef.current = new THREE.Texture(clouds);
      cloudsTexRef.current.needsUpdate = true;

      redrawComposite();
      setReady(true);
      worker.terminate();
      workerRef.current = null;
    };
    worker.onerror = (err) => {
      console.error("planet worker failed", err);
      setReady(false);
    };

    const request: GenerateRequest = {
      type: "generate",
      seed,
      gridWidth,
      gridHeight,
      scale,
      lights,
    };
    worker.postMessage(request);
    return () => {
      cancelled = true;
      worker.terminate();
      workerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seed, gridWidth, gridHeight, scale, lights]);

  return useMemo(
    () => ({
      dayTexture: dayTexRef.current,
      nightTexture: nightTexRef.current,
      cloudsTexture: cloudsTexRef.current,
      ready,
      applyDelta,
      applyLayer,
    }),
    // textures are attached by ref after generation; `ready` triggers consumers
    [ready, applyDelta, applyLayer],
  );
}

