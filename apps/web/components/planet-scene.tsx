
"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { City, PlanetRegion, WorldEvent } from "@kawkab/shared-types";
import type { PlanetLayer, Quality } from "../store/world-store";

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

function regionColor(region: PlanetRegion, layer: PlanetLayer): string {
  if (layer === "temperature") {
    const hot = Math.round(region.temperature * 255);
    const cold = Math.round((1 - region.temperature) * 180);
    return `rgb(${hot}, ${80 + Math.round(region.moisture * 80)}, ${cold})`;
  }
  if (layer === "resources") {
    const richness = Math.min(1, region.resources.length / 4);
    return richness > 0.6 ? "#ffd166" : richness > 0.2 ? "#40ff8c" : "#26364d";
  }
  return biomeColors[region.biome] ?? "#2de2e6";
}

function toSphere(region: PlanetRegion, resolution: number, radius = 2.22): [number, number, number] {
  const lon = (region.x / resolution) * Math.PI * 2;
  const lat = (region.y / resolution - 0.5) * Math.PI;
  return [radius * Math.cos(lat) * Math.cos(lon), radius * Math.sin(lat), radius * Math.cos(lat) * Math.sin(lon)];
}

function PlanetMesh({ regions, quality, layer, cities, events }: { regions: PlanetRegion[]; quality: Quality; layer: PlanetLayer; cities: City[]; events: WorldEvent[] }) {
  const group = useRef<THREE.Group>(null);
  const resolution = Math.max(1, Math.round(Math.sqrt(regions.length)));
  const byId = new Map(regions.map((region) => [region.id, region]));
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = resolution;
    canvas.height = resolution;
    const context = canvas.getContext("2d")!;
    for (const region of regions) {
      context.fillStyle = regionColor(region, layer);
      context.fillRect(region.x, region.y, 1, 1);
    }
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    return map;
  }, [regions, resolution, layer]);

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.06;
  });

  const segments = quality === "high" ? 96 : quality === "medium" ? 64 : 32;
  return (
    <group ref={group}>
      <mesh>
        <sphereGeometry args={[2.15, segments, segments]} />
        <meshStandardMaterial map={texture} roughness={0.9} metalness={0.05} />
      </mesh>
      <mesh>
        <sphereGeometry args={[2.25, segments, segments]} />
        <meshBasicMaterial color="#2de2e6" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>
      {cities.slice(0, quality === "low" ? 30 : 80).map((city) => {
        const region = byId.get(city.regionId);
        if (!region) return null;
        const [x, y, z] = toSphere(region, resolution, 2.28);
        return <mesh key={city.id} position={[x, y, z]}><sphereGeometry args={[0.025 + Math.min(0.055, city.population / 30000), 12, 12]} /><meshBasicMaterial color="#ffd166" /></mesh>;
      })}
      {events.slice(-16).map((event) => {
        if (!event.regionId) return null;
        const region = byId.get(event.regionId);
        if (!region) return null;
        const [x, y, z] = toSphere(region, resolution, 2.42);
        const color = event.type === "WAR_STARTED" ? "#ff3b5f" : event.type === "MIGRATION_STARTED" ? "#9b5cff" : "#2de2e6";
        return <mesh key={event.id} position={[x, y, z]}><sphereGeometry args={[0.04, 12, 12]} /><meshBasicMaterial color={color} /></mesh>;
      })}
    </group>
  );
}

export function PlanetScene({ regions, quality, layer, cities, events }: { regions: PlanetRegion[]; quality: Quality; layer: PlanetLayer; cities: City[]; events: WorldEvent[] }) {
  return (
    <Canvas camera={{ position: [0, 0, 6], fov: 48 }} dpr={quality === "high" ? [1, 2] : [1, 1.4]}>
      <color attach="background" args={["#050810"]} />
      <ambientLight intensity={0.45} />
      <directionalLight position={[4, 2, 5]} intensity={2.2} color="#dffcff" />
      <pointLight position={[-4, -2, -3]} intensity={0.8} color="#9b5cff" />
      <Stars radius={80} depth={40} count={quality === "low" ? 800 : 1800} factor={4} fade speed={0.4} />
      {regions.length > 0 ? <PlanetMesh regions={regions} quality={quality} layer={layer} cities={cities} events={events} /> : null}
      <OrbitControls enablePan={false} minDistance={3.2} maxDistance={8} />
    </Canvas>
  );
}
