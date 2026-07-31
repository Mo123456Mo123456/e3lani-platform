"use client";

import React, { useMemo } from "react";
import * as THREE from "three";
import { Line } from "@react-three/drei";
import type { WorldSnapshotView } from "@planet/shared-types";
import type { GridData } from "@/lib/useWorld";
import { cellToSpherePosition, GLOBE_RADIUS } from "./Globe";

interface OverlayProps {
  grid: GridData;
  snapshot: WorldSnapshotView;
  showCities: boolean;
  showWars: boolean;
  showTrade: boolean;
  showMigrations: boolean;
  showResources: boolean;
  selectedCell: number | null;
}

function pointsGeometry(positions: THREE.Vector3[]): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(positions.length * 3);
  positions.forEach((p, i) => {
    arr[i * 3] = p.x;
    arr[i * 3 + 1] = p.y;
    arr[i * 3 + 2] = p.z;
  });
  geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
  return geo;
}

function arcBetween(a: THREE.Vector3, b: THREE.Vector3, lift = 0.35): THREE.Vector3[] {
  const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(GLOBE_RADIUS * (1 + lift));
  const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
  return curve.getPoints(24);
}

/** Data-driven overlay markers and arcs — every point traces to engine state. */
export function Overlays({ grid, snapshot, showCities, showWars, showTrade, showMigrations, showResources, selectedCell }: OverlayProps) {
  const R = GLOBE_RADIUS * 1.01;

  const cityGeo = useMemo(() => {
    if (!showCities) return null;
    const pts = snapshot.cities
      .filter((c) => !c.fallen)
      .map((c) => cellToSpherePosition(grid, c.cell, R));
    return pointsGeometry(pts);
  }, [grid, snapshot.cities, showCities, R]);

  const warGeo = useMemo(() => {
    if (!showWars) return null;
    const active = snapshot.wars.filter((w) => w.endedTick === undefined);
    const pts: THREE.Vector3[] = [];
    for (const war of active) {
      const civ = snapshot.civs.find((c) => c.id === war.defenderCiv);
      if (civ) pts.push(cellToSpherePosition(grid, civ.capitalCell, R * 1.01));
    }
    return pts.length > 0 ? pointsGeometry(pts) : null;
  }, [grid, snapshot, showWars, R]);

  const capitalGeo = useMemo(() => {
    if (!showCities) return null;
    const pts = snapshot.civs
      .filter((c) => !c.fallen)
      .map((c) => cellToSpherePosition(grid, c.capitalCell, R * 1.005));
    return pointsGeometry(pts);
  }, [grid, snapshot.civs, showCities, R]);

  const tradeArcs = useMemo(() => {
    if (!showTrade) return [];
    return snapshot.tradeRoutes
      .filter((r) => r.active)
      .slice(0, 40)
      .map((route) => {
        const from = snapshot.cities.find((c) => c.id === route.fromCity);
        const to = snapshot.cities.find((c) => c.id === route.toCity);
        if (!from || !to) return null;
        const a = cellToSpherePosition(grid, from.cell, R);
        const b = cellToSpherePosition(grid, to.cell, R);
        return { id: route.id, points: arcBetween(a, b) };
      })
      .filter((x): x is { id: number; points: THREE.Vector3[] } => x !== null);
  }, [grid, snapshot, showTrade, R]);

  const selectedPos = useMemo(
    () => (selectedCell !== null ? cellToSpherePosition(grid, selectedCell, R * 1.02) : null),
    [grid, selectedCell, R],
  );

  return (
    <group>
      {cityGeo && (
        <points geometry={cityGeo}>
          <pointsMaterial color="#fbbf24" size={0.028} sizeAttenuation transparent opacity={0.95} depthWrite={false} />
        </points>
      )}
      {capitalGeo && (
        <points geometry={capitalGeo}>
          <pointsMaterial color="#fde68a" size={0.05} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
        </points>
      )}
      {warGeo && (
        <points geometry={warGeo}>
          <pointsMaterial color="#f87171" size={0.07} sizeAttenuation transparent opacity={0.9} depthWrite={false} />
        </points>
      )}
      {tradeArcs.map((arc) => (
        <Line key={arc.id} points={arc.points} color="#38bdf8" lineWidth={1} transparent opacity={0.55} />
      ))}
      {selectedPos && (
        <mesh position={selectedPos}>
          <sphereGeometry args={[0.035, 16, 16]} />
          <meshBasicMaterial color="#38bdf8" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
}
