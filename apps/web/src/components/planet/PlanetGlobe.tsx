"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useAppStore } from "@/lib/store";

export interface RegionPoint {
  id: string;
  lat: number;
  lon: number;
  biome: string;
  elevation: number;
  temperature: number;
  pollution: number;
  population: number;
  nameAr: string;
  name: string;
}

export interface OverlayMarker {
  id: string;
  lat: number;
  lon: number;
  color: string;
  label: string;
  kind: string;
}

const BIOME_RGB: Record<string, [number, number, number]> = {
  ocean: [0.05, 0.22, 0.48],
  coast: [0.78, 0.72, 0.42],
  plains: [0.42, 0.62, 0.28],
  rainforest: [0.06, 0.38, 0.12],
  temperate_forest: [0.16, 0.48, 0.22],
  desert: [0.86, 0.72, 0.38],
  mountain: [0.48, 0.45, 0.42],
  tundra: [0.72, 0.78, 0.76],
  swamp: [0.28, 0.38, 0.22],
  steppe: [0.68, 0.62, 0.32],
  volcanic: [0.4, 0.18, 0.12],
  ice: [0.9, 0.95, 1.0],
};

function latLonToVec3(lat: number, lon: number, radius: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createPlanetTexture(regions: RegionPoint[], size = 512): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  // deep ocean base
  const grad = ctx.createLinearGradient(0, 0, 0, size);
  grad.addColorStop(0, "#0a1a33");
  grad.addColorStop(0.5, "#0d2848");
  grad.addColorStop(1, "#0a1a33");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  for (const r of regions) {
    const x = ((r.lon + 180) / 360) * size;
    const y = ((90 - r.lat) / 180) * size;
    const [cr, cg, cb] = BIOME_RGB[r.biome] ?? [0.3, 0.3, 0.3];
    const elev = r.elevation;
    const color = `rgb(${Math.floor(cr * 255 * (0.7 + elev * 0.3))},${Math.floor(cg * 255 * (0.7 + elev * 0.3))},${Math.floor(cb * 255)})`;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r.biome === "ocean" ? 6 : 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // soft blur via second pass dots
  for (const r of regions) {
    if (r.biome === "ocean") continue;
    const x = ((r.lon + 180) / 360) * size;
    const y = ((90 - r.lat) / 180) * size;
    ctx.fillStyle = `rgba(255,255,255,${r.population > 100000 ? 0.08 : 0})`;
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

function CloudLayer({ quality }: { quality: string }) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });
  if (quality === "power_save") return null;
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.02, 64, 64]} />
      <meshStandardMaterial
        color="#cfe9ff"
        transparent
        opacity={0.12}
        depthWrite={false}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[1.06, 64, 64]} />
      <meshBasicMaterial color="#3ecbff" transparent opacity={0.08} side={THREE.BackSide} />
    </mesh>
  );
}

function Markers({
  markers,
  onSelect,
}: {
  markers: OverlayMarker[];
  onSelect: (id: string) => void;
}) {
  return (
    <group>
      {markers.map((m) => {
        const pos = latLonToVec3(m.lat, m.lon, 1.03);
        return (
          <mesh key={m.id} position={pos} onClick={(e) => { e.stopPropagation(); onSelect(m.id); }}>
            <sphereGeometry args={[0.018, 12, 12]} />
            <meshStandardMaterial color={m.color} emissive={m.color} emissiveIntensity={0.8} />
          </mesh>
        );
      })}
    </group>
  );
}

function RegionHotspots({
  regions,
  onSelect,
}: {
  regions: RegionPoint[];
  onSelect: (id: string) => void;
}) {
  const land = useMemo(
    () => regions.filter((r) => r.biome !== "ocean").filter((_, i) => i % 3 === 0),
    [regions],
  );
  return (
    <group>
      {land.map((r) => {
        const pos = latLonToVec3(r.lat, r.lon, 1.01);
        return (
          <mesh
            key={r.id}
            position={pos}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(r.id);
            }}
          >
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0.15} />
          </mesh>
        );
      })}
    </group>
  );
}

function NightLights({ regions, enabled }: { regions: RegionPoint[]; enabled: boolean }) {
  const positions = useMemo(() => {
    const cities = regions.filter((r) => r.population > 50000 && r.biome !== "ocean");
    const arr = new Float32Array(cities.length * 3);
    cities.forEach((r, i) => {
      const v = latLonToVec3(r.lat, r.lon, 1.005);
      arr[i * 3] = v.x;
      arr[i * 3 + 1] = v.y;
      arr[i * 3 + 2] = v.z;
    });
    return arr;
  }, [regions]);

  if (!enabled || positions.length === 0) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.012} color="#f0c14b" transparent opacity={0.85} sizeAttenuation />
    </points>
  );
}

function PlanetMesh({
  regions,
  markers,
}: {
  regions: RegionPoint[];
  markers: OverlayMarker[];
}) {
  const quality = useAppStore((s) => s.quality);
  const setSelectedRegionId = useAppStore((s) => s.setSelectedRegionId);
  const group = useRef<THREE.Group>(null);
  const tex = useMemo(() => createPlanetTexture(regions), [regions]);
  const segs = quality === "ultra" ? 128 : quality === "high" ? 96 : quality === "medium" ? 64 : 32;

  useFrame((_, dt) => {
    if (group.current) group.current.rotation.y += dt * 0.04;
  });

  return (
    <group ref={group}>
      <mesh
        onClick={() => setSelectedRegionId(null)}
      >
        <sphereGeometry args={[1, segs, segs]} />
        <meshStandardMaterial map={tex} roughness={0.85} metalness={0.05} />
      </mesh>
      <CloudLayer quality={quality} />
      {(quality === "ultra" || quality === "high") && <Atmosphere />}
      <NightLights regions={regions} enabled={quality !== "power_save"} />
      <RegionHotspots regions={regions} onSelect={setSelectedRegionId} />
      <Markers markers={markers} onSelect={setSelectedRegionId} />
    </group>
  );
}

function CameraRig() {
  const { camera } = useThree();
  useState(() => {
    camera.position.set(0, 0.4, 2.6);
  });
  return null;
}

export function PlanetGlobe({
  regions,
  markers = [],
}: {
  regions: RegionPoint[];
  markers?: OverlayMarker[];
}) {
  const quality = useAppStore((s) => s.quality);
  const dpr = quality === "ultra" ? 2 : quality === "high" ? 1.5 : 1;

  return (
    <div className="planet-canvas">
      <Canvas dpr={dpr} camera={{ position: [0, 0.35, 2.6], fov: 42 }} gl={{ antialias: true, alpha: true }}>
        <color attach="background" args={["#050a14"]} />
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 2, 3]} intensity={1.4} color="#fff6e8" />
        <directionalLight position={[-4, -1, -2]} intensity={0.35} color="#3ecbff" />
        <Suspense fallback={null}>
          <PlanetMesh regions={regions} markers={markers} />
          <Stars radius={80} depth={40} count={quality === "power_save" ? 400 : 1800} factor={3} fade speed={0.4} />
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.4}
          maxDistance={5}
          rotateSpeed={0.55}
          zoomSpeed={0.7}
        />
        <CameraRig />
      </Canvas>
    </div>
  );
}
