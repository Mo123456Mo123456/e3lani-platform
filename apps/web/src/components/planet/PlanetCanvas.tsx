"use client";

/**
 * PlanetCanvas — the full 3D scene: data-driven planet, atmosphere, clouds,
 * city lights, event markers, route arcs, star backdrop. Interaction:
 * drag to rotate, scroll to zoom, click a region to inspect it.
 */
import { Suspense, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type * as THREE from "three";
import { useAppStore, type Quality } from "@/lib/store";
import { PlanetMesh, PLANET_RADIUS } from "./PlanetMesh";
import { Atmosphere } from "./Atmosphere";
import { Clouds } from "./Clouds";
import { EventMarkers } from "./EventMarkers";
import { RoutesLayer, type RouteData } from "./RoutesLayer";
import { latLonToVec3 } from "./geo";
import type { StateSummary } from "@/lib/api";

const QUALITY_PRESETS: Record<Quality, { segments: number; textureScale: number; dpr: number; effects: boolean }> = {
  saver: { segments: 56, textureScale: 2, dpr: 1, effects: false },
  medium: { segments: 96, textureScale: 3, dpr: 1.5, effects: true },
  high: { segments: 160, textureScale: 4, dpr: 2, effects: true },
  ultra: { segments: 224, textureScale: 6, dpr: 2, effects: true },
};

function CityPoints({ summary }: { summary: StateSummary | null }) {
  const grid = useAppStore((s) => s.grid);
  const positions = useMemo(() => {
    if (!grid || !summary) return new Float32Array();
    const out = new Float32Array(summary.cities.length * 3);
    summary.cities.forEach((city, i) => {
      const cell = grid.cells[city.cell];
      if (!cell) return;
      const [x, y, z] = latLonToVec3(cell.lat, cell.lon, PLANET_RADIUS * 1.008);
      out[i * 3] = x;
      out[i * 3 + 1] = y;
      out[i * 3 + 2] = z;
    });
    return out;
  }, [grid, summary]);

  if (positions.length === 0) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial color="#ffd682" size={0.014} sizeAttenuation transparent opacity={0.95} />
    </points>
  );
}

function RotatingWorld({ children }: { children: React.ReactNode }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.008;
  });
  return <group ref={groupRef}>{children}</group>;
}

export function PlanetCanvas({ summary }: { summary: StateSummary | null }) {
  const grid = useAppStore((s) => s.grid);
  const events = useAppStore((s) => s.events);
  const activeLayer = useAppStore((s) => s.activeLayer);
  const quality = useAppStore((s) => s.quality);
  const setSelectedCell = useAppStore((s) => s.setSelectedCell);
  const wizard = useAppStore((s) => s.wizard);
  const patchWizard = useAppStore((s) => s.patchWizard);

  const preset = QUALITY_PRESETS[quality];

  const warCivIds = useMemo(() => {
    const ids = new Set<string>();
    for (const war of summary?.activeWars ?? []) {
      ids.add(war.attackerCivId);
      ids.add(war.defenderCivId);
    }
    return ids;
  }, [summary]);

  const routes = useMemo<RouteData[]>(() => {
    if (!summary) return [];
    const out: RouteData[] = [];
    if (activeLayer === "trade" || activeLayer === "civilization") {
      for (const r of summary.tradeRoutes) out.push({ id: r.id, path: r.path, kind: "trade" });
    }
    if (activeLayer === "migration") {
      for (const m of summary.migrations) out.push({ id: m.id, path: m.path.length >= 2 ? m.path : [m.fromCell, m.toCell], kind: "migration" });
    }
    return out;
  }, [summary, activeLayer]);

  const luminescentCells = useMemo(() => summary?.luminescentCells ?? [], [summary]);

  if (!grid) {
    return null;
  }

  const handleSelectCell = (cell: number) => {
    if (wizard.pickingLocation) {
      patchWizard({ placementCell: cell, pickingLocation: false });
    }
    setSelectedCell(cell);
  };

  return (
    <Canvas
      dpr={Math.min(preset.dpr, typeof window !== "undefined" ? window.devicePixelRatio : 1)}
      camera={{ position: [0, 0.6, 2.6], fov: 42 }}
      gl={{ antialias: quality !== "saver", powerPreference: quality === "saver" ? "low-power" : "high-performance" }}
      style={{ background: "transparent" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[3, 1, 2]} intensity={1.6} />
        <Stars radius={60} depth={30} count={quality === "saver" ? 1200 : 3600} factor={3} fade speed={0.4} />
        <RotatingWorld>
          <PlanetMesh
            grid={grid}
            layer={activeLayer}
            cities={summary?.cities ?? []}
            luminescentCells={luminescentCells}
            warCivIds={warCivIds}
            segments={preset.segments}
            textureScale={preset.textureScale}
            onSelectCell={handleSelectCell}
          />
          {preset.effects && <Atmosphere segments={Math.floor(preset.segments / 2)} />}
          {preset.effects && <Clouds seed={grid.seed} segments={Math.floor(preset.segments / 2)} />}
          <CityPoints summary={summary} />
          <EventMarkers grid={grid} events={events} />
          {routes.length > 0 && <RoutesLayer grid={grid} routes={routes} />}
        </RotatingWorld>
        <OrbitControls
          enablePan={false}
          minDistance={1.35}
          maxDistance={6}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
        />
      </Suspense>
    </Canvas>
  );
}
