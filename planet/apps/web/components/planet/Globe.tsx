"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import type { GridData } from "@/lib/useWorld";
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX, CLOUD_FRAGMENT, CLOUD_VERTEX, GLOBE_FRAGMENT, GLOBE_VERTEX } from "./shaders";

const SUN_DIR = new THREE.Vector3(1.6, 0.6, 1.0).normalize();

export interface GlobeProps {
  grid: GridData;
  segments: number;
  layerMode: number; // 0 natural, 1 biomes, 2 temperature, 3 pollution
  nightLights?: Float32Array | null;
  cloudsEnabled: boolean;
  relief: number;
  onCellClick?: (cellIndex: number, uv: THREE.Vector2) => void;
}

function makeChannel(data: number[] | Float32Array, size: number, norm: (v: number) => number): THREE.DataTexture {
  const arr = new Float32Array(data.length);
  for (let i = 0; i < data.length; i++) arr[i] = norm(data[i] ?? 0);
  const tex = new THREE.DataTexture(arr, size, size === 0 ? 1 : data.length / size, THREE.RedFormat, THREE.FloatType);
  tex.needsUpdate = true;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = THREE.RepeatWrapping;
  return tex;
}

/** UV of SphereGeometry matches the equirectangular grid (v flipped). */
export function cellToUv(grid: GridData, cell: number): [number, number] {
  const x = cell % grid.width;
  const y = Math.floor(cell / grid.width);
  return [(x + 0.5) / grid.width, 1 - (y + 0.5) / grid.height];
}

export function uvToSpherePoint(uv: THREE.Vector2, radius: number): THREE.Vector3 {
  const lon = uv.x * Math.PI * 2 - Math.PI;
  const lat = (uv.y - 0.5) * Math.PI;
  return new THREE.Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  );
}

export function cellToSpherePosition(grid: GridData, cell: number, radius: number): THREE.Vector3 {
  const [u, v] = cellToUv(grid, cell);
  return uvToSpherePoint(new THREE.Vector2(u, v), radius);
}

export const GLOBE_RADIUS = 2;

export function Globe({ grid, segments, layerMode, nightLights, cloudsEnabled, relief, onCellClick }: GlobeProps) {
  const group = useRef<THREE.Group>(null);
  const cloudMat = useRef<THREE.ShaderMaterial>(null);

  const textures = useMemo(() => {
    const w = grid.width;
    return {
      elevation: makeChannel(grid.elevation, w, (v) => v / 1000),
      biome: makeChannel(grid.biome, w, (v) => v / 11),
      temperature: makeChannel(grid.temperature, w, (v) => v / 2000 + 0.5),
      moisture: makeChannel(grid.moisture, w, (v) => v / 1000),
      pollution: makeChannel(grid.pollution, w, (v) => v / 1000),
      ice: makeChannel(grid.ice, w, (v) => v / 1000),
      river: makeChannel(grid.river, w, (v) => v),
      nightLights: makeChannel(nightLights ?? new Float32Array(grid.elevation.length), w, (v) => v),
    };
  }, [grid, nightLights]);

  const globeUniforms = useMemo(
    () => ({
      uElevation: { value: textures.elevation },
      uBiome: { value: textures.biome },
      uTemperature: { value: textures.temperature },
      uMoisture: { value: textures.moisture },
      uPollution: { value: textures.pollution },
      uIce: { value: textures.ice },
      uRiver: { value: textures.river },
      uNightLights: { value: textures.nightLights },
      uSeaLevel: { value: grid.seaLevel },
      uSunDir: { value: SUN_DIR },
      uLayerMode: { value: layerMode },
      uRelief: { value: relief },
      uTime: { value: 0 },
    }),
    [textures, grid.seaLevel, layerMode, relief],
  );

  const atmosphereUniforms = useMemo(() => ({ uSunDir: { value: SUN_DIR } }), []);
  const cloudUniforms = useMemo(
    () => ({ uTime: { value: 0 }, uMoisture: { value: textures.moisture }, uSunDir: { value: SUN_DIR } }),
    [textures],
  );

  useFrame((state, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.018;
    if (cloudMat.current) cloudMat.current.uniforms["uTime"]!.value = state.clock.elapsedTime;
  });

  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    if (!onCellClick || !e.uv) return;
    e.stopPropagation();
    const x = Math.min(Math.floor(e.uv.x * grid.width), grid.width - 1);
    const y = Math.min(Math.floor((1 - e.uv.y) * grid.height), grid.height - 1);
    onCellClick(y * grid.width + x, e.uv);
  };

  return (
    <group ref={group}>
      <mesh onClick={handleClick} key={`globe-${segments}`}>
        <sphereGeometry args={[GLOBE_RADIUS, segments, segments / 2]} />
        <shaderMaterial vertexShader={GLOBE_VERTEX} fragmentShader={GLOBE_FRAGMENT} uniforms={globeUniforms} />
      </mesh>

      {cloudsEnabled && (
        <mesh scale={1.015}>
          <sphereGeometry args={[GLOBE_RADIUS, Math.max(segments / 2, 32), Math.max(segments / 4, 16)]} />
          <shaderMaterial
            ref={cloudMat}
            vertexShader={CLOUD_VERTEX}
            fragmentShader={CLOUD_FRAGMENT}
            uniforms={cloudUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh scale={1.09}>
        <sphereGeometry args={[GLOBE_RADIUS, 48, 24]} />
        <shaderMaterial
          vertexShader={ATMOSPHERE_VERTEX}
          fragmentShader={ATMOSPHERE_FRAGMENT}
          uniforms={atmosphereUniforms}
          transparent
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
