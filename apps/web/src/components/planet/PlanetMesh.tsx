"use client";

import { useRef } from "react";
import { BackSide, Color, Mesh, ShaderMaterial, Vector3 } from "three";
import { ThreeEvent, useFrame } from "@react-three/fiber";
import type { WorldEvent } from "@/lib/api";
import type { PlanetLocation, Quality } from "@/lib/store";

const vertexShader = `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;
  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const planetFragmentShader = `
  uniform float uTime;
  uniform float uSeed;
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vWorld;

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
  }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.,0.)), f.x),
               mix(hash(i + vec2(0.,1.)), hash(i + vec2(1.,1.)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = .5;
    for(int i = 0; i < 6; i++) {
      value += amplitude * noise(p);
      p = p * 2.03 + 19.1;
      amplitude *= .5;
    }
    return value;
  }
  void main() {
    vec2 p = vec2(vUv.x * 7.0, vUv.y * 5.0);
    float terrain = fbm(p + fbm(p * .7));
    float coast = smoothstep(.48, .54, terrain);
    float mountain = smoothstep(.62, .82, terrain);
    vec3 ocean = mix(vec3(.005,.10,.19), vec3(.01,.29,.42), fbm(p * 1.8));
    vec3 land = mix(vec3(.035,.24,.14), vec3(.23,.42,.18), smoothstep(.54,.68,terrain));
    land = mix(land, vec3(.38,.34,.23), mountain);
    vec3 base = mix(ocean, land, coast);

    vec3 sunDir = normalize(vec3(-.7,.45,1.0));
    float diffuse = max(dot(vNormal, sunDir), 0.0);
    float night = 1.0 - smoothstep(-.12, .22, dot(vNormal, sunDir));
    float cityGrid = step(.965, hash(floor(vUv * vec2(250.,130.))));
    float cities = cityGrid * coast * night * smoothstep(.48,.72,terrain) * 3.0;
    vec3 lit = base * (.16 + diffuse * .98);
    lit += vec3(1.0,.68,.2) * cities;
    float rim = pow(1.0 - max(dot(vNormal, normalize(cameraPosition - vWorld)), 0.0), 3.0);
    lit += vec3(.03,.48,.65) * rim * .22;
    gl_FragColor = vec4(lit, 1.0);
  }
`;

const cloudFragmentShader = `
  uniform float uTime;
  varying vec2 vUv;
  float hash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
    return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+1.),f.x),f.y);
  }
  void main() {
    vec2 p = vec2(vUv.x * 13. + uTime * .008, vUv.y * 7.);
    float n = noise(p) * .62 + noise(p * 2.1) * .28 + noise(p * 4.3) * .1;
    float alpha = smoothstep(.58,.76,n) * .42;
    gl_FragColor = vec4(.72,.90,1.,alpha);
  }
`;

const atmosphereVertex = `
  varying vec3 vNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.);
  }
`;

const atmosphereFragment = `
  varying vec3 vNormal;
  void main() {
    float intensity = pow(.72 - dot(vNormal, vec3(0.,0.,1.)), 2.4);
    gl_FragColor = vec4(.05,.65,1., intensity * .58);
  }
`;

function markerPosition(latitude: number, longitude: number, radius = 2.07) {
  const lat = (latitude * Math.PI) / 180;
  const lon = (longitude * Math.PI) / 180;
  return new Vector3(
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    radius * Math.cos(lat) * Math.sin(lon),
  );
}

const markerColors: Record<string, string> = {
  nature: "#3dcf7a",
  civilization: "#e6c35c",
  technology: "#3dd6f5",
  migration: "#a78bfa",
  war: "#ef4444",
  hazard: "#f97316",
};

export function PlanetMesh({
  events,
  quality,
  onPick,
}: {
  events: WorldEvent[];
  quality: Quality;
  onPick: (location: PlanetLocation) => void;
}) {
  const planetMaterial = useRef<ShaderMaterial>(null);
  const cloudMaterial = useRef<ShaderMaterial>(null);
  const cloud = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (planetMaterial.current) planetMaterial.current.uniforms.uTime!.value += delta;
    if (cloudMaterial.current) cloudMaterial.current.uniforms.uTime!.value += delta;
    if (cloud.current) cloud.current.rotation.y += delta * 0.012;
  });

  const detail = quality === "ultra" ? 192 : quality === "high" ? 128 : quality === "medium" ? 96 : 64;
  const showClouds = quality !== "power_saver";

  function pick(event: ThreeEvent<PointerEvent>) {
    event.stopPropagation();
    const point = event.point.clone().normalize();
    onPick({
      latitude: Number(((Math.asin(point.y) * 180) / Math.PI).toFixed(2)),
      longitude: Number(((Math.atan2(point.z, point.x) * 180) / Math.PI).toFixed(2)),
    });
  }

  return (
    <group rotation={[0, -0.35, -0.08]}>
      <mesh onPointerDown={pick}>
        <sphereGeometry args={[2, detail, detail]} />
        <shaderMaterial
          ref={planetMaterial}
          vertexShader={vertexShader}
          fragmentShader={planetFragmentShader}
          uniforms={{ uTime: { value: 0 }, uSeed: { value: 1847.23 } }}
        />
      </mesh>

      {showClouds && (
        <mesh ref={cloud} scale={1.012}>
          <sphereGeometry args={[2, Math.max(48, detail / 2), Math.max(48, detail / 2)]} />
          <shaderMaterial
            ref={cloudMaterial}
            vertexShader={vertexShader}
            fragmentShader={cloudFragmentShader}
            uniforms={{ uTime: { value: 0 } }}
            transparent
            depthWrite={false}
          />
        </mesh>
      )}

      <mesh scale={1.085}>
        <sphereGeometry args={[2, 64, 64]} />
        <shaderMaterial
          vertexShader={atmosphereVertex}
          fragmentShader={atmosphereFragment}
          transparent
          blending={2}
          side={BackSide}
          depthWrite={false}
        />
      </mesh>

      {events
        .filter((event) => event.latitude != null && event.longitude != null)
        .slice(0, quality === "power_saver" ? 6 : 18)
        .map((event) => (
          <group key={event.id} position={markerPosition(event.latitude!, event.longitude!)}>
            <mesh>
              <sphereGeometry args={[0.035, 12, 12]} />
              <meshBasicMaterial color={new Color(markerColors[event.category] ?? "#3dd6f5")} />
            </mesh>
            <mesh scale={1.8}>
              <ringGeometry args={[0.025, 0.05, 20]} />
              <meshBasicMaterial
                color={new Color(markerColors[event.category] ?? "#3dd6f5")}
                transparent
                opacity={0.45}
                side={2}
              />
            </mesh>
          </group>
        ))}
    </group>
  );
}
