"use client";

/** Procedural cloud shell — alpha-mapped sphere drifting over the surface. */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { buildCloudTexture } from "./planetTextures";
import { PLANET_RADIUS } from "./PlanetMesh";

export function Clouds({ seed, segments }: { seed: string; segments: number }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const tex = new THREE.CanvasTexture(buildCloudTexture(seed));
    tex.flipY = false;
    tex.wrapS = THREE.RepeatWrapping;
    tex.needsUpdate = true;
    return tex;
  }, [seed]);

  useEffect(() => () => texture.dispose(), [texture]);

  useFrame((_, delta) => {
    if (meshRef.current) meshRef.current.rotation.y += delta * 0.006;
  });

  return (
    <mesh ref={meshRef} scale={1.018}>
      <sphereGeometry args={[PLANET_RADIUS, segments, segments]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0.55}
        depthWrite={false}
        side={THREE.FrontSide}
      />
    </mesh>
  );
}
