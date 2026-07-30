"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { PlanetRegion } from "@kawkab/shared-types";
import type { Quality } from "../store/world-store";

const biomeColors: Record<string, string> = {
  deep_ocean: "#0b2a58",
  shallow_ocean: "#0d5f89",
  beach: "#c9a96b",
  tundra: "#9fb4b6",
  taiga: "#245d48",
  temperate_forest: "#1f8a55",
  rainforest: "#0bb26c",
  grassland: "#70b95d",
  savanna: "#c8a24a",
  desert: "#d19145",
  mountain: "#79818d",
  volcanic: "#ff5a36",
  ice_cap: "#eafcff",
  wetland: "#24796f"
};

function PlanetMesh({ regions, quality }: { regions: PlanetRegion[]; quality: Quality }) {
  const mesh = useRef<THREE.Mesh>(null);
  const texture = useMemo(() => {
    const resolution = Math.max(1, Math.round(Math.sqrt(regions.length)));
    const canvas = document.createElement("canvas");
    canvas.width = resolution;
    canvas.height = resolution;
    const context = canvas.getContext("2d")!;
    for (const region of regions) {
      context.fillStyle = biomeColors[region.biome] ?? "#2de2e6";
      context.fillRect(region.x, region.y, 1, 1);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [regions]);

  useFrame((_, delta) => {
    if (mesh.current) mesh.current.rotation.y += delta * 0.08;
  });

  const segments = quality === "high" ? 96 : quality === "medium" ? 64 : 32;
  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[2.15, segments, segments]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.22, segments, segments]} />
        <meshBasicMaterial color="#2de2e6" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

export function PlanetScene({ regions, quality }: { regions: PlanetRegion[]; quality: Quality }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 48 }} dpr={quality === "high" ? [1, 2] : [1, 1.4]}>
      <color attach="background" args={["#050810"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 2, 5]} intensity={2.2} color="#dffcff" />
      <pointLight position={[-4, -2, -3]} intensity={0.8} color="#9b5cff" />
      <Stars radius={80} depth={40} count={quality === "low" ? 800 : 1800} factor={4} fade speed={0.4} />
      {regions.length > 0 ? <PlanetMesh regions={regions} quality={quality} /> : null}
      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={8} />
    </Canvas>
  );
}
