"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { api } from "@/lib/api";

export interface PlanetTextures {
  day: THREE.Texture;
  night: THREE.Texture | null;
  source: "server" | "fallback";
  tick: number;
}

function base64ToBlob(base64: string): Blob {
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: "image/png" });
}

async function textureFromBase64(base64: string): Promise<THREE.Texture> {
  const bitmap = await createImageBitmap(base64ToBlob(base64));
  const tex = new THREE.Texture(bitmap);
  tex.flipY = false;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

/** Loads the server-rendered map layer; falls back to the offline
 * procedural generator (Web Worker) when the API is unreachable. */
export function useMapTexture(
  planetId: string | null,
  layer: string,
  seed: number,
  eraTick?: number | null,
): { textures: PlanetTextures | null; error: string | null } {
  const [textures, setTextures] = useState<PlanetTextures | null>(null);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const gen = ++generation.current;
    setTextures(null);
    setError(null);

    async function loadServer(): Promise<PlanetTextures | null> {
      if (!planetId) return null;
      const suffix = eraTick != null ? `?tick=${eraTick}` : "";
      const [dayRes, nightRes] = await Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/planets/${planetId}/maps/${layer}${suffix}`),
        layer === "biome"
          ? fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}/planets/${planetId}/maps/nightlights${suffix}`)
          : Promise.resolve(null),
      ]);
      if (!dayRes.ok) throw new Error(`map layer ${layer} failed: ${dayRes.status}`);
      const dayJson = (await dayRes.json()) as { pngBase64: string; tick: number };
      const day = await textureFromBase64(dayJson.pngBase64);
      let night: THREE.Texture | null = null;
      if (nightRes?.ok) {
        const nightJson = (await nightRes.json()) as { pngBase64: string };
        night = await textureFromBase64(nightJson.pngBase64);
      }
      return { day, night, source: "server", tick: dayJson.tick };
    }

    async function loadFallback(): Promise<PlanetTextures> {
      const { generateFallbackPlanet } = await import("@planet/simulation-models");
      const data = generateFallbackPlanet(seed, 144, 72);
      const pick = layer === "temperature" || layer === "moisture" ? layer : layer === "height" ? "height" : "biome";
      const rgba = data.layers[pick as "biome"];
      const tex = new THREE.DataTexture(new Uint8Array(rgba), data.width, data.height, THREE.RGBAFormat);
      tex.needsUpdate = true;
      tex.wrapS = THREE.RepeatWrapping;
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = THREE.LinearFilter;
      tex.colorSpace = THREE.SRGBColorSpace;
      return { day: tex, night: null, source: "fallback", tick: 0 };
    }

    loadServer()
      .catch(() => null)
      .then(async (server) => {
        if (cancelled || generation.current !== gen) return;
        if (server) {
          setTextures(server);
        } else {
          const fb = await loadFallback();
          if (!cancelled && generation.current === gen) setTextures(fb);
        }
      })
      .catch((err) => {
        if (!cancelled) setError((err as Error).message);
      });

    return () => {
      cancelled = true;
    };
  }, [planetId, layer, seed, eraTick]);

  // dispose old textures
  useEffect(() => {
    return () => {
      textures?.day.dispose();
      textures?.night?.dispose();
    };
  }, [textures]);

  return { textures, error };
}
