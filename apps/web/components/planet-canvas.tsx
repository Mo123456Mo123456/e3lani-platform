"use client";

import { OrbitControls, Stars } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
} from "@react-three/fiber";
import type { PlanetRegion, WorldEvent } from "@planet/shared-types";
import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { useWorldStore, type WorldLayer } from "@/lib/world-store";

interface PlanetCanvasProps {
  regions: PlanetRegion[];
  events: WorldEvent[];
}

export function PlanetCanvas({ regions, events }: PlanetCanvasProps) {
  const quality = useWorldStore((state) => state.quality);
  const dpr =
    quality === "ultra"
      ? [1.5, 2]
      : quality === "high"
        ? [1, 1.6]
        : quality === "medium"
          ? [0.8, 1.2]
          : [0.65, 1];

  return (
    <div className="planet-canvas" aria-label="كوكب ثلاثي الأبعاد تفاعلي">
      <Canvas
        dpr={dpr as [number, number]}
        camera={{ position: [0, 0.15, 6.1], fov: 42, near: 0.1, far: 100 }}
        gl={{
          antialias: quality !== "power-saver",
          alpha: true,
          powerPreference:
            quality === "power-saver" ? "low-power" : "high-performance",
        }}
      >
        <color attach="background" args={["#020810"]} />
        <ambientLight intensity={0.17} color="#63a8c8" />
        <directionalLight
          position={[4, 2.5, 4]}
          intensity={2.8}
          color="#d8f4ff"
        />
        <pointLight position={[-4, -2, -3]} color="#12678a" intensity={1.2} />
        <Planet regions={regions} events={events} />
        {quality !== "power-saver" && (
          <Stars
            radius={60}
            depth={30}
            count={quality === "ultra" ? 2_500 : 1_200}
            factor={2}
            fade
            speed={0.2}
          />
        )}
        <OrbitControls
          enablePan={false}
          enableDamping
          dampingFactor={0.04}
          minDistance={3.15}
          maxDistance={9}
          autoRotate
          autoRotateSpeed={0.22}
        />
      </Canvas>
      <div className="planet-vignette" />
    </div>
  );
}

function Planet({
  regions,
  events,
}: {
  regions: PlanetRegion[];
  events: WorldEvent[];
}) {
  const group = useRef<THREE.Group>(null);
  const quality = useWorldStore((state) => state.quality);

  useFrame((_, delta) => {
    if (group.current && quality !== "power-saver") {
      group.current.rotation.y += delta * 0.006;
    }
  });

  return (
    <group ref={group}>
      <mesh receiveShadow>
        <sphereGeometry args={[1.985, 96, 64]} />
        <meshStandardMaterial
          color="#073956"
          roughness={0.68}
          metalness={0.08}
        />
      </mesh>
      <RegionCells regions={regions} />
      <CityLights regions={regions} />
      <EventMarkers regions={regions} events={events} />
      {quality !== "power-saver" && <CloudLayer />}
      <Atmosphere />
    </group>
  );
}

function RegionCells({ regions }: { regions: PlanetRegion[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const setSelectedRegion = useWorldStore((state) => state.setSelectedRegion);
  const layer = useWorldStore((state) => state.layer);

  useLayoutEffect(() => {
    if (!mesh.current) return;
    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    regions.forEach((region, index) => {
      const radius = 2.005 + Math.max(0, region.elevation) * 0.08;
      const position = coordinates(region, radius);
      dummy.position.copy(position);
      dummy.scale.setScalar(region.biome === "ocean" ? 0.92 : 1);
      dummy.lookAt(position.clone().multiplyScalar(2));
      dummy.updateMatrix();
      mesh.current!.setMatrixAt(index, dummy.matrix);
      mesh.current!.setColorAt(index, color.set(regionColor(region, layer)));
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  }, [regions, layer]);

  const handleClick = (event: ThreeEvent<MouseEvent>) => {
    event.stopPropagation();
    if (event.instanceId !== undefined) {
      setSelectedRegion(regions[event.instanceId] ?? null);
    }
  };

  return (
    <instancedMesh
      ref={mesh}
      args={[undefined, undefined, regions.length]}
      onClick={handleClick}
      onPointerMove={(event) => {
        event.stopPropagation();
        document.body.style.cursor = "crosshair";
      }}
      onPointerOut={() => {
        document.body.style.cursor = "default";
      }}
    >
      <circleGeometry args={[0.128, 7]} />
      <meshStandardMaterial
        roughness={0.84}
        metalness={0.02}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function CityLights({ regions }: { regions: PlanetRegion[] }) {
  const positions = useMemo(
    () =>
      new Float32Array(
        regions
          .filter(({ population }) => population > 6_000)
          .flatMap((region) => {
            const point = coordinates(region, 2.038);
            return [point.x, point.y, point.z];
          }),
      ),
    [regions],
  );

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#ffd978"
        size={0.025}
        transparent
        opacity={0.9}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function EventMarkers({
  regions,
  events,
}: {
  regions: PlanetRegion[];
  events: WorldEvent[];
}) {
  const positions = useMemo(() => {
    const regionById = new Map(regions.map((region) => [region.id, region]));
    return new Float32Array(
      events
        .slice(0, 24)
        .flatMap((event) => {
          const region = event.regionId ? regionById.get(event.regionId) : null;
          if (!region) return [];
          const point = coordinates(region, 2.09);
          return [point.x, point.y, point.z];
        }),
    );
  }, [regions, events]);

  if (positions.length === 0) return null;
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        color="#54e8ff"
        size={0.052}
        transparent
        opacity={0.95}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  );
}

function CloudLayer() {
  const material = useRef<THREE.ShaderMaterial>(null);
  useFrame(({ clock }) => {
    if (material.current) {
      material.current.uniforms.uTime!.value = clock.elapsedTime;
    }
  });
  return (
    <mesh>
      <sphereGeometry args={[2.055, 72, 48]} />
      <shaderMaterial
        ref={material}
        transparent
        depthWrite={false}
        uniforms={{ uTime: { value: 0 } }}
        vertexShader={`
          varying vec2 vUv;
          varying vec3 vNormal;
          void main() {
            vUv = uv;
            vNormal = normalize(normalMatrix * normal);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `}
        fragmentShader={`
          uniform float uTime;
          varying vec2 vUv;
          varying vec3 vNormal;
          float noise(vec2 p) {
            return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
          }
          void main() {
            vec2 uv = vUv * vec2(13.0, 7.0) + vec2(uTime * 0.008, 0.0);
            float cloud = noise(floor(uv)) * 0.55
              + noise(floor(uv * 2.1)) * 0.3
              + noise(floor(uv * 4.3)) * 0.15;
            cloud = smoothstep(0.58, 0.84, cloud);
            float rim = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 2.0);
            gl_FragColor = vec4(vec3(0.75, 0.9, 0.96), cloud * (0.23 + rim * 0.2));
          }
        `}
      />
    </mesh>
  );
}

function Atmosphere() {
  return (
    <>
      <mesh scale={1.08}>
        <sphereGeometry args={[2, 64, 48]} />
        <shaderMaterial
          transparent
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
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
              float intensity = pow(0.72 - dot(vNormal, vec3(0.0, 0.0, 1.0)), 3.0);
              gl_FragColor = vec4(0.08, 0.68, 0.95, 1.0) * intensity;
            }
          `}
        />
      </mesh>
    </>
  );
}

function coordinates(region: PlanetRegion, radius: number): THREE.Vector3 {
  const latitude = THREE.MathUtils.degToRad(region.latitude);
  const longitude = THREE.MathUtils.degToRad(region.longitude);
  return new THREE.Vector3(
    radius * Math.cos(latitude) * Math.cos(longitude),
    radius * Math.sin(latitude),
    radius * Math.cos(latitude) * Math.sin(longitude),
  );
}

function regionColor(region: PlanetRegion, layer: WorldLayer): string {
  if (layer === "temperature") {
    const ratio = THREE.MathUtils.clamp((region.temperature + 20) / 65, 0, 1);
    return new THREE.Color("#3d73e8").lerp(new THREE.Color("#ff542e"), ratio).getStyle();
  }
  if (layer === "pollution") {
    return new THREE.Color("#23c98a")
      .lerp(new THREE.Color("#cb3155"), region.pollution)
      .getStyle();
  }
  if (layer === "civilization") {
    const ratio = THREE.MathUtils.clamp(region.population / 18_000, 0, 1);
    return new THREE.Color("#183244")
      .lerp(new THREE.Color("#f3c65e"), ratio)
      .getStyle();
  }
  if (layer === "surface") {
    return new THREE.Color(region.color).multiplyScalar(0.76).getStyle();
  }
  return region.color;
}
