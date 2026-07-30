"use client";

import { Html, Line, OrbitControls } from "@react-three/drei";
import { Canvas, ThreeEvent, useFrame } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  BufferGeometry,
  Color,
  Mesh,
  Points,
  ShaderMaterial,
  Vector3,
} from "three";
import { useI18n } from "@/stores/locale-store";
import { usePlanetStore } from "@/stores/planet-store";
import type { PlanetDto, PlanetOverlayMarker, RegionSummary, WorldEventDto } from "@/types/domain";
import styles from "@/app/app.module.css";

const surfaceVertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const surfaceFragmentShader = `
  precision highp float;

  uniform float uTime;
  uniform float uPollution;
  uniform float uCityLights;
  uniform float uLayer;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorldPosition;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    float continent = noise(vUv * vec2(8.0, 4.0) + vec2(uTime * 0.012, 0.0));
    continent += 0.42 * noise(vUv * vec2(18.0, 9.0) - vec2(0.0, uTime * 0.006));
    float landMask = smoothstep(0.62, 0.74, continent);
    float coast = smoothstep(0.56, 0.68, continent) - landMask;

    vec3 ocean = mix(vec3(0.012, 0.076, 0.16), vec3(0.0, 0.53, 0.72), noise(vUv * 20.0));
    vec3 plant = mix(vec3(0.04, 0.28, 0.18), vec3(0.17, 0.88, 0.52), noise(vUv * 12.0));
    vec3 desert = vec3(0.72, 0.55, 0.24);
    vec3 mountain = vec3(0.42, 0.48, 0.46);
    float latitude = abs(vUv.y - 0.5) * 2.0;
    vec3 land = mix(plant, desert, smoothstep(0.42, 0.7, latitude) * noise(vUv * 7.0));
    land = mix(land, mountain, smoothstep(0.74, 0.9, noise(vUv * 28.0)));

    vec3 color = mix(ocean, land, landMask);
    color = mix(color, vec3(0.63, 0.85, 0.68), coast * 0.45);

    vec3 pollutionTint = vec3(0.72, 0.16, 0.12);
    color = mix(color, pollutionTint, clamp(uPollution, 0.0, 1.0) * 0.28);

    if (uLayer > 1.5 && uLayer < 2.5) {
      color = mix(color, vec3(0.17, 0.92, 0.58), landMask * 0.32);
    } else if (uLayer > 2.5 && uLayer < 3.5) {
      color = mix(color, vec3(0.0, 0.85, 1.0), 0.18 + noise(vUv * 30.0) * 0.18);
    } else if (uLayer > 3.5 && uLayer < 4.5) {
      color = mix(color, vec3(0.95, 0.68, 0.18), landMask * 0.28);
    } else if (uLayer > 7.5 && uLayer < 8.5) {
      color = mix(color, vec3(1.0, 0.18, 0.11), clamp(uPollution, 0.0, 1.0) * 0.55);
    }

    float fresnel = pow(1.0 - max(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0)), 0.0), 2.4);
    float cityNoise = smoothstep(0.84, 0.98, noise(vUv * vec2(90.0, 44.0)));
    vec3 cityLights = vec3(1.0, 0.78, 0.34) * cityNoise * landMask * uCityLights;

    gl_FragColor = vec4(color + cityLights + fresnel * vec3(0.0, 0.55, 0.78), 1.0);
  }
`;

const atmosphereVertexShader = `
  varying vec3 vNormal;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const atmosphereFragmentShader = `
  precision highp float;

  varying vec3 vNormal;

  void main() {
    float glow = pow(0.68 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.0);
    gl_FragColor = vec4(0.0, 0.78, 1.0, clamp(glow, 0.0, 0.42));
  }
`;

const layerIndex: Record<string, number> = {
  surface: 0,
  biome: 2,
  weather: 3,
  civilization: 4,
  resource: 5,
  conflict: 6,
  migration: 7,
  pollution: 8,
  temperature: 9,
  historical: 10,
};

const categoryColor: Record<string, string> = {
  plant: "#33f5a1",
  creature: "#7efcff",
  resource: "#00d9ff",
  civilization: "#d9ae4d",
  weather: "#6fe6ff",
  disaster: "#ff8a35",
  war: "#ff4d66",
  migration: "#9e6dff",
  invention: "#d9ae4d",
};

function latLonToVector3(lat: number, lon: number, radius = 2.04) {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return new Vector3(-radius * Math.sin(phi) * Math.cos(theta), radius * Math.cos(phi), radius * Math.sin(phi) * Math.sin(theta));
}

function nearestRegion(regions: RegionSummary[] | undefined, lat: number, lon: number) {
  if (!regions?.length) {
    return null;
  }

  return regions.reduce((closest, region) => {
    const score = Math.hypot(region.lat - lat, region.lon - lon);
    const closestScore = Math.hypot(closest.lat - lat, closest.lon - lon);
    return score < closestScore ? region : closest;
  }, regions[0]);
}

function qualitySettings(quality: string) {
  switch (quality) {
    case "ultra":
      return { segments: 160, dpr: [1, 2] as [number, number], particles: 140 };
    case "high":
      return { segments: 112, dpr: [1, 1.6] as [number, number], particles: 90 };
    case "medium":
      return { segments: 72, dpr: [1, 1.25] as [number, number], particles: 40 };
    default:
      return { segments: 48, dpr: [0.75, 1] as [number, number], particles: 0 };
  }
}

function eventToMarker(event: WorldEventDto): PlanetOverlayMarker | null {
  if (typeof event.lat !== "number" || typeof event.lon !== "number") {
    return null;
  }

  const type = event.type.toLowerCase();
  const category = type.includes("war")
    ? "war"
    : type.includes("migration")
      ? "migration"
      : type.includes("volcano") || type.includes("disaster")
        ? "disaster"
        : type.includes("plant")
          ? "plant"
          : type.includes("civil")
            ? "civilization"
            : "weather";

  return {
    id: `event-${event.id}`,
    category,
    label: event.title,
    labelAr: event.titleAr ?? event.title,
    value: event.type,
    valueAr: event.type,
    lat: event.lat,
    lon: event.lon,
    color: categoryColor[category] ?? "#00d9ff",
  };
}

function PlanetBody({ planet, events }: { planet?: PlanetDto; events?: WorldEventDto[] }) {
  const meshRef = useRef<Mesh>(null);
  const materialRef = useRef<ShaderMaterial>(null);
  const activeLayer = usePlanetStore((state) => state.activeLayer);
  const setSelectedRegionId = usePlanetStore((state) => state.setSelectedRegionId);
  const quality = usePlanetStore((state) => state.quality);
  const settings = qualitySettings(quality);

  const pollution = Math.min(Math.max((planet?.pollution ?? 0) / 100, 0), 1);
  const totalPopulation = planet?.civilizations?.reduce((sum, civ) => sum + (civ.population || 0), 0) ?? 0;
  const cityLights = Math.min(1, totalPopulation / 2_500_000);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uPollution: { value: pollution },
      uCityLights: { value: cityLights },
      uLayer: { value: layerIndex[activeLayer] ?? 0 },
    }),
    [activeLayer, cityLights, pollution],
  );

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
      materialRef.current.uniforms.uPollution.value = pollution;
      materialRef.current.uniforms.uCityLights.value = cityLights;
      materialRef.current.uniforms.uLayer.value = layerIndex[activeLayer] ?? 0;
    }

    if (meshRef.current) {
      meshRef.current.rotation.y += quality === "power_saver" ? 0.0007 : 0.0018;
    }
  });

  function handleClick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    if (!event.uv) {
      return;
    }

    const lat = 90 - event.uv.y * 180;
    const lon = event.uv.x * 360 - 180;
    const region = nearestRegion(planet?.regions, lat, lon);
    setSelectedRegionId(region?.id ?? null);
  }

  return (
    <mesh ref={meshRef} onClick={handleClick}>
      <sphereGeometry args={[2, settings.segments, settings.segments]} />
      <shaderMaterial ref={materialRef} vertexShader={surfaceVertexShader} fragmentShader={surfaceFragmentShader} uniforms={uniforms} />
      <MarkerLayer planet={planet} events={events} />
      <Atmosphere segments={settings.segments} />
      {settings.particles > 0 ? <StormParticles events={events} count={settings.particles} /> : null}
    </mesh>
  );
}

function Atmosphere({ segments }: { segments: number }) {
  return (
    <mesh scale={1.075}>
      <sphereGeometry args={[2, segments, segments]} />
      <shaderMaterial
        vertexShader={atmosphereVertexShader}
        fragmentShader={atmosphereFragmentShader}
        side={BackSide}
        transparent
        depthWrite={false}
        blending={AdditiveBlending}
      />
    </mesh>
  );
}

function MarkerLayer({ planet, events }: { planet?: PlanetDto; events?: WorldEventDto[] }) {
  const { locale } = useI18n();
  const markers = useMemo(() => {
    const overlayMarkers = planet?.overlays ?? planet?.markers ?? [];
    const eventMarkers = events?.map(eventToMarker).filter((marker): marker is PlanetOverlayMarker => Boolean(marker)) ?? [];
    return [...overlayMarkers, ...eventMarkers].slice(0, 28);
  }, [events, planet?.markers, planet?.overlays]);

  return (
    <>
      {markers.map((marker) => {
        const color = marker.color || categoryColor[marker.category] || "#00d9ff";
        const start = latLonToVector3(marker.lat, marker.lon, 2.03);
        const end = latLonToVector3(marker.lat, marker.lon, 2.38);

        return (
          <group key={marker.id} position={start}>
            <Line points={[new Vector3(0, 0, 0), end.clone().sub(start)]} color={color} transparent opacity={0.45} lineWidth={1} />
            <mesh position={end.clone().sub(start)}>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshBasicMaterial color={color} toneMapped={false} />
            </mesh>
            <Html position={end.clone().sub(start).multiplyScalar(1.04)} center distanceFactor={8} occlude>
              <div className={`${styles.markerLabel} ${styles.pulse}`}>
                {locale === "ar" ? marker.labelAr || marker.label : marker.label}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
}

function StormParticles({ events, count }: { events?: WorldEventDto[]; count: number }) {
  const pointsRef = useRef<Points>(null);
  const stormSeeds = events?.filter((event) => /storm|weather|climate|volcano|disaster/i.test(event.type)).length ?? 0;

  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const lat = (Math.random() - 0.5) * 120;
      const lon = Math.random() * 360 - 180;
      const radius = 2.22 + Math.random() * 0.28;
      const position = latLonToVector3(lat, lon, radius);
      positions[index * 3] = position.x;
      positions[index * 3 + 1] = position.y;
      positions[index * 3 + 2] = position.z;
    }

    const buffer = new BufferGeometry();
    buffer.setAttribute("position", new BufferAttribute(positions, 3));
    return buffer;
  }, [count]);

  useFrame(() => {
    if (pointsRef.current) {
      pointsRef.current.rotation.y -= 0.0022;
      pointsRef.current.rotation.x += 0.0007;
    }
  });

  if (stormSeeds === 0) {
    return null;
  }

  return (
    <points ref={pointsRef} geometry={geometry}>
      <pointsMaterial color={new Color("#7efcff")} size={0.018} transparent opacity={0.58} depthWrite={false} />
    </points>
  );
}

export default function PlanetScene({ planet, events }: { planet?: PlanetDto; events?: WorldEventDto[] }) {
  const { t } = useI18n();
  const quality = usePlanetStore((state) => state.quality);
  const settings = qualitySettings(quality);
  const [webgl2, setWebgl2] = useState(true);

  return (
    <>
      <Canvas
        camera={{ position: [0, 0, 5.5], fov: 43 }}
        dpr={settings.dpr}
        gl={{ antialias: quality !== "power_saver", alpha: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          setWebgl2(gl.capabilities.isWebGL2);
          gl.setClearColor("#050a14", 0);
        }}
      >
        <ambientLight intensity={0.78} />
        <directionalLight position={[5, 3, 5]} intensity={2.1} color="#bffaff" />
        <pointLight position={[-3, -2, 4]} intensity={1.6} color="#33f5a1" />
        <PlanetBody planet={planet} events={events} />
        <OrbitControls enablePan={false} minDistance={3.15} maxDistance={8.5} autoRotate={false} enableDamping dampingFactor={0.08} />
      </Canvas>
      {!webgl2 ? <div className={styles.errorBadge}>{t.dashboard.webglWarning}</div> : null}
    </>
  );
}
