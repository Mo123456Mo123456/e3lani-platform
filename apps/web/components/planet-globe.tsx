"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import { Suspense, useEffect, useMemo, useRef } from "react";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DataTexture,
  FloatType,
  InstancedMesh,
  Matrix4,
  Mesh,
  NearestFilter,
  RGBAFormat,
  ShaderMaterial,
  Vector3,
} from "three";
import type { RegionSummary, WorldEvent } from "@living-planet/shared-types";
import type { GlobeLayer, GraphicsQuality } from "@/lib/store";

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPosition;
  uniform sampler2D uWorldData;
  uniform float uTime;

  void main() {
    vUv = uv;
    vec4 world = texture2D(uWorldData, uv);
    float elevation = world.r;
    float displacement = elevation < 0.42 ? -0.018 : (elevation - 0.42) * 0.12;
    vec3 displaced = position + normal * displacement;
    vec4 worldPosition = modelMatrix * vec4(displaced, 1.0);
    vWorldPosition = worldPosition.xyz;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const fragmentShader = `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vWorldPosition;
  uniform sampler2D uWorldData;
  uniform float uTime;
  uniform int uLayer;
  uniform vec3 uSunDirection;

  vec3 gradient(float value, vec3 lowColor, vec3 highColor) {
    return mix(lowColor, highColor, clamp(value, 0.0, 1.0));
  }

  void main() {
    vec4 data = texture2D(uWorldData, vUv);
    float elevation = data.r;
    float moisture = data.g;
    float temperature = data.b;
    float pollution = data.a;
    vec3 color;

    if (uLayer == 2) {
      color = gradient(moisture, vec3(0.30, 0.17, 0.06), vec3(0.10, 0.68, 0.88));
    } else if (uLayer == 6) {
      color = gradient(pollution * 4.0, vec3(0.05, 0.38, 0.28), vec3(0.92, 0.16, 0.08));
    } else if (uLayer == 7) {
      color = temperature < 0.5
        ? mix(vec3(0.20, 0.58, 0.96), vec3(0.95, 0.90, 0.48), temperature * 2.0)
        : mix(vec3(0.95, 0.90, 0.48), vec3(0.92, 0.12, 0.04), (temperature - 0.5) * 2.0);
    } else if (elevation < 0.42) {
      float oceanDepth = smoothstep(0.0, 0.42, elevation);
      float shimmer = sin(vUv.x * 180.0 + uTime) * sin(vUv.y * 130.0 - uTime * 0.7) * 0.018;
      color = mix(vec3(0.005, 0.055, 0.13), vec3(0.02, 0.30, 0.50), oceanDepth) + shimmer;
    } else if (temperature < 0.11) {
      color = vec3(0.78, 0.91, 0.98);
    } else if (elevation > 0.78) {
      color = mix(vec3(0.18, 0.15, 0.13), vec3(0.72, 0.73, 0.68), elevation);
    } else if (moisture < 0.22 && temperature > 0.48) {
      color = mix(vec3(0.45, 0.24, 0.07), vec3(0.86, 0.62, 0.23), temperature);
    } else {
      color = mix(vec3(0.20, 0.38, 0.10), vec3(0.02, 0.24, 0.12), moisture);
    }

    float daylight = max(0.06, dot(normalize(vNormalW), normalize(uSunDirection)) * 0.76 + 0.24);
    float rim = pow(1.0 - max(0.0, dot(normalize(vNormalW), normalize(cameraPosition - vWorldPosition))), 3.0);
    gl_FragColor = vec4(color * daylight + vec3(0.02, 0.18, 0.24) * rim, 1.0);
  }
`;

const cloudVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const cloudFragmentShader = `
  varying vec2 vUv;
  varying vec3 vNormalW;
  uniform sampler2D uWorldData;
  uniform float uTime;
  void main() {
    vec2 movingUv = vec2(fract(vUv.x + uTime * 0.0018), vUv.y);
    float moisture = texture2D(uWorldData, movingUv).g;
    float bands = sin(movingUv.x * 95.0 + sin(movingUv.y * 51.0) * 4.0 + uTime * 0.05);
    float cloud = smoothstep(0.38, 0.76, moisture + bands * 0.16);
    float light = max(0.25, dot(vNormalW, normalize(vec3(1.0, 0.25, 0.6))));
    gl_FragColor = vec4(vec3(0.72, 0.88, 0.96) * light, cloud * 0.34);
  }
`;

const layerCodes: Record<GlobeLayer, number> = {
  surface: 0,
  biome: 1,
  weather: 2,
  civilization: 3,
  resource: 4,
  conflict: 5,
  pollution: 6,
  temperature: 7,
};

function sphericalPosition(latitude: number, longitude: number, radius: number): Vector3 {
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(latitudeRadians) * Math.cos(longitudeRadians),
    radius * Math.sin(latitudeRadians),
    radius * Math.cos(latitudeRadians) * Math.sin(longitudeRadians),
  );
}

function regionDistance(region: RegionSummary, latitude: number, longitude: number): number {
  const latitudeDistance = region.latitude - latitude;
  const rawLongitude = Math.abs(region.longitude - longitude);
  const longitudeDistance = Math.min(rawLongitude, 360 - rawLongitude);
  return latitudeDistance ** 2 + longitudeDistance ** 2;
}

function WorldMarkers({
  regions,
  events,
  onSelect,
}: {
  regions: RegionSummary[];
  events: WorldEvent[];
  onSelect(region: RegionSummary): void;
}) {
  const cityRegions = useMemo(
    () => regions.filter((region) => region.population > 65_000).slice(0, 180),
    [regions],
  );
  const cityRef = useRef<InstancedMesh>(null);
  const eventRef = useRef<InstancedMesh>(null);
  const importantEvents = useMemo(() => events.filter((event) => event.importance >= 0.55).slice(0, 40), [events]);

  useEffect(() => {
    const cityMesh = cityRef.current;
    if (!cityMesh) return;
    const matrix = new Matrix4();
    cityRegions.forEach((region, index) => {
      const scale = 0.008 + Math.min(0.018, region.population / 8_000_000);
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(sphericalPosition(region.latitude, region.longitude, 1.025));
      cityMesh.setMatrixAt(index, matrix);
      cityMesh.setColorAt(index, new Color("#f6c65b"));
    });
    cityMesh.instanceMatrix.needsUpdate = true;
    if (cityMesh.instanceColor) cityMesh.instanceColor.needsUpdate = true;
  }, [cityRegions]);

  useEffect(() => {
    const eventMesh = eventRef.current;
    if (!eventMesh) return;
    const matrix = new Matrix4();
    importantEvents.forEach((event, index) => {
      const scale = 0.018 + event.importance * 0.014;
      matrix.makeScale(scale, scale, scale);
      matrix.setPosition(sphericalPosition(event.coordinates.latitude, event.coordinates.longitude, 1.055));
      eventMesh.setMatrixAt(index, matrix);
      const danger = ["WAR_STARTED", "VOLCANO_ERUPTED", "DISEASE_OUTBREAK"].includes(event.type);
      eventMesh.setColorAt(index, new Color(danger ? "#ff513b" : "#32d9ff"));
    });
    eventMesh.instanceMatrix.needsUpdate = true;
    if (eventMesh.instanceColor) eventMesh.instanceColor.needsUpdate = true;
  }, [importantEvents]);

  return (
    <>
      <instancedMesh
        ref={cityRef}
        args={[undefined, undefined, cityRegions.length]}
        onClick={(event) => {
          event.stopPropagation();
          const selected = event.instanceId === undefined ? undefined : cityRegions[event.instanceId];
          if (selected) onSelect(selected);
        }}
      >
        <sphereGeometry args={[1, 8, 8]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
      <instancedMesh ref={eventRef} args={[undefined, undefined, importantEvents.length]}>
        <octahedronGeometry args={[1, 0]} />
        <meshBasicMaterial vertexColors toneMapped={false} />
      </instancedMesh>
    </>
  );
}

function Planet({
  regions,
  events,
  layer,
  quality,
  onSelect,
}: {
  regions: RegionSummary[];
  events: WorldEvent[];
  layer: GlobeLayer;
  quality: GraphicsQuality;
  onSelect(region: RegionSummary): void;
}) {
  const surfaceRef = useRef<Mesh>(null);
  const surfaceMaterialRef = useRef<ShaderMaterial>(null);
  const cloudMaterialRef = useRef<ShaderMaterial>(null);
  const segments = { ultra: 192, high: 128, medium: 80, eco: 56 }[quality];

  const worldTexture = useMemo(() => {
    const sorted = [...regions].sort((left, right) => left.id.localeCompare(right.id));
    const columns = 24;
    const rows = Math.max(1, Math.ceil(sorted.length / columns));
    const pixels = new Float32Array(columns * rows * 4);
    sorted.forEach((region, index) => {
      pixels[index * 4] = region.elevation;
      pixels[index * 4 + 1] = region.moisture;
      pixels[index * 4 + 2] = region.temperature;
      pixels[index * 4 + 3] = region.pollution;
    });
    const texture = new DataTexture(pixels, columns, rows, RGBAFormat, FloatType);
    texture.minFilter = NearestFilter;
    texture.magFilter = NearestFilter;
    texture.needsUpdate = true;
    return texture;
  }, [regions]);

  useEffect(() => () => worldTexture.dispose(), [worldTexture]);

  const surfaceUniforms = useMemo(() => ({
    uWorldData: { value: worldTexture },
    uTime: { value: 0 },
    uLayer: { value: layerCodes[layer] },
    uSunDirection: { value: new Vector3(1, 0.25, 0.6) },
  }), [worldTexture, layer]);
  const cloudUniforms = useMemo(() => ({
    uWorldData: { value: worldTexture },
    uTime: { value: 0 },
  }), [worldTexture]);

  useEffect(() => {
    if (surfaceMaterialRef.current) surfaceMaterialRef.current.uniforms.uLayer!.value = layerCodes[layer];
  }, [layer]);

  useFrame(({ clock }) => {
    if (surfaceMaterialRef.current) surfaceMaterialRef.current.uniforms.uTime!.value = clock.elapsedTime;
    if (cloudMaterialRef.current) cloudMaterialRef.current.uniforms.uTime!.value = clock.elapsedTime;
  });

  const handleSurfaceClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (!surfaceRef.current) return;
    const local = surfaceRef.current.worldToLocal(event.point.clone()).normalize();
    const latitude = Math.asin(local.y) * 180 / Math.PI;
    const longitude = Math.atan2(local.z, local.x) * 180 / Math.PI;
    const nearest = regions.reduce((best, region) =>
      regionDistance(region, latitude, longitude) < regionDistance(best, latitude, longitude) ? region : best,
    );
    onSelect(nearest);
  };

  return (
    <group>
      <mesh ref={surfaceRef} onClick={handleSurfaceClick}>
        <sphereGeometry args={[1, segments, Math.floor(segments / 2)]} />
        <shaderMaterial
          ref={surfaceMaterialRef}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          uniforms={surfaceUniforms}
        />
      </mesh>
      {quality !== "eco" && (
        <mesh scale={1.022}>
          <sphereGeometry args={[1, Math.max(48, segments / 2), Math.max(24, segments / 4)]} />
          <shaderMaterial
            ref={cloudMaterialRef}
            vertexShader={cloudVertexShader}
            fragmentShader={cloudFragmentShader}
            uniforms={cloudUniforms}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}
      <mesh scale={1.08}>
        <sphereGeometry args={[1, 64, 32]} />
        <meshBasicMaterial
          color="#27bfe9"
          transparent
          opacity={0.09}
          side={BackSide}
          blending={AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
      <WorldMarkers regions={regions} events={events} onSelect={onSelect} />
    </group>
  );
}

export function PlanetGlobe(props: {
  regions: RegionSummary[];
  events: WorldEvent[];
  layer: GlobeLayer;
  quality: GraphicsQuality;
  onSelect(region: RegionSummary): void;
}) {
  const dpr: [number, number] = props.quality === "ultra" ? [1, 2] : props.quality === "eco" ? [0.7, 1] : [1, 1.5];
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.15, 2.65], fov: 39, near: 0.1, far: 100 }}
      gl={{ antialias: props.quality !== "eco", powerPreference: props.quality === "eco" ? "low-power" : "high-performance" }}
    >
      <color attach="background" args={["#020910"]} />
      <ambientLight intensity={0.12} />
      <directionalLight position={[4, 1, 3]} intensity={2.3} color="#d9f5ff" />
      <Suspense fallback={null}>
        <Planet {...props} />
      </Suspense>
      {props.quality !== "eco" && <Stars radius={50} depth={28} count={props.quality === "ultra" ? 2400 : 1200} factor={2} fade speed={0.25} />}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        minDistance={1.5}
        maxDistance={4.8}
        autoRotate
        autoRotateSpeed={0.18}
      />
    </Canvas>
  );
}
