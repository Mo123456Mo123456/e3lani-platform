"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { fbm, hashSeed, heightToBiome, latLonFromNormal } from "@/lib/noise";
import { usePlanetStore } from "@/lib/planet-store";
import { api } from "@/lib/api";

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vColor;
  varying float vLight;

  attribute vec3 aColor;
  attribute float aCity;

  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xyz;
    vColor = aColor;
    vLight = aCity;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uSunDir;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying vec3 vColor;
  varying float vLight;

  void main() {
    vec3 n = normalize(vNormal);
    float ndl = max(dot(n, normalize(uSunDir)), 0.0);
    float night = 1.0 - smoothstep(0.0, 0.35, ndl);
    vec3 day = vColor * (0.25 + 0.85 * ndl);
    vec3 city = vec3(1.0, 0.85, 0.45) * vLight * night * 1.4;
    vec3 rim = vec3(0.15, 0.45, 0.55) * pow(1.0 - max(dot(n, vec3(0.0,0.0,1.0)), 0.0), 2.5) * 0.25;
    gl_FragColor = vec4(day + city + rim, 1.0);
  }
`;

type Props = {
  seed: string;
  segments: number;
  cityLights: boolean;
};

export function PlanetSphere({ seed, segments, cityLights }: Props) {
  const meshRef = useRef<THREE.Mesh>(null);
  const setSelectedRegion = usePlanetStore((s) => s.setSelectedRegion);
  const planetId = usePlanetStore((s) => s.planetId);
  const sun = useRef(new THREE.Vector3(5, 2, 3).normalize());

  const { geometry, material } = useMemo(() => {
    const geo = new THREE.SphereGeometry(1, segments, segments);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const cities = new Float32Array(pos.count);
    const seedNum = hashSeed(seed);

    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const y = pos.getY(i);
      const z = pos.getZ(i);
      const len = Math.sqrt(x * x + y * y + z * z) || 1;
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;

      const h = fbm(nx * 2.2 + 3, nz * 2.2 + 1, seedNum, 5);
      const m = fbm(nx * 3.1 - 2, ny * 3.1 + 4, seedNum + 99, 3);
      const biome = heightToBiome(h, m);
      colors[i * 3] = biome.r;
      colors[i * 3 + 1] = biome.g;
      colors[i * 3 + 2] = biome.b;

      // subtle displacement
      const disp = 1 + Math.max(0, h) * 0.035;
      pos.setXYZ(i, nx * disp, ny * disp, nz * disp);

      if (cityLights && h > 0.05 && h < 0.35 && m > -0.1) {
        const c = fbm(nx * 12, ny * 12, seedNum + 7, 2);
        cities[i] = c > 0.45 ? (c - 0.45) * 3 : 0;
      }
    }

    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aCity", new THREE.BufferAttribute(cities, 1));
    geo.computeVertexNormals();

    const mat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSunDir: { value: sun.current.clone() },
      },
    });

    return { geometry: geo, material: mat };
  }, [seed, segments, cityLights]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * 0.08;
    sun.current.set(Math.cos(t) * 5, 2, Math.sin(t) * 5).normalize();
    if (material.uniforms.uSunDir) {
      material.uniforms.uSunDir.value.copy(sun.current);
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      onClick={async (e) => {
        e.stopPropagation();
        const p = e.point.clone().normalize();
        const { lat, lon } = latLonFromNormal(p.x, p.y, p.z);
        let name: string | undefined;
        let biome: string | undefined;
        let id: string | undefined;

        if (planetId) {
          try {
            const { regions, biomes } = await api.getRegions(planetId);
            // Map lat/lon to nearest grid region (8x8 seed grid)
            const gx = Math.round(((lon + 180) / 360) * 7);
            const gy = Math.round(((90 - lat) / 180) * 7);
            let best = regions[0];
            let bestD = Infinity;
            for (const r of regions) {
              const d = (r.x - gx) ** 2 + (r.y - gy) ** 2;
              if (d < bestD) {
                bestD = d;
                best = r;
              }
            }
            if (best) {
              id = best.id;
              name = best.name;
              const b = biomes.find((x) => x.id === best.biomeId);
              biome = b?.name;
            }
          } catch {
            /* offline */
          }
        }

        setSelectedRegion({ id, lat, lon, name, biome });
      }}
    />
  );
}
