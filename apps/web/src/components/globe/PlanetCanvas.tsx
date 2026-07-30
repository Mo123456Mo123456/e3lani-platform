"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { Line, OrbitControls, Stars } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";
import type { QualityPreset, WorldEvent } from "@kawkab/shared-types";
import { latLonToVec3, uvToLatLon } from "@/lib/format";
import type { PlanetTextures } from "./usePlanetTextures";
import { atmosphereFragment, atmosphereVertex, cloudsFragment, cloudsVertex, surfaceFragment, surfaceVertex } from "./shaders";

export interface CityMarker {
  id: string;
  lat: number;
  lon: number;
  population: number;
  isCapital: boolean;
  color: string;
  name: string;
}

export interface ArcPath {
  id: string;
  points: Array<{ lat: number; lon: number }>;
  color: string;
}

export interface WarFront {
  id: string;
  lat: number;
  lon: number;
}

interface PlanetCanvasProps {
  textures: PlanetTextures;
  gridWidth: number;
  gridHeight: number;
  cities: CityMarker[];
  tradeArcs: ArcPath[];
  migrationArcs: ArcPath[];
  warFronts: WarFront[];
  eventMarkers: WorldEvent[];
  selectedRegion: number | null;
  quality: QualityPreset;
  heavyEffects: boolean;
  onRegionClick: (index: number) => void;
  onFpsSample: (fps: number) => void;
}

const SEGMENTS: Record<QualityPreset, number> = { ultra: 192, high: 128, medium: 96, power_saver: 64 };

function Planet(props: PlanetCanvasProps) {
  const { textures } = props;
  const group = useRef<THREE.Group>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const sunDir = useRef(new THREE.Vector3(4, 1.5, 2).normalize());
  const fpsAccum = useRef({ frames: 0, time: 0 });

  const surfaceUniforms = useMemo(
    () => ({
      uDay: { value: null as THREE.Texture | null },
      uNight: { value: null as THREE.Texture | null },
      uSunDir: { value: sunDir.current },
      uNightBoost: { value: 1.6 },
    }),
    [],
  );
  const cloudsUniforms = useMemo(
    () => ({ uClouds: { value: null as THREE.Texture | null }, uSunDir: { value: sunDir.current } }),
    [],
  );

  useFrame((state, delta) => {
    // slow solar orbit → living day/night terminator
    const t = state.clock.elapsedTime * 0.02;
    sunDir.current.set(Math.cos(t) * 4, 1.5, Math.sin(t) * 4).normalize();
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.008;
    // fps sampling for auto quality
    const acc = fpsAccum.current;
    acc.frames++;
    acc.time += delta;
    if (acc.time >= 4) {
      props.onFpsSample(acc.frames / acc.time);
      acc.frames = 0;
      acc.time = 0;
    }
  });

  if (textures.dayTexture) {
    surfaceUniforms.uDay.value = textures.dayTexture;
    surfaceUniforms.uNight.value = textures.nightTexture;
    cloudsUniforms.uClouds.value = textures.cloudsTexture;
  }

  const segments = SEGMENTS[props.quality];
  const showClouds = props.heavyEffects || props.quality !== "power_saver";

  return (
    <group ref={group}>
      {/* surface */}
      <mesh
        onClick={(e) => {
          if (!e.uv) return;
          const { lat, lon } = uvToLatLon(e.uv.x, e.uv.y);
          const x = Math.min(props.gridWidth - 1, Math.max(0, Math.floor(((lon + 180) / 360) * props.gridWidth)));
          const y = Math.min(props.gridHeight - 1, Math.max(0, Math.floor(((90 - lat) / 180) * props.gridHeight)));
          props.onRegionClick(y * props.gridWidth + x);
        }}
      >
        <sphereGeometry args={[1, segments, segments]} />
        <shaderMaterial vertexShader={surfaceVertex} fragmentShader={surfaceFragment} uniforms={surfaceUniforms} />
      </mesh>

      {/* clouds */}
      {showClouds && (
        <mesh ref={cloudsRef} scale={1.012}>
          <sphereGeometry args={[1, Math.min(segments, 96), Math.min(segments, 96)]} />
          <shaderMaterial vertexShader={cloudsVertex} fragmentShader={cloudsFragment} uniforms={cloudsUniforms} transparent depthWrite={false} />
        </mesh>
      )}

      {/* atmosphere rim */}
      <mesh scale={1.16}>
        <sphereGeometry args={[1, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          uniforms={{ uColor: { value: new THREE.Color("#4db3ff") }, uIntensity: { value: 1.05 } }}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          transparent
          depthWrite={false}
        />
      </mesh>

      {/* city markers */}
      {props.cities.map((city) => (
        <CityPin key={city.id} city={city} />
      ))}

      {/* trade & migration arcs */}
      {props.tradeArcs.map((arc) => (
        <Arc key={arc.id} arc={arc} radius={1.015} />
      ))}
      {props.migrationArcs.map((arc) => (
        <Arc key={arc.id} arc={arc} radius={1.02} dashed />
      ))}

      {/* war fronts pulse */}
      {props.warFronts.map((front) => (
        <WarPulse key={front.id} front={front} />
      ))}

      {/* recent important events */}
      {props.eventMarkers.slice(0, 12).map((ev) =>
        ev.region ? <EventFlare key={ev.id} lat={ev.region.lat} lon={ev.region.lon} magnitude={ev.magnitude} type={ev.type} /> : null,
      )}

      {/* selected region */}
      {props.selectedRegion !== null && (
        <SelectionRing
          lat={90 - ((Math.floor(props.selectedRegion / props.gridWidth) + 0.5) / props.gridHeight) * 180}
          lon={((props.selectedRegion % props.gridWidth) + 0.5) / props.gridWidth * 360 - 180}
        />
      )}
    </group>
  );
}

function CityPin({ city }: { city: CityMarker }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = latLonToVec3(city.lat, city.lon, 1.008);
  useFrame(({ clock }) => {
    const s = city.isCapital ? 1 + Math.sin(clock.elapsedTime * 2) * 0.15 : 1;
    ref.current?.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[city.isCapital ? 0.012 : 0.007, 8, 8]} />
      <meshBasicMaterial color={city.color} />
    </mesh>
  );
}

function Arc({ arc, radius, dashed }: { arc: ArcPath; radius: number; dashed?: boolean }) {
  const points = useMemo(() => arc.points.map((p) => new THREE.Vector3(...latLonToVec3(p.lat, p.lon, radius))), [arc.points, radius]);
  if (points.length < 2) return null;
  return <Line points={points} color={arc.color} lineWidth={1.2} dashed={dashed} dashSize={0.02} gapSize={0.01} transparent opacity={0.85} />;
}

function WarPulse({ front }: { front: WarFront }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = latLonToVec3(front.lat, front.lon, 1.01);
  useFrame(({ clock }) => {
    const s = 1 + ((clock.elapsedTime * 0.8) % 1) * 1.6;
    ref.current?.scale.setScalar(s);
    (ref.current?.material as THREE.MeshBasicMaterial).opacity = 0.9 - ((clock.elapsedTime * 0.8) % 1) * 0.8;
  });
  return (
    <mesh ref={ref} position={pos} rotation={ringRotation(front.lat, front.lon)}>
      <ringGeometry args={[0.015, 0.02, 24]} />
      <meshBasicMaterial color="#f87171" transparent side={THREE.DoubleSide} />
    </mesh>
  );
}

function EventFlare({ lat, lon, magnitude, type }: { lat: number; lon: number; magnitude: number; type: WorldEvent["type"] }) {
  const ref = useRef<THREE.Mesh>(null);
  const pos = latLonToVec3(lat, lon, 1.012);
  const color = type.includes("WAR") || type.includes("DISEASE") || type.includes("EXTINCT") ? "#f87171" : type.includes("VOLCANO") || type.includes("FIRE") || type.includes("DROUGHT") ? "#fb923c" : "#38bdf8";
  useFrame(({ clock }) => {
    const s = 0.8 + Math.sin(clock.elapsedTime * 3) * 0.3;
    ref.current?.scale.setScalar(s * (0.5 + magnitude));
  });
  return (
    <mesh ref={ref} position={pos}>
      <sphereGeometry args={[0.008, 8, 8]} />
      <meshBasicMaterial color={color} transparent opacity={0.9} />
    </mesh>
  );
}

function SelectionRing({ lat, lon }: { lat: number; lon: number }) {
  const pos = latLonToVec3(lat, lon, 1.011);
  return (
    <mesh position={pos} rotation={ringRotation(lat, lon)}>
      <ringGeometry args={[0.02, 0.026, 32]} />
      <meshBasicMaterial color="#38bdf8" transparent opacity={0.95} side={THREE.DoubleSide} />
    </mesh>
  );
}

function ringRotation(lat: number, lon: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [Math.PI / 2 - phi, 0, -theta + Math.PI / 2];
}

export function PlanetCanvas(props: PlanetCanvasProps) {
  return (
    <Canvas
      camera={{ position: [0, 0.6, 3.1], fov: 42 }}
      dpr={props.quality === "ultra" ? Math.min(2, window.devicePixelRatio) : props.quality === "high" ? 1.5 : props.quality === "medium" ? 1.25 : 1}
      gl={{ antialias: props.quality !== "power_saver", powerPreference: props.quality === "power_saver" ? "low-power" : "high-performance" }}
      style={{ background: "transparent" }}
    >
      <ambientLight intensity={0.12} />
      <directionalLight position={[4, 1.5, 2]} intensity={0.4} />
      <Stars radius={80} depth={40} count={props.quality === "power_saver" ? 1200 : 4000} factor={3} fade speed={0.4} />
      <Planet {...props} />
      <OrbitControls enablePan={false} minDistance={1.35} maxDistance={7} autoRotate autoRotateSpeed={0.35} enableDamping dampingFactor={0.08} />
    </Canvas>
  );
}
