"use client";

/**
 * The planet surface: sphere + day/night terminator shader with a live,
 * data-driven overlay texture. Textures rebuild from grid state whenever
 * the world (or the selected layer) changes.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { PlanetGrid } from "@planet/simulation-models";
import { cellIndexAt } from "@planet/simulation-models";
import type { RenderLayer } from "@planet/shared-types";
import {
  buildDayTexture,
  buildNightTexture,
  buildOverlayTexture,
} from "./planetTextures";
import { PLANET_FRAGMENT, PLANET_VERTEX } from "./shaders";
import { uvToLatLon } from "./geo";
import type { CityMarker } from "@/lib/api";

export const PLANET_RADIUS = 1;

interface PlanetMeshProps {
  grid: PlanetGrid;
  layer: RenderLayer;
  cities: CityMarker[];
  luminescentCells: number[];
  warCivIds: Set<string>;
  segments: number;
  textureScale: number;
  onSelectCell: (cell: number) => void;
}

export function PlanetMesh({
  grid,
  layer,
  cities,
  luminescentCells,
  warCivIds,
  segments,
  textureScale,
  onSelectCell,
}: PlanetMeshProps) {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const textures = useMemo(() => {
    const day = new THREE.CanvasTexture(buildDayTexture(grid, textureScale));
    const night = new THREE.CanvasTexture(buildNightTexture(grid, textureScale, cities, luminescentCells));
    const overlay = new THREE.CanvasTexture(buildOverlayTexture(grid, textureScale, layer, warCivIds));
    for (const tex of [day, night, overlay]) {
      tex.flipY = false;
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = THREE.RepeatWrapping;
      tex.needsUpdate = true;
    }
    return { day, night, overlay };
  }, [grid, layer, cities, luminescentCells, warCivIds, textureScale]);

  useEffect(() => () => {
    textures.day.dispose();
    textures.night.dispose();
    textures.overlay.dispose();
  }, [textures]);

  const uniforms = useMemo(
    () => ({
      dayMap: { value: textures.day },
      nightMap: { value: textures.night },
      overlayMap: { value: textures.overlay },
      overlayMix: { value: layer === "surface" || layer === "biome" ? 0 : 0.85 },
      sunDir: { value: new THREE.Vector3(1.4, 0.4, 0.8) },
    }),
    [textures, layer],
  );

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.uniforms.dayMap!.value = textures.day;
      materialRef.current.uniforms.nightMap!.value = textures.night;
      materialRef.current.uniforms.overlayMap!.value = textures.overlay;
      materialRef.current.uniforms.overlayMix!.value =
        layer === "surface" || layer === "biome" ? 0 : 0.85;
    }
  });

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!event.uv) return;
    const { lat, lon } = uvToLatLon(event.uv.x, event.uv.y);
    onSelectCell(cellIndexAt(grid, lat, lon));
  };

  return (
    <mesh onClick={handleClick}>
      <sphereGeometry args={[PLANET_RADIUS, segments, segments]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={PLANET_VERTEX}
        fragmentShader={PLANET_FRAGMENT}
        uniforms={uniforms}
      />
    </mesh>
  );
}
