"use client";

/**
 * Live event markers — pulsing glow sprites at event locations, colored by
 * event family. Fed by the realtime event stream (real data only).
 */
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import type { PlanetGrid } from "@planet/simulation-models";
import type { WorldEvent } from "@planet/shared-types";
import { buildGlowSprite } from "./planetTextures";
import { latLonToVec3 } from "./geo";
import { PLANET_RADIUS } from "./PlanetMesh";

const EVENT_COLORS: Partial<Record<WorldEvent["type"], string>> = {
  WAR_STARTED: "#ff4444",
  WAR_ENDED: "#ff8866",
  VOLCANO_ERUPTED: "#ff7722",
  WILDFIRE_STARTED: "#ff9933",
  DROUGHT_STARTED: "#e8c35a",
  FLOOD_OCCURRED: "#4aa3ff",
  SPECIES_CREATED: "#58d68d",
  SPECIES_MUTATED: "#7dcea0",
  SPECIES_EXTINCT: "#95a5a6",
  PLANT_SPREAD: "#2ecc71",
  CIVILIZATION_FOUNDED: "#f4d03f",
  CITY_CREATED: "#f7dc6f",
  TECHNOLOGY_DISCOVERED: "#5dade2",
  TRADE_ROUTE_CREATED: "#f0b27a",
  MIGRATION_STARTED: "#bb8fce",
  ALLIANCE_CREATED: "#76d7c4",
  DISEASE_OUTBREAK: "#e74c3c",
  CLIMATE_CHANGED: "#85c1e9",
  CONTRIBUTION_PLACED: "#ffffff",
  RESOURCE_DISCOVERED: "#f8c471",
  RESOURCE_DEPLETED: "#b03a2e",
};

interface SpriteEntry {
  sprite: THREE.Sprite;
  phase: number;
}

export function EventMarkers({ grid, events }: { grid: PlanetGrid; events: WorldEvent[] }) {
  const groupRef = useRef<THREE.Group>(null);
  const entriesRef = useRef<SpriteEntry[]>([]);

  const markers = useMemo(
    () => events.filter((e) => e.cell >= 0 && e.importance >= 0.4).slice(0, 36),
    [events],
  );

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    // clear previous
    for (const entry of entriesRef.current) {
      group.remove(entry.sprite);
      entry.sprite.material.map?.dispose();
      entry.sprite.material.dispose();
    }
    entriesRef.current = [];

    for (const event of markers) {
      const cell = grid.cells[event.cell];
      if (!cell) continue;
      const color = EVENT_COLORS[event.type] ?? "#ffffff";
      const texture = new THREE.CanvasTexture(buildGlowSprite(color));
      const material = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0.9,
      });
      const sprite = new THREE.Sprite(material);
      const [x, y, z] = latLonToVec3(cell.lat, cell.lon, PLANET_RADIUS * 1.015);
      sprite.position.set(x, y, z);
      const baseScale = 0.05 + event.importance * 0.05;
      sprite.scale.setScalar(baseScale);
      sprite.userData.baseScale = baseScale;
      group.add(sprite);
      // deterministic phase from the event id (visual-only determinism)
      let hash = 0;
      for (let i = 0; i < event.id.length; i++) hash = (hash * 31 + event.id.charCodeAt(i)) >>> 0;
      entriesRef.current.push({ sprite, phase: (hash % 628) / 100 });
    }
  }, [markers, grid]);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (const entry of entriesRef.current) {
      const base = entry.sprite.userData.baseScale as number;
      const pulse = 1 + Math.sin(t * 2.4 + entry.phase) * 0.3;
      entry.sprite.scale.setScalar(base * pulse);
    }
  });

  return <group ref={groupRef} />;
}
