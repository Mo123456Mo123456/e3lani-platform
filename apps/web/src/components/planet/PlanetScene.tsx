"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import { useWorldUi } from "@/stores/world-ui";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uSeed;
  uniform vec3 uOcean;
  uniform vec3 uLand;
  uniform vec3 uDesert;
  uniform vec3 uIce;
  uniform vec3 uForest;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.1, 0.2, uSeed * 0.00001));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
          mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
      mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
          mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y),
      f.z
    );
  }

  float fbm(vec3 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 5; i++) {
      v += a * noise(p);
      p *= 2.0;
      a *= 0.5;
    }
    return v;
  }

  void main() {
    vec3 nrm = normalize(vPosition);
    float elev = fbm(nrm * 3.0 + uSeed * 0.0001);
    float moist = fbm(nrm * 4.2 + 12.0);
    float lat = abs(nrm.y);
    vec3 col = uOcean;
    if (elev > 0.48) {
      col = mix(uLand, uForest, smoothstep(0.45, 0.7, moist));
      col = mix(col, uDesert, smoothstep(0.55, 0.2, moist) * (1.0 - lat));
    }
    if (lat > 0.78 || elev > 0.78) col = mix(col, uIce, 0.85);
    float night = pow(max(0.0, -dot(nrm, normalize(vec3(0.8, 0.2, 0.5)))), 1.5);
    float cities = step(0.82, noise(nrm * 40.0)) * night * step(0.5, elev);
    col += vec3(1.0, 0.85, 0.45) * cities * 0.55;
    float fresnel = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.5);
    col += vec3(0.25, 0.55, 0.9) * fresnel * 0.35;
    float clouds = smoothstep(0.55, 0.8, fbm(nrm * 5.0 + vec3(uTime * 0.02, 0.0, uTime * 0.01)));
    col = mix(col, vec3(0.92, 0.95, 1.0), clouds * 0.28 * (1.0 - lat * 0.3));
    gl_FragColor = vec4(col, 1.0);
  }
`;

function PlanetMesh({
  markers,
  onSelect,
}: {
  markers: Array<{ id: string; lat: number; lng: number; color: string; label: string }>;
  onSelect: (id: string) => void;
}) {
  const mesh = useRef<THREE.Mesh>(null);
  const clouds = useRef<THREE.Mesh>(null);
  const quality = useWorldUi((s) => s.quality);
  const playing = useWorldUi((s) => s.playing);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSeed: { value: 42424242 },
      uOcean: { value: new THREE.Color("#0b3d5c") },
      uLand: { value: new THREE.Color("#3f6b3a") },
      uDesert: { value: new THREE.Color("#c2a36b") },
      uIce: { value: new THREE.Color("#e8f2ff") },
      uForest: { value: new THREE.Color("#1f6b3a") },
    }),
    [],
  );

  useFrame((_, dt) => {
    uniforms.uTime.value += dt;
    if (!playing) return;
    if (mesh.current) mesh.current.rotation.y += dt * 0.05;
    if (clouds.current) clouds.current.rotation.y += dt * 0.07;
  });

  const segs = quality === "ultra" ? 128 : quality === "high" ? 96 : quality === "medium" ? 64 : 48;

  return (
    <group>
      <mesh ref={mesh}>
        <sphereGeometry args={[2, segs, segs]} />
        <shaderMaterial
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={uniforms}
        />
      </mesh>
      <mesh ref={clouds} scale={1.02}>
        <sphereGeometry args={[2, Math.max(32, segs / 2), Math.max(32, segs / 2)]} />
        <meshPhongMaterial
          color="#dbeafe"
          transparent
          opacity={quality === "battery" ? 0.08 : 0.15}
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.08}>
        <sphereGeometry args={[2, 48, 48]} />
        <meshBasicMaterial
          color="#38bdf8"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>
      {markers.map((m) => {
        const phi = (90 - m.lat) * (Math.PI / 180);
        const theta = (m.lng + 180) * (Math.PI / 180);
        const r = 2.08;
        const x = -r * Math.sin(phi) * Math.cos(theta);
        const z = r * Math.sin(phi) * Math.sin(theta);
        const y = r * Math.cos(phi);
        return (
          <mesh
            key={m.id}
            position={[x, y, z]}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(m.id);
            }}
          >
            <sphereGeometry args={[0.035, 12, 12]} />
            <meshBasicMaterial color={m.color} />
          </mesh>
        );
      })}
    </group>
  );
}

export function PlanetScene({
  markers,
  onSelectRegion,
}: {
  markers: Array<{ id: string; lat: number; lng: number; color: string; label: string }>;
  onSelectRegion: (id: string) => void;
}) {
  const quality = useWorldUi((s) => s.quality);
  const dpr = quality === "ultra" ? 2 : quality === "high" ? 1.5 : 1;

  return (
    <Canvas
      camera={{ position: [0, 0.6, 5.2], fov: 42 }}
      dpr={dpr}
      gl={{ antialias: quality !== "battery", powerPreference: "high-performance" }}
      style={{ width: "100%", height: "100%" }}
    >
      <color attach="background" args={["#050b16"]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[5, 2, 3]} intensity={1.4} />
      <Suspense fallback={null}>
        <Stars radius={80} depth={40} count={quality === "battery" ? 400 : 1800} factor={3} fade />
        <PlanetMesh markers={markers} onSelect={onSelectRegion} />
      </Suspense>
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={9}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
      />
    </Canvas>
  );
}
