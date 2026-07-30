"use client";

import { useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import * as THREE from "three";
import { useAppStore } from "@/stores/app";

type Region = {
  id: string;
  biome: string;
  lat: number;
  lon: number;
  population?: number;
  pollution?: number;
  civilizationId?: string | null;
};

const BIOME_RGB: Record<string, [number, number, number]> = {
  ocean: [0.04, 0.2, 0.45],
  coast: [0.12, 0.45, 0.55],
  plains: [0.35, 0.55, 0.2],
  rainforest: [0.08, 0.35, 0.12],
  temperate_forest: [0.15, 0.42, 0.18],
  desert: [0.72, 0.6, 0.3],
  mountain: [0.45, 0.45, 0.48],
  tundra: [0.55, 0.6, 0.65],
  swamp: [0.25, 0.35, 0.15],
  steppe: [0.55, 0.62, 0.35],
  volcanic: [0.35, 0.12, 0.1],
  ice: [0.85, 0.92, 0.98],
};

function latLonToVec3(lat: number, lon: number, r = 1.02) {
  // lat,lon in [-1,1]
  const phi = ((1 - lat) * Math.PI) / 2; // 0..PI
  const theta = ((lon + 1) * Math.PI); // 0..2PI roughly with lon -1..1 => 0..2PI
  const x = r * Math.sin(phi) * Math.cos(theta);
  const y = r * Math.cos(phi);
  const z = r * Math.sin(phi) * Math.sin(theta);
  return new THREE.Vector3(x, y, z);
}

function PlanetMesh({
  heightPreview,
  regions,
  quality,
}: {
  heightPreview: number[][];
  regions: Region[];
  quality: string;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const selectRegion = useAppStore((s) => s.selectRegion);
  const layer = useAppStore((s) => s.layer);

  const texture = useMemo(() => {
    const h = heightPreview.length || 32;
    const w = heightPreview[0]?.length || 32;
    const data = new Uint8Array(w * h * 4);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const elev = heightPreview[y]?.[x] ?? 0.3;
        // Approximate biome from elevation + latitude
        const lat = 1 - (2 * y) / Math.max(1, h - 1);
        let biome = "ocean";
        if (elev < 0.28) biome = "ocean";
        else if (elev < 0.32) biome = "coast";
        else if (elev > 0.82) biome = Math.abs(lat) > 0.6 ? "ice" : "mountain";
        else if (Math.abs(lat) > 0.75) biome = "tundra";
        else if (elev > 0.55 && elev < 0.7) biome = "temperate_forest";
        else if (elev < 0.4 && Math.abs(lat) < 0.4) biome = "rainforest";
        else if (elev > 0.45 && Math.abs(lat) < 0.5) biome = "desert";
        else biome = "plains";
        const rgb = BIOME_RGB[biome] ?? BIOME_RGB.plains!;
        const i = (y * w + x) * 4;
        // Night lights bias on land
        const night = elev > 0.32 ? 0.08 : 0;
        data[i] = Math.floor(rgb[0] * 255 + night * 80);
        data[i + 1] = Math.floor(rgb[1] * 255 + night * 60);
        data[i + 2] = Math.floor(rgb[2] * 255);
        data[i + 3] = 255;
      }
    }
    // Paint civilization / pollution overlays from regions
    for (const r of regions) {
      const u = Math.floor(((r.lon + 1) / 2) * (w - 1));
      const v = Math.floor(((1 - r.lat) / 2) * (h - 1));
      if (u < 0 || v < 0 || u >= w || v >= h) continue;
      const i = (v * w + u) * 4;
      if (layer === "civilization" && r.civilizationId) {
        data[i] = 234;
        data[i + 1] = 179;
        data[i + 2] = 8;
      } else if (layer === "pollution" && (r.pollution ?? 0) > 0.2) {
        data[i] = 180;
        data[i + 1] = 80;
        data[i + 2] = 40;
      } else if (layer === "conflict") {
        /* markers handled as sprites */
      }
    }
    const tex = new THREE.DataTexture(data, w, h);
    tex.needsUpdate = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.LinearFilter;
    tex.minFilter = THREE.LinearFilter;
    return tex;
  }, [heightPreview, regions, layer]);

  const detail = quality === "ultra" ? 96 : quality === "high" ? 64 : quality === "medium" ? 48 : 32;

  useFrame((_, dt) => {
    if (meshRef.current) meshRef.current.rotation.y += dt * 0.05;
    if (cloudsRef.current) cloudsRef.current.rotation.y += dt * 0.07;
  });

  return (
    <group>
      <mesh
        ref={meshRef}
        onClick={(e) => {
          e.stopPropagation();
          // Pick nearest region by ray point
          const p = e.point.clone().normalize();
          let best: Region | null = null;
          let bestD = Infinity;
          for (const r of regions) {
            const v = latLonToVec3(r.lat, r.lon, 1);
            const d = v.distanceTo(p);
            if (d < bestD) {
              bestD = d;
              best = r;
            }
          }
          if (best && bestD < 0.35) selectRegion(best.id);
        }}
      >
        <sphereGeometry args={[1, detail, detail]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.85}
          metalness={0.05}
          emissive={new THREE.Color("#071018")}
          emissiveIntensity={0.35}
        />
      </mesh>

      {/* Atmosphere */}
      <mesh scale={1.045}>
        <sphereGeometry args={[1, 48, 48]} />
        <meshBasicMaterial
          color="#4db8ff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Clouds */}
      {(quality === "ultra" || quality === "high") && (
        <mesh ref={cloudsRef} scale={1.02}>
          <sphereGeometry args={[1, 48, 48]} />
          <meshPhongMaterial
            color="#cfefff"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Region markers */}
      {regions
        .filter((r) => r.biome !== "ocean")
        .filter((_, i) => (quality === "power_saver" ? i % 4 === 0 : true))
        .slice(0, quality === "power_saver" ? 24 : 60)
        .map((r) => {
          const pos = latLonToVec3(r.lat, r.lon, 1.04);
          const color =
            layer === "conflict"
              ? "#ef4444"
              : r.civilizationId
                ? "#eab308"
                : r.biome === "rainforest" || r.biome === "temperate_forest"
                  ? "#22c55e"
                  : "#22d3ee";
          return (
            <mesh
              key={r.id}
              position={pos}
              onClick={(e) => {
                e.stopPropagation();
                selectRegion(r.id);
              }}
            >
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
          );
        })}
    </group>
  );
}

export function PlanetScene({
  heightPreview,
  regions,
}: {
  heightPreview: number[][];
  regions: Region[];
}) {
  const quality = useAppStore((s) => s.graphicsQuality);
  const starCount =
    quality === "ultra" ? 4000 : quality === "high" ? 2500 : quality === "medium" ? 1200 : 400;

  return (
    <Canvas
      camera={{ position: [0, 0.4, 2.6], fov: 42 }}
      dpr={quality === "power_saver" ? 1 : [1, 1.75]}
      gl={{ antialias: quality !== "power_saver", powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
    >
      <color attach="background" args={["#03070f"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 2, 3]} intensity={1.35} color="#fff6e8" />
      <directionalLight position={[-4, -1, -2]} intensity={0.25} color="#4da6ff" />
      <Stars radius={80} depth={40} count={starCount} factor={3} saturation={0} fade speed={0.4} />
      <PlanetMesh heightPreview={heightPreview} regions={regions} quality={quality} />
      <OrbitControls
        enablePan={false}
        minDistance={1.4}
        maxDistance={4.5}
        rotateSpeed={0.6}
        zoomSpeed={0.7}
      />
    </Canvas>
  );
}
