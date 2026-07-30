"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function CloudLayer() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => {
    if (ref.current) ref.current.rotation.y += dt * 0.04;
  });

  return (
    <mesh ref={ref} scale={1.03}>
      <sphereGeometry args={[1, 64, 48]} />
      <meshStandardMaterial
        color="#c8e7f5"
        transparent
        opacity={0.18}
        depthWrite={false}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}
