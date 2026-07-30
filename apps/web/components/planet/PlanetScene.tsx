"use client";

import { memo, useEffect, useMemo, useRef } from "react";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { OrbitControls, QuadraticBezierLine, Stars } from "@react-three/drei";
import * as THREE from "three";
import type { RegionCell, WorldEvent } from "@living-planet/shared-types";
import { useWorldUi } from "@/lib/world-store";

const vertexShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  uniform float uSeed;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(.1, .2, .3) + uSeed);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }

  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }

  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec3(7.1, 3.4, 5.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 normalPosition = normalize(position);
    float terrain = fbm(normalPosition * 2.35 + uSeed);
    float ridge = abs(fbm(normalPosition * 7.0) - 0.5);
    float land = smoothstep(0.49, 0.57, terrain);
    float displacement = land * (terrain - 0.49) * 0.14 + ridge * land * 0.025;
    vec3 displaced = position + normal * displacement;
    vec4 world = modelMatrix * vec4(displaced, 1.0);
    vPositionW = world.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = `
  varying vec3 vNormalW;
  varying vec3 vPositionW;
  uniform float uTime;
  uniform float uSeed;
  uniform float uLayer;

  float hash(vec3 p) {
    p = fract(p * 0.3183099 + vec3(.1, .2, .3) + uSeed);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1,0,0)), f.x),
                   mix(hash(i + vec3(0,1,0)), hash(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash(i + vec3(0,0,1)), hash(i + vec3(1,0,1)), f.x),
                   mix(hash(i + vec3(0,1,1)), hash(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < 5; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + vec3(7.1, 3.4, 5.7);
      amplitude *= 0.5;
    }
    return value;
  }

  void main() {
    vec3 n = normalize(vNormalW);
    float continent = fbm(n * 2.35 + uSeed);
    float detail = fbm(n * 14.0);
    float latitude = abs(n.y);
    float landMask = smoothstep(0.50, 0.565, continent);
    float moisture = fbm(n * 4.8 + vec3(1.7, 8.2, 3.1));
    float temperature = (1.0 - latitude) * (0.82 + detail * 0.18);

    vec3 deepOcean = vec3(0.006, 0.075, 0.13);
    vec3 shallowOcean = vec3(0.02, 0.31, 0.42);
    vec3 ocean = mix(deepOcean, shallowOcean, smoothstep(0.38, 0.54, continent));
    ocean += vec3(0.0, 0.025, 0.04) * sin(uTime * 0.4 + detail * 18.0);

    vec3 desert = vec3(0.46, 0.32, 0.16);
    vec3 grass = vec3(0.06, 0.30, 0.16);
    vec3 forest = vec3(0.018, 0.18, 0.095);
    vec3 mountain = vec3(0.24, 0.25, 0.23);
    vec3 land = mix(desert, grass, smoothstep(0.28, 0.52, moisture));
    land = mix(land, forest, smoothstep(0.56, 0.76, moisture));
    land = mix(land, mountain, smoothstep(0.68, 0.82, continent + detail * 0.08));
    vec3 ice = vec3(0.72, 0.9, 0.95);
    land = mix(land, ice, smoothstep(0.77, 0.94, latitude + (1.0 - temperature) * 0.18));

    if (uLayer > 0.5 && uLayer < 1.5) {
      land = mix(vec3(0.56, 0.30, 0.09), vec3(0.05, 0.58, 0.26), moisture);
    } else if (uLayer > 1.5 && uLayer < 2.5) {
      land = mix(vec3(0.08, 0.28, 0.78), vec3(0.86, 0.18, 0.08), temperature);
      ocean = mix(vec3(0.05, 0.18, 0.5), vec3(0.12, 0.55, 0.7), temperature);
    } else if (uLayer > 2.5) {
      float pollution = fbm(n * 5.2 + vec3(9.0));
      land = mix(vec3(0.06, 0.42, 0.27), vec3(0.9, 0.21, 0.06), pollution);
    }

    vec3 base = mix(ocean, land, landMask);
    vec3 lightDirection = normalize(vec3(-0.8, 0.35, 0.65));
    float diffuse = max(dot(n, lightDirection), 0.0);
    float night = 1.0 - smoothstep(-0.18, 0.16, dot(n, lightDirection));
    float cityGrid = pow(hash(floor(n * 92.0)), 24.0) * landMask * night;
    vec3 cityLights = vec3(1.0, 0.48, 0.06) * cityGrid * 3.4;
    float fresnel = pow(1.0 - max(dot(n, normalize(cameraPosition - vPositionW)), 0.0), 3.0);
    vec3 color = base * (0.12 + diffuse * 0.98) + cityLights + vec3(0.0, 0.35, 0.55) * fresnel * 0.25;
    gl_FragColor = vec4(color, 1.0);
  }
`;

const cloudVertex = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragment = `
  varying vec3 vNormal;
  uniform float uTime;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  float noise(vec3 p) {
    vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),
               mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);
  }
  void main() {
    vec3 p = vNormal * 7.0 + vec3(uTime * 0.025, 0.0, uTime * 0.012);
    float clouds = noise(p) * 0.65 + noise(p * 2.1) * 0.35;
    float alpha = smoothstep(0.56, 0.76, clouds) * 0.42;
    gl_FragColor = vec4(vec3(0.78, 0.92, 1.0), alpha);
  }
`;

function latLngToVector(latitude: number, longitude: number, radius = 2.26): THREE.Vector3 {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

const layerValue = {
  surface: 0,
  biome: 1,
  temperature: 2,
  pollution: 3,
  weather: 0,
  civilization: 0,
  resource: 0,
  conflict: 0,
  migration: 0,
  trade: 0,
} as const;

function Planet({
  regions,
  seed,
  detail,
}: {
  regions: RegionCell[];
  seed: string;
  detail: number;
}) {
  const surface = useRef<THREE.ShaderMaterial>(null);
  const clouds = useRef<THREE.ShaderMaterial>(null);
  const cloudMesh = useRef<THREE.Mesh>(null);
  const group = useRef<THREE.Group>(null);
  const selectRegion = useWorldUi((state) => state.selectRegion);
  const activeLayer = useWorldUi((state) => state.activeLayer);
  const seedNumber = useMemo(
    () => [...seed].reduce((sum, character) => sum + character.charCodeAt(0), 0) / 997,
    [seed],
  );

  useFrame(({ clock }, delta) => {
    if (surface.current) {
      surface.current.uniforms.uTime!.value = clock.elapsedTime;
      surface.current.uniforms.uLayer!.value = layerValue[activeLayer];
    }
    if (clouds.current) clouds.current.uniforms.uTime!.value = clock.elapsedTime;
    if (cloudMesh.current) cloudMesh.current.rotation.y += delta * 0.011;
    if (group.current) group.current.rotation.y += delta * 0.008;
  });

  const onSelect = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const point = event.point.clone().normalize();
    let closest = regions[0];
    let closestDistance = Number.POSITIVE_INFINITY;
    for (const region of regions) {
      const candidate = latLngToVector(region.latitude, region.longitude, 1).normalize();
      const distance = candidate.distanceToSquared(point);
      if (distance < closestDistance) {
        closest = region;
        closestDistance = distance;
      }
    }
    selectRegion(closest?.id);
  };

  return (
    <group ref={group}>
      <mesh onPointerDown={onSelect}>
        <icosahedronGeometry args={[2.2, detail]} />
        <shaderMaterial
          ref={surface}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={{
            uTime: { value: 0 },
            uSeed: { value: seedNumber },
            uLayer: { value: layerValue[activeLayer] },
          }}
        />
      </mesh>
      <mesh ref={cloudMesh}>
        <icosahedronGeometry args={[2.235, Math.max(2, detail - 1)]} />
        <shaderMaterial
          ref={clouds}
          vertexShader={cloudVertex}
          fragmentShader={cloudFragment}
          uniforms={{ uTime: { value: 0 } }}
          transparent
          depthWrite={false}
        />
      </mesh>
      <mesh scale={1.06}>
        <sphereGeometry args={[2.2, 64, 64]} />
        <meshBasicMaterial
          color="#30d9ff"
          transparent
          opacity={0.085}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}

function RegionMarkers({ regions }: { regions: RegionCell[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const selectedRegionId = useWorldUi((state) => state.selectedRegionId);
  const selectRegion = useWorldUi((state) => state.selectRegion);
  const activeLayer = useWorldUi((state) => state.activeLayer);

  useEffect(() => {
    if (!mesh.current) return;
    const object = new THREE.Object3D();
    const color = new THREE.Color();
    regions.forEach((region, index) => {
      object.position.copy(latLngToVector(region.latitude, region.longitude));
      object.lookAt(0, 0, 0);
      const selected = selectedRegionId === region.id;
      const visible =
        selected ||
        (activeLayer === "civilization" && Boolean(region.ownerCivilizationId)) ||
        (activeLayer === "resource" && region.resourceRichness > 0.72) ||
        (activeLayer === "pollution" && region.pollution > 0.03);
      object.scale.setScalar(selected ? 2.8 : visible ? 1 : 0.26);
      object.updateMatrix();
      mesh.current!.setMatrixAt(index, object.matrix);
      if (selected) color.set("#6ff7ff");
      else if (region.ownerCivilizationId) color.set("#e8b84d");
      else color.set("#37d8a4");
      mesh.current!.setColorAt(index, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [activeLayer, regions, selectedRegionId]);

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, regions.length]}
      onPointerDown={(event) => {
        event.stopPropagation();
        if (event.instanceId !== undefined) selectRegion(regions[event.instanceId]?.id);
      }}
    >
      <sphereGeometry args={[0.018, 8, 8]} />
      <meshBasicMaterial toneMapped={false} />
    </instancedMesh>
  );
}

function EventArcs({ events, regions }: { events: WorldEvent[]; regions: RegionCell[] }) {
  const arcs = events
    .filter((event) => event.regionId)
    .slice(0, 7)
    .map((event, index) => {
      const region = regions.find((candidate) => candidate.id === event.regionId);
      if (!region) return null;
      const start = latLngToVector(region.latitude, region.longitude, 2.27);
      const destination = regions[(region.index + 29 + index * 17) % regions.length]!;
      const end = latLngToVector(destination.latitude, destination.longitude, 2.27);
      const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(2.75);
      const color =
        event.type === "WAR_STARTED"
          ? "#ff4d44"
          : event.type === "MIGRATION_STARTED"
            ? "#ad70ff"
            : "#2cd9ed";
      return (
        <QuadraticBezierLine
          key={event.id}
          start={start}
          end={end}
          mid={mid}
          color={color}
          lineWidth={0.7}
          transparent
          opacity={0.55}
        />
      );
    });
  return <group>{arcs}</group>;
}

interface PlanetSceneProps {
  regions: RegionCell[];
  events: WorldEvent[];
  seed: string;
}

export const PlanetScene = memo(function PlanetScene({
  regions,
  events,
  seed,
}: PlanetSceneProps) {
  const quality = useWorldUi((state) => state.quality);
  const detail = quality === "ultra" ? 6 : quality === "high" ? 5 : quality === "medium" ? 4 : 3;
  const dpr: [number, number] =
    quality === "ultra" ? [1.5, 2] : quality === "eco" ? [0.7, 1] : [1, 1.5];

  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.15, 6.4], fov: 42, near: 0.1, far: 100 }}
      gl={{
        antialias: quality !== "eco",
        powerPreference: quality === "eco" ? "low-power" : "high-performance",
        alpha: true,
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.15;
      }}
    >
      <ambientLight intensity={0.15} />
      <directionalLight position={[-5, 3, 4]} intensity={2.3} color="#c5f5ff" />
      <Stars radius={38} depth={22} count={quality === "eco" ? 850 : 2200} factor={2} fade />
      <Planet regions={regions} seed={seed} detail={detail} />
      <RegionMarkers regions={regions} />
      {quality !== "eco" && <EventArcs events={events} regions={regions} />}
      <OrbitControls
        enablePan={false}
        minDistance={3.2}
        maxDistance={9}
        rotateSpeed={0.42}
        zoomSpeed={0.65}
        dampingFactor={0.05}
        enableDamping
      />
    </Canvas>
  );
});
