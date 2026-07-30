"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DataTexture,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
} from "three";
import type { PlanetRegion, WorldEvent } from "@planet/shared-types";
import { useUiStore } from "@/lib/store";

const biomeCodes = [
  "ocean",
  "coast",
  "plains",
  "rainforest",
  "temperate_forest",
  "desert",
  "mountain",
  "tundra",
  "wetland",
  "steppe",
  "volcanic",
  "ice",
] as const;

const vertexShader = `
  uniform sampler2D uWorld;
  uniform float uDisplacement;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec4 vWorld;
  void main() {
    vUv = uv;
    vWorld = texture2D(uWorld, uv);
    float elevation = vWorld.r;
    vec3 displaced = position + normal * max(0.0, elevation - 0.42) * uDisplacement;
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vPositionWorld = worldPosition.xyz;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  uniform float uTime;
  uniform vec3 uLight;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  varying vec3 vPositionWorld;
  varying vec4 vWorld;

  vec3 biomeColor(float code, float moisture, float temperature) {
    if (code < 1.5) return vec3(0.005, 0.11, 0.19);
    if (code < 2.5) return vec3(0.05, 0.40, 0.43);
    if (code < 3.5) return vec3(0.26, 0.48, 0.18);
    if (code < 4.5) return vec3(0.025, 0.30, 0.12);
    if (code < 5.5) return vec3(0.08, 0.36, 0.17);
    if (code < 6.5) return vec3(0.62, 0.45, 0.19);
    if (code < 7.5) return vec3(0.24, 0.25, 0.24);
    if (code < 8.5) return vec3(0.45, 0.55, 0.50);
    if (code < 9.5) return vec3(0.07, 0.32, 0.22);
    if (code < 10.5) return vec3(0.38, 0.39, 0.18);
    if (code < 11.5) return vec3(0.27, 0.10, 0.035);
    return vec3(0.75, 0.88, 0.92);
  }

  void main() {
    float biome = floor(vWorld.a * 255.0 + 0.5);
    vec3 base = biomeColor(biome, vWorld.g, vWorld.b);
    float sunlight = max(0.0, dot(normalize(vNormalWorld), normalize(uLight)));
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormalWorld), normalize(cameraPosition - vPositionWorld))), 3.0);
    float oceanWave = biome < 1.5 ? sin(vUv.x * 170.0 + vUv.y * 90.0 + uTime * 0.55) * 0.018 : 0.0;
    vec3 lit = base * (0.18 + sunlight * 0.94) + vec3(0.0, 0.18, 0.30) * rim + oceanWave;
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const cloudVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  void main() {
    vUv = uv;
    vNormalWorld = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  varying vec3 vNormalWorld;
  float pattern(vec2 p) {
    float a = sin(p.x * 31.0 + sin(p.y * 17.0) + uTime * 0.035);
    float b = sin(p.y * 43.0 - p.x * 9.0 + uTime * 0.022);
    float c = sin((p.x + p.y) * 67.0 - uTime * 0.018);
    return (a + b + c) / 3.0;
  }
  void main() {
    float bands = smoothstep(0.18, 0.62, pattern(vUv) + 0.28);
    float polarFade = smoothstep(0.02, 0.15, vUv.y) * smoothstep(0.98, 0.85, vUv.y);
    gl_FragColor = vec4(0.72, 0.88, 0.94, bands * polarFade * 0.28);
  }
`;

function positionOnSphere(latitude: number, longitude: number, radius: number): Vector3 {
  const phi = ((90 - latitude) * Math.PI) / 180;
  const theta = ((longitude + 180) * Math.PI) / 180;
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function buildWorldTexture(regions: PlanetRegion[]): {
  texture: DataTexture;
  width: number;
  height: number;
} {
  const width = Math.round(Math.sqrt(regions.length * 2));
  const height = Math.ceil(regions.length / width);
  const pixels = new Uint8Array(width * height * 4);
  for (const region of regions) {
    const offset = region.index * 4;
    pixels[offset] = Math.round(region.elevation * 255);
    pixels[offset + 1] = Math.round(region.moisture * 255);
    pixels[offset + 2] = Math.round(region.temperature * 255);
    pixels[offset + 3] = biomeCodes.indexOf(region.biome) + 1;
  }
  const texture = new DataTexture(pixels, width, height, RGBAFormat, UnsignedByteType);
  texture.minFilter = NearestFilter;
  texture.magFilter = NearestFilter;
  texture.colorSpace = SRGBColorSpace;
  texture.needsUpdate = true;
  return { texture, width, height };
}

function Planet({
  regions,
  eventRegions,
}: {
  regions: PlanetRegion[];
  eventRegions: PlanetRegion[];
}) {
  const material = useRef<ShaderMaterial>(null);
  const clouds = useRef<ShaderMaterial>(null);
  const selectRegion = useUiStore((state) => state.selectRegion);
  const quality = useUiStore((state) => state.quality);
  const world = useMemo(() => buildWorldTexture(regions), [regions]);
  const segments = quality === "ultra" ? 192 : quality === "high" ? 144 : quality === "medium" ? 96 : 64;

  useFrame((_state, delta) => {
    if (material.current) material.current.uniforms.uTime!.value += delta;
    if (clouds.current) clouds.current.uniforms.uTime!.value += delta;
  });

  const handleSelect = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (!event.uv) return;
    const x = Math.min(world.width - 1, Math.floor(event.uv.x * world.width));
    const y = Math.min(world.height - 1, Math.floor((1 - event.uv.y) * world.height));
    const region = regions[y * world.width + x];
    if (region) selectRegion(region);
  };

  return (
    <group rotation={[0.04, -0.42, 0]}>
      <mesh onPointerDown={handleSelect}>
        <sphereGeometry args={[3.1, segments, Math.floor(segments / 2)]} />
        <shaderMaterial
          ref={material}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uWorld: { value: world.texture },
            uDisplacement: { value: quality === "eco" ? 0.08 : 0.18 },
            uTime: { value: 0 },
            uLight: { value: new Vector3(4, 2, 5) },
          }}
        />
      </mesh>
      {quality !== "eco" && (
        <mesh>
          <sphereGeometry args={[3.17, Math.min(segments, 128), Math.min(segments / 2, 64)]} />
          <shaderMaterial
            ref={clouds}
            vertexShader={cloudVertexShader}
            fragmentShader={cloudFragmentShader}
            transparent
            depthWrite={false}
            uniforms={{ uTime: { value: 0 } }}
          />
        </mesh>
      )}
      <mesh>
        <sphereGeometry args={[3.28, 96, 48]} />
        <meshBasicMaterial
          color={new Color("#35d9ff")}
          side={BackSide}
          transparent
          opacity={0.08}
          blending={AdditiveBlending}
        />
      </mesh>
      {eventRegions.slice(0, quality === "eco" ? 8 : 24).map((region, index) => (
        <mesh
          key={`${region.id}:${index}`}
          position={positionOnSphere(region.latitude, region.longitude, 3.24)}
        >
          <sphereGeometry args={[0.026 + (index % 3) * 0.008, 8, 8]} />
          <meshBasicMaterial
            color={index % 4 === 0 ? "#ff5b3d" : "#55e6ff"}
            blending={AdditiveBlending}
          />
        </mesh>
      ))}
    </group>
  );
}

export function PlanetScene({
  regions,
  events,
}: {
  regions: PlanetRegion[];
  events: WorldEvent[];
}) {
  const eventRegions = useMemo(
    () =>
      events
        .map((event) => regions.find((region) => region.id === event.regionId))
        .filter((region): region is PlanetRegion => Boolean(region)),
    [events, regions],
  );
  const quality = useUiStore((state) => state.quality);
  return (
    <Canvas
      camera={{ position: [0, 0.15, 8.3], fov: 43 }}
      dpr={quality === "ultra" ? [1, 2] : quality === "eco" ? 1 : [1, 1.5]}
      gl={{ antialias: quality !== "eco", alpha: true, powerPreference: quality === "eco" ? "low-power" : "high-performance" }}
      fallback={<div className="webgl-fallback">WebGL2 غير متاح على هذا الجهاز</div>}
    >
      <color attach="background" args={["#010810"]} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[5, 3, 4]} intensity={2.2} color="#dff7ff" />
      <Suspense fallback={null}>
        <Planet regions={regions} eventRegions={eventRegions} />
      </Suspense>
      {quality !== "eco" && <Stars radius={90} depth={40} count={quality === "ultra" ? 2800 : 1400} factor={2.2} fade speed={0.15} />}
      <OrbitControls
        enablePan={false}
        minDistance={5}
        maxDistance={11}
        autoRotate
        autoRotateSpeed={0.25}
        dampingFactor={0.055}
        enableDamping
      />
    </Canvas>
  );
}
