"use client";

import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense } from "react";
import { usePlanetStore } from "@/lib/planet-store";
import { QUALITY_PRESETS } from "@/lib/quality";
import { PlanetSphere } from "./PlanetSphere";
import { PlanetAtmosphere } from "./PlanetAtmosphere";
import { CloudLayer } from "./CloudLayer";
import { EventNodes } from "./EventNodes";
import { RegionMarkers } from "./RegionMarkers";

export function PlanetCanvas() {
  const quality = usePlanetStore((s) => s.quality);
  const preset = QUALITY_PRESETS[quality];
  const seed = usePlanetStore((s) => s.planetSeed);

  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ position: [0, 0.4, 3.2], fov: 42 }}
        dpr={[1, preset.pixelRatio]}
        gl={{ antialias: quality !== "low", alpha: true }}
        onCreated={({ gl }) => {
          gl.setClearColor(0x000000, 0);
        }}
      >
        <ambientLight intensity={0.35} />
        <directionalLight position={[5, 2, 3]} intensity={1.35} color="#fff5e6" />
        <directionalLight position={[-4, -1, -2]} intensity={0.25} color="#22d3ee" />
        <Stars radius={80} depth={40} count={quality === "low" ? 800 : 2500} factor={3} fade speed={0.4} />
        <Suspense fallback={null}>
          <group>
            <PlanetSphere seed={seed} segments={preset.sphereSegments} cityLights={preset.cityLights} />
            {preset.atmosphere && <PlanetAtmosphere />}
            {preset.clouds && <CloudLayer />}
            <EventNodes max={preset.eventNodes} />
            <RegionMarkers />
          </group>
        </Suspense>
        <OrbitControls
          enablePan={false}
          minDistance={1.8}
          maxDistance={6}
          autoRotate
          autoRotateSpeed={0.35}
          rotateSpeed={0.55}
        />
      </Canvas>
    </div>
  );
}
