"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { arcPoints, latLonFromCell, latLonToVec3 } from "@planet/simulation-models";
import type { CityDto, TradeRouteDto, WarDto, WorldEvent } from "@planet/shared-types";
import { usePlanetStore } from "@/lib/planet-store";

interface OverlayData {
  cities: CityDto[];
  tradeRoutes: TradeRouteDto[];
  wars: WarDto[];
  migrations: Array<{ fromCell: number; toCell: number; size: number; tick: number }>;
}

const CITY_COLOR = new THREE.Color("#f0b429");
const WAR_COLOR = new THREE.Color("#f43f5e");
const EVENT_COLOR = new THREE.Color("#fb923c");
const TRADE_COLOR = new THREE.Color("#38bdf8");
const MIGRATION_COLOR = new THREE.Color("#a78bfa");

export function Overlays({
  data,
  liveEvents,
  grid,
}: {
  data: OverlayData | null;
  liveEvents: WorldEvent[];
  grid: { latBands: number; lonBands: number };
}) {
  const overlays = usePlanetStore((s) => s.overlays);
  const selectedCell = usePlanetStore((s) => s.selectedCell);

  return (
    <group>
      {overlays.cities && data ? <CityMarkers cities={data.cities} /> : null}
      {overlays.trade && data ? <TradeArcs routes={data.tradeRoutes} grid={grid} /> : null}
      {overlays.migrations && data ? (
        <MigrationArcs migrations={data.migrations} grid={grid} />
      ) : null}
      {overlays.wars && data ? <WarMarkers wars={data.wars} grid={grid} /> : null}
      {overlays.events ? <EventMarkers events={liveEvents} grid={grid} /> : null}
      {selectedCell !== null ? <SelectedMarker cell={selectedCell} grid={grid} /> : null}
    </group>
  );
}

function CityMarkers({ cities }: { cities: CityDto[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const { positions, scales } = useMemo(() => {
    const pos: THREE.Vector3[] = [];
    const scl: number[] = [];
    for (const city of cities) {
      pos.push(new THREE.Vector3(...latLonToVec3(city.lat, city.lon, 1.012)));
      scl.push(0.006 + Math.min(0.014, city.population / 200000));
    }
    return { positions: pos, scales: scl };
  }, [cities]);

  useFrame(() => {
    if (!mesh.current) return;
    const m = new THREE.Matrix4();
    positions.forEach((p, i) => {
      m.compose(p, new THREE.Quaternion(), new THREE.Vector3(scales[i], scales[i], scales[i]));
      mesh.current!.setMatrixAt(i, m);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  if (!cities.length) return null;
  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, cities.length]} frustumCulled={false}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial color={CITY_COLOR} toneMapped={false} />
    </instancedMesh>
  );
}

function TradeArcs({ routes, grid }: { routes: TradeRouteDto[]; grid: { latBands: number; lonBands: number } }) {
  const lines = useMemo(() => {
    const out: Array<{ id: string; obj: THREE.Line }> = [];
    for (const route of routes.slice(0, 40)) {
      const pts = route.path
        .filter((_, i) => i % 2 === 0)
        .map((cell) => {
          const { lat, lon } = latLonFromCell(grid, cell);
          return new THREE.Vector3(...latLonToVec3(lat, lon, 1.008));
        });
      if (pts.length < 2) continue;
      const curve = new THREE.CatmullRomCurve3(pts);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(48));
      const mat = new THREE.LineBasicMaterial({ color: TRADE_COLOR, transparent: true, opacity: 0.5 });
      out.push({ id: route.id, obj: new THREE.Line(geo, mat) });
    }
    return out;
  }, [routes, grid]);

  return (
    <group>
      {lines.map((l) => (
        <primitive key={l.id} object={l.obj} />
      ))}
    </group>
  );
}

function MigrationArcs({
  migrations,
  grid,
}: {
  migrations: Array<{ fromCell: number; toCell: number; size: number; tick: number }>;
  grid: { latBands: number; lonBands: number };
}) {
  const lines = useMemo(() => {
    return migrations.slice(0, 30).map((mig, i) => {
      const from = latLonFromCell(grid, mig.fromCell);
      const to = latLonFromCell(grid, mig.toCell);
      const pts = arcPoints(from, to, 1.01, 0.1, 24).map((p) => new THREE.Vector3(...p));
      const geo = new THREE.BufferGeometry().setFromPoints(pts);
      const mat = new THREE.LineBasicMaterial({ color: MIGRATION_COLOR, transparent: true, opacity: 0.55 });
      return { id: i, obj: new THREE.Line(geo, mat) };
    });
  }, [migrations, grid]);

  return (
    <group>
      {lines.map((l) => (
        <primitive key={l.id} object={l.obj} />
      ))}
    </group>
  );
}

function WarMarkers({ wars, grid }: { wars: WarDto[]; grid: { latBands: number; lonBands: number } }) {
  const points = useMemo(() => {
    const positions: number[] = [];
    for (const war of wars.filter((w) => w.active)) {
      for (const cell of war.fronts.slice(0, 12)) {
        const { lat, lon } = latLonFromCell(grid, cell);
        positions.push(...latLonToVec3(lat, lon, 1.015));
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const phases = new Float32Array(positions.length / 3).map((_, i) => (i % 10) / 10);
    geo.setAttribute("phase", new THREE.BufferAttribute(phases, 1));
    const sizes = new Float32Array(positions.length / 3).fill(10);
    geo.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return geo;
  }, [wars, grid]);

  const uniforms = useMemo(() => ({ time: { value: 0 }, color: { value: WAR_COLOR } }), []);
  useFrame((_, delta) => {
    uniforms.time.value += delta;
  });

  if (points.getAttribute("position")?.count === 0) return null;
  return (
    <points geometry={points} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={stormVertex}
        fragmentShader={stormFragment}
      />
    </points>
  );
}

function EventMarkers({ events, grid }: { events: WorldEvent[]; grid: { latBands: number; lonBands: number } }) {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const evt of events.filter((e) => e.cellId !== null && e.importance >= 3).slice(0, 24)) {
      const { lat, lon } = latLonFromCell(grid, evt.cellId as number);
      positions.push(...latLonToVec3(lat, lon, 1.018));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    const count = positions.length / 3;
    geo.setAttribute("phase", new THREE.BufferAttribute(new Float32Array(count).map((_, i) => (i % 7) / 7), 1));
    geo.setAttribute("size", new THREE.BufferAttribute(new Float32Array(count).fill(14), 1));
    return geo;
  }, [events, grid]);

  const uniforms = useMemo(() => ({ time: { value: 0 }, color: { value: EVENT_COLOR } }), []);
  useFrame((_, delta) => {
    uniforms.time.value += delta;
  });

  if (geometry.getAttribute("position")?.count === 0) return null;
  return (
    <points geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        transparent
        depthWrite={false}
        uniforms={uniforms}
        vertexShader={stormVertex}
        fragmentShader={stormFragment}
      />
    </points>
  );
}

function SelectedMarker({ cell, grid }: { cell: number; grid: { latBands: number; lonBands: number } }) {
  const ref = useRef<THREE.Mesh>(null);
  const position = useMemo(() => {
    const { lat, lon } = latLonFromCell(grid, cell);
    return latLonToVec3(lat, lon, 1.012);
  }, [cell, grid]);
  useFrame(({ clock }) => {
    if (ref.current) {
      const s = 1 + Math.sin(clock.elapsedTime * 3) * 0.15;
      ref.current.scale.setScalar(s);
    }
  });
  return (
    <mesh ref={ref} position={new THREE.Vector3(...position)}>
      <ringGeometry args={[0.015, 0.022, 32]} />
      <meshBasicMaterial color="#38bdf8" side={THREE.DoubleSide} transparent opacity={0.9} />
    </mesh>
  );
}

const stormVertex = /* glsl */ `
uniform float time;
attribute float phase;
attribute float size;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  float pulse = 0.7 + 0.3 * sin(time * 2.5 + phase * 6.2831);
  gl_PointSize = size * pulse * (300.0 / -mv.z);
  gl_Position = projectionMatrix * mv;
}
`;

const stormFragment = /* glsl */ `
uniform vec3 color;
void main() {
  vec2 c = gl_PointCoord - vec2(0.5);
  float d = length(c);
  if (d > 0.5) discard;
  gl_FragColor = vec4(color, smoothstep(0.5, 0.0, d) * 0.95);
}
`;
