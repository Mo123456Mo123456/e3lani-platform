"use client";

import { Html, OrbitControls, Stars } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
import {
  AdditiveBlending,
  BackSide,
  Color,
  DoubleSide,
  Group,
  Mesh,
  NormalBlending,
  Points as ThreePoints,
  Quaternion,
  ShaderMaterial,
  Vector3,
} from "three";
import { Suspense, useMemo, useRef } from "react";

import type { Language, Quality, Region, WorldEvent } from "../lib/types";
import {
  QUALITY_PROFILES,
  cartesianToLatLon,
  latLonToCartesian,
  makeCityLightPositions,
  nearestRegion,
} from "../lib/world";

const MAX_REGIONS = 12;
const SURFACE_VERTEX_SHADER = `
  varying vec3 vDirection;
  varying vec3 vViewNormal;
  varying vec3 vWorldPosition;

  void main() {
    vDirection = normalize(position);
    vec4 worldPosition = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPosition.xyz;
    vViewNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * viewMatrix * worldPosition;
  }
`;

const SURFACE_FRAGMENT_SHADER = `
  uniform vec3 uRegionCenters[${MAX_REGIONS}];
  uniform vec3 uRegionColors[${MAX_REGIONS}];
  uniform float uRegionCount;
  uniform float uSelectedIndex;
  uniform float uHighlightedIndex;
  uniform float uTime;
  varying vec3 vDirection;
  varying vec3 vViewNormal;
  varying vec3 vWorldPosition;

  float terrainNoise(vec3 p) {
    float a = sin(p.x * 9.0 + sin(p.y * 7.0));
    float b = sin(p.y * 14.0 - p.z * 8.0);
    float c = sin((p.x + p.z) * 22.0) * 0.35;
    return (a + b + c) / 2.35;
  }

  void main() {
    float best = -2.0;
    float second = -2.0;
    float nearestIndex = 0.0;
    vec3 regionColor = vec3(0.08, 0.45, 0.32);

    for (int i = 0; i < ${MAX_REGIONS}; i++) {
      if (float(i) < uRegionCount) {
        float influence = dot(normalize(vDirection), normalize(uRegionCenters[i]));
        if (influence > best) {
          second = best;
          best = influence;
          nearestIndex = float(i);
          regionColor = uRegionColors[i];
        } else if (influence > second) {
          second = influence;
        }
      }
    }

    float ridge = terrainNoise(vDirection);
    float continental = sin(vDirection.x * 5.0 + vDirection.z * 3.2)
      + sin(vDirection.y * 8.0 - vDirection.x * 2.7)
      + ridge;
    float landMask = smoothstep(-0.32, 0.18, continental);
    float border = smoothstep(0.0, 0.065, best - second);
    vec3 oceanDeep = vec3(0.008, 0.075, 0.095);
    vec3 oceanShallow = vec3(0.02, 0.22, 0.24);
    vec3 ocean = mix(oceanDeep, oceanShallow, smoothstep(-0.8, 0.25, continental));
    vec3 terrain = regionColor * (0.72 + ridge * 0.13);
    terrain += vec3(0.12, 0.14, 0.08) * smoothstep(0.4, 1.4, continental);
    vec3 color = mix(ocean, terrain, landMask);

    float gridLat = smoothstep(0.975, 1.0, cos(asin(vDirection.y) * 36.0));
    float gridLon = smoothstep(0.985, 1.0, cos(atan(vDirection.z, vDirection.x) * 38.0));
    float grid = (gridLat + gridLon) * 0.025;
    color += vec3(0.15, 0.8, 0.66) * grid * (1.0 - landMask * 0.4);
    color *= mix(0.83, 1.0, border);

    if (abs(nearestIndex - uSelectedIndex) < 0.1) {
      float selection = smoothstep(0.58, 0.94, best) * (0.05 + 0.03 * sin(uTime * 2.0));
      color += vec3(0.15, 1.0, 0.72) * selection;
    }
    if (abs(nearestIndex - uHighlightedIndex) < 0.1) {
      float wave = 0.5 + 0.5 * sin(uTime * 5.0 - best * 28.0);
      color += vec3(0.8, 1.0, 0.35) * smoothstep(0.68, 0.94, best) * wave * 0.18;
    }

    vec3 viewDirection = normalize(cameraPosition - vWorldPosition);
    float fresnel = pow(1.0 - max(dot(normalize(vDirection), viewDirection), 0.0), 2.5);
    color += vec3(0.04, 0.55, 0.62) * fresnel * 0.3;
    float light = 0.52 + 0.48 * max(dot(vViewNormal, normalize(vec3(0.5, 0.8, 1.0))), 0.0);
    gl_FragColor = vec4(color * light, 1.0);
  }
`;

const CLOUD_VERTEX_SHADER = `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const CLOUD_FRAGMENT_SHADER = `
  uniform float uTime;
  varying vec3 vDirection;
  void main() {
    float bands = sin(vDirection.x * 18.0 + uTime * 0.14)
      * sin(vDirection.z * 14.0 - uTime * 0.09);
    float wisps = sin((vDirection.x + vDirection.y + vDirection.z) * 31.0 + uTime * 0.08);
    float cloud = smoothstep(0.63, 1.12, bands + wisps * 0.28);
    gl_FragColor = vec4(0.58, 0.9, 0.88, cloud * 0.16);
  }
`;

interface SceneProps {
  regions: Region[];
  events: WorldEvent[];
  language: Language;
  quality: Quality;
  selectedRegionId: string | null;
  highlightedRegionId: string | null;
  onSelectRegion: (regionId: string) => void;
}

function Surface({
  regions,
  quality,
  selectedRegionId,
  highlightedRegionId,
  onSelectRegion,
}: Pick<
  SceneProps,
  | "regions"
  | "quality"
  | "selectedRegionId"
  | "highlightedRegionId"
  | "onSelectRegion"
>) {
  const material = useRef<ShaderMaterial>(null);
  const profile = QUALITY_PROFILES[quality];
  const uniforms = useMemo(() => {
    const centers = Array.from(
      { length: MAX_REGIONS },
      () => new Vector3(0, 1, 0),
    );
    const colors = Array.from(
      { length: MAX_REGIONS },
      () => new Color("#178269"),
    );

    regions.slice(0, MAX_REGIONS).forEach((region, index) => {
      const center = centers[index];
      const color = colors[index];
      if (center && color) {
        center.set(...latLonToCartesian(region.latitude, region.longitude));
        color.set(region.terrainColor);
      }
    });

    return {
      uRegionCenters: { value: centers },
      uRegionColors: { value: colors },
      uRegionCount: { value: Math.min(regions.length, MAX_REGIONS) },
      uSelectedIndex: {
        value: regions.findIndex((region) => region.id === selectedRegionId),
      },
      uHighlightedIndex: {
        value: regions.findIndex((region) => region.id === highlightedRegionId),
      },
      uTime: { value: 0 },
    };
  }, [highlightedRegionId, regions, selectedRegionId]);

  useFrame((state) => {
    if (material.current)
      material.current.uniforms.uTime.value = state.clock.elapsedTime;
  });

  const handleSelect = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const point = event.object.worldToLocal(event.point.clone()).normalize();
    const coordinates = cartesianToLatLon(point.x, point.y, point.z);
    const region = nearestRegion(
      regions,
      coordinates.latitude,
      coordinates.longitude,
    );
    if (region) onSelectRegion(region.id);
  };

  return (
    <mesh onClick={handleSelect}>
      <sphereGeometry
        args={[2, profile.segments, Math.max(32, profile.segments / 2)]}
      />
      <shaderMaterial
        ref={material}
        fragmentShader={SURFACE_FRAGMENT_SHADER}
        uniforms={uniforms}
        vertexShader={SURFACE_VERTEX_SHADER}
      />
    </mesh>
  );
}

function Clouds({ quality }: { quality: Quality }) {
  const mesh = useRef<Mesh>(null);
  const material = useRef<ShaderMaterial>(null);
  const profile = QUALITY_PROFILES[quality];
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), []);

  useFrame((state, delta) => {
    if (material.current)
      material.current.uniforms.uTime.value = state.clock.elapsedTime;
    if (mesh.current && profile.animateClouds)
      mesh.current.rotation.y += delta * 0.012;
  });

  return (
    <mesh ref={mesh}>
      <sphereGeometry
        args={[2.045, profile.segments, Math.max(24, profile.segments / 2)]}
      />
      <shaderMaterial
        ref={material}
        blending={NormalBlending}
        depthWrite={false}
        fragmentShader={CLOUD_FRAGMENT_SHADER}
        transparent
        uniforms={uniforms}
        vertexShader={CLOUD_VERTEX_SHADER}
      />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <mesh>
      <sphereGeometry args={[2.19, 64, 32]} />
      <shaderMaterial
        blending={AdditiveBlending}
        depthWrite={false}
        fragmentShader={`
          varying vec3 vNormal;
          void main() {
            float intensity = pow(0.62 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 2.2);
            gl_FragColor = vec4(0.12, 0.9, 0.73, intensity * 0.48);
          }
        `}
        side={BackSide}
        transparent
        vertexShader={`
          varying vec3 vNormal;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
      />
    </mesh>
  );
}

function CityLights({
  regions,
  quality,
}: Pick<SceneProps, "regions" | "quality">) {
  const points = useRef<ThreePoints>(null);
  const positions = useMemo(
    () => makeCityLightPositions(regions, QUALITY_PROFILES[quality].cityLights),
    [quality, regions],
  );

  useFrame((state) => {
    if (points.current) {
      const pulse = 0.68 + Math.sin(state.clock.elapsedTime * 2.2) * 0.18;
      const material = points.current.material;
      if (!Array.isArray(material)) material.opacity = pulse;
    }
  });

  return (
    <points ref={points}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        blending={AdditiveBlending}
        color="#c9ff9a"
        depthWrite={false}
        size={quality === "eco" ? 0.018 : 0.025}
        sizeAttenuation
        transparent
      />
    </points>
  );
}

function RegionMarkers({
  regions,
  language,
  selectedRegionId,
  highlightedRegionId,
  onSelectRegion,
}: Pick<
  SceneProps,
  | "regions"
  | "language"
  | "selectedRegionId"
  | "highlightedRegionId"
  | "onSelectRegion"
>) {
  return (
    <group>
      {regions.map((region) => {
        const position = new Vector3(
          ...latLonToCartesian(region.latitude, region.longitude, 2.035),
        );
        const ringQuaternion = new Quaternion().setFromUnitVectors(
          new Vector3(0, 0, 1),
          position.clone().normalize(),
        );
        const selected = region.id === selectedRegionId;
        const highlighted = region.id === highlightedRegionId;
        return (
          <group key={region.id} position={position}>
            <mesh
              onClick={(event) => {
                event.stopPropagation();
                onSelectRegion(region.id);
              }}
            >
              <sphereGeometry
                args={[selected || highlighted ? 0.046 : 0.025, 14, 14]}
              />
              <meshBasicMaterial
                color={
                  highlighted
                    ? "#e9ff72"
                    : selected
                      ? "#9effd8"
                      : region.accentColor
                }
                toneMapped={false}
              />
            </mesh>
            {(selected || highlighted) && (
              <mesh quaternion={ringQuaternion}>
                <ringGeometry args={[0.07, 0.082, 40]} />
                <meshBasicMaterial
                  blending={AdditiveBlending}
                  color={highlighted ? "#e9ff72" : "#7dffd0"}
                  depthWrite={false}
                  side={DoubleSide}
                  transparent
                  opacity={0.8}
                />
              </mesh>
            )}
            {selected && (
              <Html center distanceFactor={8} occlude position={[0, 0.14, 0]}>
                <span className="globe-region-label">
                  {region.name[language]}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function EventMarkers({
  events,
  language,
  onSelectRegion,
}: Pick<SceneProps, "events" | "language" | "onSelectRegion">) {
  return (
    <group>
      {events.slice(0, 7).map((event, index) => {
        const position = latLonToCartesian(
          event.latitude,
          event.longitude,
          2.08,
        );
        return (
          <group key={event.id} position={position}>
            <mesh
              onClick={(pointerEvent) => {
                pointerEvent.stopPropagation();
                onSelectRegion(event.regionId);
              }}
            >
              <octahedronGeometry args={[index === 0 ? 0.065 : 0.045, 0]} />
              <meshBasicMaterial
                blending={AdditiveBlending}
                color={index === 0 ? "#fff2a1" : "#67f4d2"}
                depthWrite={false}
                toneMapped={false}
              />
            </mesh>
            {index === 0 && (
              <Html center distanceFactor={9} occlude position={[0, 0.16, 0]}>
                <span className="globe-event-label">
                  {event.title[language]}
                </span>
              </Html>
            )}
          </group>
        );
      })}
    </group>
  );
}

function PlanetGroup(props: SceneProps) {
  const group = useRef<Group>(null);
  const { invalidate } = useThree();
  const highlightOrientation = useMemo(() => {
    const region = props.regions.find(
      (item) => item.id === props.highlightedRegionId,
    );
    if (!region) return null;
    const regionDirection = new Vector3(
      ...latLonToCartesian(region.latitude, region.longitude),
    ).normalize();
    return new Quaternion().setFromUnitVectors(
      regionDirection,
      new Vector3(0, 0, 1),
    );
  }, [props.highlightedRegionId, props.regions]);

  useFrame((_, delta) => {
    if (group.current && highlightOrientation) {
      group.current.quaternion.slerp(
        highlightOrientation,
        1 - Math.pow(0.004, delta),
      );
    } else if (group.current) {
      group.current.rotation.y += delta * 0.018;
    }
  });

  return (
    <group ref={group} onPointerEnter={() => invalidate()}>
      <Surface {...props} />
      <Clouds quality={props.quality} />
      <CityLights regions={props.regions} quality={props.quality} />
      <RegionMarkers {...props} />
      <EventMarkers
        events={props.events}
        language={props.language}
        onSelectRegion={props.onSelectRegion}
      />
      <Atmosphere />
    </group>
  );
}

export function PlanetExperience(props: SceneProps & { ariaLabel: string }) {
  const profile = QUALITY_PROFILES[props.quality];

  return (
    <div className="planet-canvas" role="img" aria-label={props.ariaLabel}>
      <Canvas
        camera={{ fov: 39, near: 0.1, far: 100, position: [0, 0.15, 6.1] }}
        dpr={profile.dpr}
        fallback={<div className="canvas-fallback">WebGL unavailable</div>}
        gl={{ alpha: true, antialias: props.quality !== "eco" }}
      >
        <color attach="background" args={["#050c0d"]} />
        <ambientLight intensity={0.25} />
        <directionalLight
          color="#b5ffe8"
          intensity={1.4}
          position={[4, 4, 6]}
        />
        <pointLight color="#1e8dff" intensity={8} position={[-5, -1, -3]} />
        <Suspense fallback={null}>
          <Stars
            count={profile.stars}
            depth={42}
            factor={2.2}
            fade
            radius={38}
            saturation={0.5}
            speed={0.2}
          />
          <PlanetGroup {...props} />
        </Suspense>
        <OrbitControls
          autoRotate={false}
          dampingFactor={0.055}
          enableDamping
          enablePan={false}
          maxDistance={8}
          minDistance={4.2}
          rotateSpeed={0.55}
        />
      </Canvas>
    </div>
  );
}
