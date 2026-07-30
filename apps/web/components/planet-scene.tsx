"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import { Canvas, type ThreeEvent, useFrame } from "@react-three/fiber";
import type { PlanetRegion, WorldEvent } from "@planet/shared-types";
import {
  AdditiveBlending,
  BackSide,
  BufferAttribute,
  Color,
  Group,
  IcosahedronGeometry,
  Mesh,
  ShaderMaterial,
  Vector3,
} from "three";
import { useEffect, useMemo, useRef } from "react";

export type PlanetLayer =
  "surface" | "temperature" | "pollution" | "civilizations";
export type GraphicsQuality = "ultra" | "high" | "medium" | "eco";

const BIOME_COLORS: Record<string, string> = {
  ocean: "#0a4162",
  coast: "#1f7f88",
  plains: "#4f8b4f",
  rainforest: "#145d37",
  temperate_forest: "#276743",
  desert: "#b88b48",
  mountains: "#6f7778",
  tundra: "#80969b",
  wetlands: "#376f5b",
  steppe: "#8a8b4e",
  volcanic: "#6f3024",
  ice: "#c5e5e9",
};

function pointFromCoordinates(
  latitude: number,
  longitude: number,
  radius = 2.04,
): Vector3 {
  const phi = (90 - latitude) * (Math.PI / 180);
  const theta = (longitude + 180) * (Math.PI / 180);
  return new Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function colorForRegion(region: PlanetRegion, layer: PlanetLayer): Color {
  if (layer === "temperature") {
    return new Color().setHSL(0.62 - region.temperature * 0.62, 0.8, 0.46);
  }
  if (layer === "pollution") {
    return new Color().lerpColors(
      new Color("#155b55"),
      new Color("#e34535"),
      Math.min(1, region.pollution * 3),
    );
  }
  if (layer === "civilizations") {
    return region.civilizationId
      ? new Color("#d6a947")
      : new Color(BIOME_COLORS[region.biome]);
  }
  return new Color(BIOME_COLORS[region.biome]);
}

function PlanetMesh({
  regions,
  events,
  layer,
  quality,
  paused,
  onSelect,
}: {
  regions: PlanetRegion[];
  events: WorldEvent[];
  layer: PlanetLayer;
  quality: GraphicsQuality;
  paused: boolean;
  onSelect: (regionId: string) => void;
}) {
  const group = useRef<Group>(null);
  const clouds = useRef<Mesh>(null);
  const detail =
    quality === "ultra"
      ? 6
      : quality === "high"
        ? 5
        : quality === "medium"
          ? 4
          : 3;
  const regionVectors = useMemo(
    () =>
      regions.map((region) =>
        pointFromCoordinates(region.latitude, region.longitude, 1).normalize(),
      ),
    [regions],
  );
  const geometry = useMemo(() => {
    const generated = new IcosahedronGeometry(2, detail).toNonIndexed();
    const positions = generated.getAttribute("position");
    const colors = new Float32Array(positions.count * 3);
    const vector = new Vector3();

    for (let index = 0; index < positions.count; index += 1) {
      vector.fromBufferAttribute(positions, index).normalize();
      let nearest = 0;
      let bestDot = -Infinity;
      for (
        let regionIndex = 0;
        regionIndex < regionVectors.length;
        regionIndex += 1
      ) {
        const dot = vector.dot(regionVectors[regionIndex]!);
        if (dot > bestDot) {
          bestDot = dot;
          nearest = regionIndex;
        }
      }
      const region = regions[nearest]!;
      const radius =
        region.biome === "ocean"
          ? 2
          : 2 + Math.max(0, region.elevation - 0.44) * 0.22;
      vector.multiplyScalar(radius);
      positions.setXYZ(index, vector.x, vector.y, vector.z);
      const color = colorForRegion(region, layer);
      colors[index * 3] = color.r;
      colors[index * 3 + 1] = color.g;
      colors[index * 3 + 2] = color.b;
    }
    generated.setAttribute("color", new BufferAttribute(colors, 3));
    generated.computeVertexNormals();
    return generated;
  }, [detail, layer, regionVectors, regions]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  useFrame((state, delta) => {
    if (group.current && !paused) group.current.rotation.y += delta * 0.025;
    if (clouds.current && !paused) clouds.current.rotation.y += delta * 0.04;
    if (clouds.current?.material instanceof ShaderMaterial) {
      clouds.current.material.uniforms.uTime!.value = state.clock.elapsedTime;
    }
  });

  const selectRegion = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    const localPoint =
      group.current?.worldToLocal(event.point.clone()).normalize() ??
      event.point.normalize();
    let nearest = 0;
    let bestDot = -Infinity;
    regionVectors.forEach((regionVector, index) => {
      const dot = localPoint.dot(regionVector);
      if (dot > bestDot) {
        bestDot = dot;
        nearest = index;
      }
    });
    onSelect(regions[nearest]!.id);
  };

  const visibleEvents = events
    .filter((event) => event.regionId)
    .slice(-Math.max(8, quality === "eco" ? 8 : 18));

  return (
    <group ref={group}>
      <mesh geometry={geometry} onPointerDown={selectRegion}>
        <meshStandardMaterial vertexColors roughness={0.82} metalness={0.03} />
      </mesh>

      <mesh>
        <sphereGeometry
          args={[
            2.008,
            quality === "eco" ? 48 : 96,
            quality === "eco" ? 24 : 64,
          ]}
        />
        <meshPhysicalMaterial
          color="#0b6682"
          transparent
          opacity={0.22}
          roughness={0.18}
          metalness={0.05}
          clearcoat={0.8}
        />
      </mesh>

      {quality !== "eco" && (
        <mesh ref={clouds} scale={1.017}>
          <sphereGeometry
            args={[
              2.04,
              quality === "ultra" ? 128 : 72,
              quality === "ultra" ? 72 : 40,
            ]}
          />
          <shaderMaterial
            transparent
            depthWrite={false}
            uniforms={{ uTime: { value: 0 } }}
            vertexShader={`
              varying vec3 vNormal;
              varying vec3 vPosition;
              void main() {
                vNormal = normalize(normalMatrix * normal);
                vPosition = position;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
              }
            `}
            fragmentShader={`
              uniform float uTime;
              varying vec3 vNormal;
              varying vec3 vPosition;
              void main() {
                float bands = sin(vPosition.x * 7.0 + uTime * 0.08)
                  * sin(vPosition.y * 11.0 - uTime * 0.04)
                  * sin(vPosition.z * 9.0);
                float cloud = smoothstep(0.34, 0.72, bands * 0.5 + 0.5);
                float edge = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
                gl_FragColor = vec4(vec3(0.72, 0.86, 0.91), cloud * 0.28 + edge * 0.025);
              }
            `}
          />
        </mesh>
      )}

      <mesh scale={1.075}>
        <sphereGeometry args={[2.05, 64, 40]} />
        <shaderMaterial
          side={BackSide}
          transparent
          blending={AdditiveBlending}
          depthWrite={false}
          vertexShader={`
            varying vec3 vNormal;
            void main() {
              vNormal = normalize(normalMatrix * normal);
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            varying vec3 vNormal;
            void main() {
              float intensity = pow(0.78 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
              gl_FragColor = vec4(0.12, 0.72, 0.95, intensity * 0.7);
            }
          `}
        />
      </mesh>

      {regions
        .filter((region) => region.civilizationId)
        .map((region) => {
          const point = pointFromCoordinates(
            region.latitude,
            region.longitude,
            2.065,
          );
          return (
            <mesh key={region.id} position={point}>
              <sphereGeometry args={[0.018, 8, 8]} />
              <meshBasicMaterial color="#ffd26a" toneMapped={false} />
              <pointLight color="#ffbb55" intensity={0.25} distance={0.3} />
            </mesh>
          );
        })}

      {visibleEvents.map((event) => {
        const region = regions.find((item) => item.id === event.regionId);
        if (!region) return null;
        const color = event.type.includes("WAR")
          ? "#ff4f48"
          : event.type.includes("WATER")
            ? "#47cbff"
            : "#8ef0d0";
        return (
          <mesh
            key={event.id}
            position={pointFromCoordinates(
              region.latitude,
              region.longitude,
              2.11,
            )}
          >
            <ringGeometry args={[0.025, 0.044, 16]} />
            <meshBasicMaterial
              color={color}
              transparent
              opacity={0.9}
              side={2}
            />
          </mesh>
        );
      })}
    </group>
  );
}

export function PlanetScene(props: {
  regions: PlanetRegion[];
  events: WorldEvent[];
  layer: PlanetLayer;
  quality: GraphicsQuality;
  paused: boolean;
  onSelect: (regionId: string) => void;
}) {
  const dpr: [number, number] =
    props.quality === "ultra"
      ? [1, 2]
      : props.quality === "eco"
        ? [0.65, 1]
        : [0.8, 1.5];
  return (
    <Canvas
      dpr={dpr}
      camera={{ position: [0, 0.25, 5.8], fov: 42, near: 0.1, far: 80 }}
      gl={{
        antialias: props.quality !== "eco",
        alpha: true,
        powerPreference: "high-performance",
      }}
    >
      <ambientLight intensity={0.2} />
      <directionalLight
        position={[4, 2.5, 5]}
        intensity={2.5}
        color="#d9f3ff"
      />
      <directionalLight
        position={[-3, -1, -4]}
        intensity={0.16}
        color="#2854ff"
      />
      <PlanetMesh {...props} />
      {props.quality !== "eco" && (
        <Stars
          radius={35}
          depth={25}
          count={props.quality === "ultra" ? 2600 : 1200}
          factor={2}
          fade
          speed={0.15}
        />
      )}
      <OrbitControls
        enablePan={false}
        enableDamping
        dampingFactor={0.055}
        minDistance={3.5}
        maxDistance={8}
        rotateSpeed={0.48}
        zoomSpeed={0.65}
      />
    </Canvas>
  );
}
