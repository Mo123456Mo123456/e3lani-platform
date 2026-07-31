"use client";

import { useMemo, useRef } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import * as THREE from "three";
import { vec3ToLatLon, cellIdFromLatLon } from "@planet/simulation-models";
import { usePlanetStore } from "@/lib/planet-store";
import { useMapTexture } from "./useMapTexture";
import {
  PLANET_FRAGMENT,
  PLANET_VERTEX,
  ATMOSPHERE_FRAGMENT,
  ATMOSPHERE_VERTEX,
  CLOUDS_FRAGMENT,
  CLOUDS_VERTEX,
} from "./shaders";

const SEGMENTS: Record<string, number> = { ultra: 192, high: 128, medium: 96, saver: 64 };

export function Planet({
  planetId,
  seed,
  eraTick,
  grid,
  rotating,
}: {
  planetId: string | null;
  seed: number;
  eraTick?: number | null;
  grid: { latBands: number; lonBands: number };
  rotating: boolean;
}) {
  const layer = usePlanetStore((s) => s.layer);
  const quality = usePlanetStore((s) => s.effectiveQuality);
  const effects = usePlanetStore((s) => s.effectsEnabled);
  const setSelectedCell = usePlanetStore((s) => s.setSelectedCell);
  const { textures } = useMapTexture(planetId, layer, seed, eraTick);
  const group = useRef<THREE.Group>(null);

  const segments = SEGMENTS[quality] ?? 128;
  const sunDirection = useMemo(() => new THREE.Vector3(-1.2, 0.35, 0.9).normalize(), []);

  const planetUniforms = useMemo(
    () => ({
      dayMap: { value: textures?.day ?? null },
      nightMap: { value: textures?.night ?? null },
      useNight: { value: textures?.night ? 1 : 0 },
      sunDirection: { value: sunDirection },
      glowStrength: { value: effects ? 1 : 0.4 },
    }),
    [textures, sunDirection, effects],
  );

  const cloudsUniforms = useMemo(
    () => ({
      time: { value: 0 },
      sunDirection: { value: sunDirection },
      opacity: { value: quality === "saver" ? 0.35 : 0.7 },
    }),
    [sunDirection, quality],
  );

  const atmosphereUniforms = useMemo(
    () => ({
      glowColor: { value: new THREE.Color(0x3b82f6) },
      intensity: { value: effects ? 0.9 : 0.35 },
    }),
    [effects],
  );

  useFrame((_, delta) => {
    if (group.current && rotating) {
      group.current.rotation.y += delta * 0.04;
    }
    cloudsUniforms.time.value += delta;
  });

  function handleClick(e: ThreeEvent<MouseEvent>) {
    e.stopPropagation();
    const obj = e.object as THREE.Mesh;
    const local = obj.worldToLocal(e.point.clone()).normalize();
    const { lat, lon } = vec3ToLatLon(local.x, local.y, local.z);
    const cell = cellIdFromLatLon(grid, lat, lon);
    setSelectedCell(cell);
  }

  const showAtmosphere = effects && quality !== "saver";
  const showClouds = effects && quality !== "saver";

  return (
    <group ref={group}>
      <mesh key={`planet-${segments}`} onClick={handleClick}>
        <sphereGeometry args={[1, segments, segments]} />
        {textures ? (
          <shaderMaterial
            vertexShader={PLANET_VERTEX}
            fragmentShader={PLANET_FRAGMENT}
            uniforms={planetUniforms}
          />
        ) : (
          <meshStandardMaterial color="#0a1830" roughness={0.9} metalness={0.1} />
        )}
      </mesh>
      {showClouds ? (
        <mesh key={`clouds-${Math.round(segments / 2)}`} scale={1.012}>
          <sphereGeometry args={[1, Math.round(segments / 2), Math.round(segments / 2)]} />
          <shaderMaterial
            vertexShader={CLOUDS_VERTEX}
            fragmentShader={CLOUDS_FRAGMENT}
            uniforms={cloudsUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      ) : null}
      {showAtmosphere ? (
        <mesh scale={1.06}>
          <sphereGeometry args={[1, 64, 64]} />
          <shaderMaterial
            vertexShader={ATMOSPHERE_VERTEX}
            fragmentShader={ATMOSPHERE_FRAGMENT}
            uniforms={atmosphereUniforms}
            transparent
            side={THREE.BackSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ) : null}
    </group>
  );
}
