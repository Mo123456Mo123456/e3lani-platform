"use client";

import { Suspense, useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { CityDto, TradeRouteDto, WarDto, WorldEvent } from "@planet/shared-types";
import { usePlanetStore } from "@/lib/planet-store";
import { Planet } from "./Planet";
import { Overlays } from "./Overlays";

interface GlobeCanvasProps {
  planetId: string | null;
  seed: number;
  grid: { latBands: number; lonBands: number };
  overlaysData: {
    cities: CityDto[];
    tradeRoutes: TradeRouteDto[];
    wars: WarDto[];
    migrations: Array<{ fromCell: number; toCell: number; size: number; tick: number }>;
  } | null;
  liveEvents: WorldEvent[];
  eraTick?: number | null;
  rotating?: boolean;
  onFps?: (fps: number) => void;
}

const QUALITY_ORDER = ["ultra", "high", "medium", "saver"] as const;

/** Adaptive quality: when the FPS drops, step down automatically. */
function useAutoQuality(onFps?: (fps: number) => void) {
  const quality = usePlanetStore((s) => s.quality);
  const effective = usePlanetStore((s) => s.effectiveQuality);
  const setEffective = usePlanetStore((s) => s.setEffectiveQuality);
  const samples = useRef<number[]>([]);

  useEffect(() => {
    if (quality !== "auto") {
      setEffective(quality);
      return;
    }
    let raf = 0;
    let frames = 0;
    let last = performance.now();
    const loop = (now: number) => {
      frames++;
      if (now - last >= 1500) {
        const fps = (frames * 1000) / (now - last);
        onFps?.(fps);
        samples.current.push(fps);
        if (samples.current.length >= 3) {
          const avg = samples.current.reduce((a, b) => a + b, 0) / samples.current.length;
          samples.current = [];
          const idx = QUALITY_ORDER.indexOf(effective);
          if (avg < 28 && idx < QUALITY_ORDER.length - 1) {
            setEffective(QUALITY_ORDER[idx + 1] as (typeof QUALITY_ORDER)[number]);
          } else if (avg > 55 && idx > 0) {
            setEffective(QUALITY_ORDER[idx - 1] as (typeof QUALITY_ORDER)[number]);
          }
        }
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [quality, effective, setEffective, onFps]);
}

export function GlobeCanvas(props: GlobeCanvasProps) {
  const dpr = usePlanetStore((s) => (s.effectiveQuality === "saver" ? 1 : s.effectiveQuality === "medium" ? 1.5 : 2));
  useAutoQuality(props.onFps);

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.4, 3.1], fov: 42 }}
      gl={{ antialias: true, powerPreference: "high-performance" }}
      style={{ background: "radial-gradient(ellipse at center, #081228 0%, #03060f 70%)" }}
    >
      <Suspense fallback={null}>
        <ambientLight intensity={0.35} />
        <directionalLight position={[-3, 1, 2]} intensity={1.2} />
        <Stars radius={60} depth={30} count={2200} factor={3} fade speed={0.4} />
        <Planet
          planetId={props.planetId}
          seed={props.seed}
          grid={props.grid}
          eraTick={props.eraTick}
          rotating={props.rotating ?? true}
        />
        <Overlays data={props.overlaysData} liveEvents={props.liveEvents} grid={props.grid} />
        <OrbitControls
          enablePan={false}
          minDistance={1.5}
          maxDistance={7}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.55}
        />
      </Suspense>
    </Canvas>
  );
}
