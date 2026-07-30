"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const vertexShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vWorldNormal = normalize((modelMatrix * vec4(normal, 0.0)).xyz);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  varying vec3 vNormal;
  varying vec3 vWorldNormal;
  void main() {
    float fresnel = pow(1.0 - abs(dot(normalize(vNormal), vec3(0.0, 0.0, 1.0))), 2.2);
    vec3 col = mix(vec3(0.05, 0.35, 0.55), vec3(0.2, 0.85, 0.9), fresnel);
    gl_FragColor = vec4(col, fresnel * 0.55);
  }
`;

export function PlanetAtmosphere() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.02;
  });

  return (
    <mesh ref={ref} scale={1.08}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        transparent
        side={THREE.BackSide}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  );
}
