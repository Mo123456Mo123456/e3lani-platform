"use client";

/**
 * Trade routes & migrations — arcs over the surface with animated convoy
 * dots. Rendered only when the matching layer is active.
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { PlanetGrid } from "@planet/simulation-models";
import { latLonToVec3 } from "./geo";
import { PLANET_RADIUS } from "./PlanetMesh";

export interface RouteData {
  id: string;
  path: number[];
  kind: "trade" | "migration" | "war";
}

const KIND_COLORS: Record<RouteData["kind"], string> = {
  trade: "#e8c35a",
  migration: "#bb8fce",
  war: "#e74c3c",
};

export function RoutesLayer({ grid, routes }: { grid: PlanetGrid; routes: RouteData[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const convoysRef = useRef<Array<{ mesh: THREE.Mesh; curve: THREE.CatmullRomCurve3; offset: number }>>([]);

  const curves = useMemo(() => {
    return routes
      .filter((r) => r.path.length >= 2)
      .slice(0, 40)
      .map((route) => {
        const points = route.path
          .filter((_, i) => i % Math.ceil(route.path.length / 24) === 0 || i === route.path.length - 1)
          .map((idx) => {
            const cell = grid.cells[idx]!;
            const [x, y, z] = latLonToVec3(cell.lat, cell.lon, PLANET_RADIUS * 1.006);
            return new THREE.Vector3(x, y, z);
          });
        if (points.length < 2) return null;
        // lift midpoints for an arc
        const lifted = points.map((p, i) => {
          const t = i / (points.length - 1);
          const lift = 1 + Math.sin(t * Math.PI) * 0.045;
          return p.clone().multiplyScalar(lift);
        });
        return { route, curve: new THREE.CatmullRomCurve3(lifted) };
      })
      .filter((c): c is { route: RouteData; curve: THREE.CatmullRomCurve3 } => c !== null);
  }, [routes, grid]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clear();
    convoysRef.current = [];

    for (const { route, curve } of curves) {
      const color = KIND_COLORS[route.kind];
      const geometry = new THREE.TubeGeometry(curve, 32, 0.0018, 6, false);
      const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.75 });
      group.add(new THREE.Mesh(geometry, material));

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 8, 8),
        new THREE.MeshBasicMaterial({ color: "#ffffff" }),
      );
      group.add(dot);
      let hash = 0;
      for (let i = 0; i < route.id.length; i++) hash = (hash * 31 + route.id.charCodeAt(i)) >>> 0;
      convoysRef.current.push({ mesh: dot, curve, offset: (hash % 100) / 100 });
    }
    return () => {
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      }
    };
  }, [curves]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime * 0.08;
    for (const { mesh, curve, offset } of convoysRef.current) {
      const pos = curve.getPoint((t + offset) % 1);
      mesh.position.copy(pos);
    }
  });

  return <group ref={groupRef} />;
}
