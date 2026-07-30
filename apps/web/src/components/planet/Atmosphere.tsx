"use client";

/** Luminous atmosphere shell — fresnel glow on a backside sphere. */
import { useMemo } from "react";
import * as THREE from "three";
import { ATMOSPHERE_FRAGMENT, ATMOSPHERE_VERTEX } from "./shaders";
import { PLANET_RADIUS } from "./PlanetMesh";

export function Atmosphere({ segments }: { segments: number }) {
  const uniforms = useMemo(
    () => ({
      color: { value: new THREE.Color("#4aa3ff") },
      intensityScale: { value: 1.4 },
    }),
    [],
  );
  return (
    <mesh scale={1.045}>
      <sphereGeometry args={[PLANET_RADIUS, segments, segments]} />
      <shaderMaterial
        vertexShader={ATMOSPHERE_VERTEX}
        fragmentShader={ATMOSPHERE_FRAGMENT}
        uniforms={uniforms}
        side={THREE.BackSide}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
