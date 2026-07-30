"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import type { WorldEvent } from "@/lib/api";
import type { PlanetLocation, Quality } from "@/lib/store";
import { PlanetMesh } from "./PlanetMesh";

const dprByQuality: Record<Quality, [number, number]> = {
  ultra: [1.5, 2.25],
  high: [1, 1.75],
  medium: [0.85, 1.25],
  power_saver: [0.65, 1],
};

export default function PlanetScene({
  events = [],
  quality = "high",
  onPick,
}: {
  events?: WorldEvent[];
  quality?: Quality;
  onPick: (location: PlanetLocation) => void;
}) {
  return (
    <div className="planet-canvas" aria-label="Interactive procedural planet">
      <Canvas
        camera={{ position: [0, 0.35, 6.4], fov: 40 }}
        dpr={dprByQuality[quality]}
        gl={{ antialias: quality !== "power_saver", alpha: true }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.08} />
          <PlanetMesh events={events} quality={quality} onPick={onPick} />
          {quality !== "power_saver" && (
            <Stars
              radius={60}
              depth={30}
              count={quality === "ultra" ? 1800 : 900}
              factor={2}
              saturation={0.2}
              fade
              speed={0.15}
            />
          )}
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={3.6}
            maxDistance={10}
            rotateSpeed={0.45}
            zoomSpeed={0.65}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
