"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { WorldSnapshotView } from "@planet/shared-types";
import type { GridData } from "@/lib/useWorld";
import { Globe } from "./Globe";
import { Overlays } from "./Overlays";
import { useUiStore } from "@/lib/store";

export interface PlanetCanvasProps {
  grid: GridData;
  snapshot: WorldSnapshotView;
  onCellClick?: (cell: number) => void;
}

const QUALITY_PRESETS = {
  ultra: { segments: 128, dpr: 2, clouds: true, stars: 6000, relief: 0.10 },
  high: { segments: 96, dpr: 1.5, clouds: true, stars: 4000, relief: 0.09 },
  medium: { segments: 64, dpr: 1, clouds: true, stars: 2500, relief: 0.07 },
  power_saver: { segments: 40, dpr: 0.75, clouds: false, stars: 1200, relief: 0.05 },
} as const;

/** Night lights: cities glow where population lives (from engine data). */
function computeNightLights(grid: GridData, snapshot: WorldSnapshotView): Float32Array {
  const lights = new Float32Array(grid.width * grid.height);
  for (const city of snapshot.cities) {
    if (city.fallen) continue;
    const i = city.cell;
    if (i >= 0 && i < lights.length) {
      lights[i] = Math.min(1, (lights[i] ?? 0) + 0.3 + city.population / 20000);
    }
  }
  return lights;
}

export function PlanetCanvas({ grid, snapshot, onCellClick }: PlanetCanvasProps) {
  const { quality, activeLayers, selectedCell } = useUiStore();
  const preset = QUALITY_PRESETS[quality] ?? QUALITY_PRESETS.high;

  const layerMode = activeLayers.has("pollution" as never)
    ? 3
    : activeLayers.has("temperature" as never)
      ? 2
      : activeLayers.has("biome" as never)
        ? 1
        : 0;

  const nightLights = useMemo(() => computeNightLights(grid, snapshot), [grid, snapshot]);

  return (
    <Canvas
      dpr={preset.dpr}
      camera={{ position: [0, 0.6, 5.2], fov: 42 }}
      gl={{ antialias: quality !== "power_saver", powerPreference: "high-performance" }}
      style={{ background: "radial-gradient(ellipse at center, #08101f 0%, #030610 70%)" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.25} />
        <directionalLight position={[4, 1.5, 2.5]} intensity={1.1} />
        <Stars radius={80} depth={40} count={preset.stars} factor={3} saturation={0} fade speed={0.4} />
        <Globe
          grid={grid}
          segments={preset.segments}
          layerMode={layerMode}
          nightLights={nightLights}
          cloudsEnabled={preset.clouds && activeLayers.has("weather" as never)}
          relief={preset.relief}
          onCellClick={(cell) => onCellClick?.(cell)}
        />
        <Overlays
          grid={grid}
          snapshot={snapshot}
          showCities={activeLayers.has("civilization" as never)}
          showWars={activeLayers.has("conflict" as never)}
          showTrade={activeLayers.has("trade" as never)}
          showMigrations={activeLayers.has("migration" as never)}
          showResources={activeLayers.has("resource" as never)}
          selectedCell={selectedCell}
        />
        <OrbitControls enablePan={false} minDistance={2.8} maxDistance={12} enableDamping dampingFactor={0.08} />
      </Suspense>
    </Canvas>
  );
}
