"use client";

import { Html, Line } from "@react-three/drei";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore, type LayerId } from "@/lib/planet-store";
import { hashSeed, mulberry32 } from "@/lib/noise";

const LAYER_COLORS: Record<LayerId, string> = {
  plants: "#34d399",
  creatures: "#22d3ee",
  weather: "#94a3b8",
  disasters: "#fb923c",
  civilizations: "#fbbf24",
  inventions: "#a78bfa",
  migrations: "#a78bfa",
  wars: "#f87171",
};

const TYPE_TO_LAYER: Record<string, LayerId> = {
  SPECIES_CREATED: "creatures",
  SPECIES_MUTATED: "creatures",
  SPECIES_EXTINCT: "creatures",
  CIVILIZATION_FOUNDED: "civilizations",
  CITY_CREATED: "civilizations",
  TECHNOLOGY_DISCOVERED: "inventions",
  WAR_STARTED: "wars",
  WAR_ENDED: "wars",
  MIGRATION_STARTED: "migrations",
  ALLIANCE_CREATED: "civilizations",
  DISEASE_OUTBREAK: "disasters",
  CLIMATE_CHANGED: "weather",
  VOLCANO_ERUPTED: "disasters",
  RESOURCE_DISCOVERED: "plants",
  USER_ELEMENT_ADDED: "inventions",
  GENESIS: "weather",
};

function pointOnSphere(lat: number, lon: number, r = 1.12): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

export function EventNodes({ max }: { max: number }) {
  const planetId = usePlanetStore((s) => s.planetId);
  const seed = usePlanetStore((s) => s.planetSeed);
  const layers = usePlanetStore((s) => s.layers);

  const { data } = useQuery({
    queryKey: ["events-nodes", planetId],
    queryFn: () => api.getEvents(planetId!, 80),
    enabled: !!planetId,
  });

  const nodes = useMemo(() => {
    const rng = mulberry32(hashSeed(seed + "-nodes"));
    const events = (data?.events || []).slice(0, max);
    return events.map((ev, i) => {
      const lat = -80 + rng() * 160;
      const lon = -180 + rng() * 360;
      const surface = pointOnSphere(lat, lon, 1.02);
      const outer = pointOnSphere(lat, lon, 1.28 + (i % 3) * 0.04);
      const layer = TYPE_TO_LAYER[ev.type] || "weather";
      return { ev, surface, outer, layer, color: LAYER_COLORS[layer] };
    });
  }, [data, max, seed]);

  return (
    <group>
      {nodes
        .filter((n) => layers[n.layer])
        .map((n) => (
          <group key={n.ev.id}>
            <Line points={[n.surface, n.outer]} color={n.color} lineWidth={1} transparent opacity={0.55} />
            <mesh position={n.outer}>
              <sphereGeometry args={[0.025, 8, 8]} />
              <meshBasicMaterial color={n.color} />
            </mesh>
            <Html position={n.outer} distanceFactor={6} style={{ pointerEvents: "none" }}>
              <div
                className="whitespace-nowrap rounded border px-1.5 py-0.5 text-[9px] text-ink"
                style={{
                  borderColor: n.color,
                  background: "rgba(2,6,23,0.75)",
                }}
              >
                {n.ev.title?.slice(0, 18) || n.ev.type}
              </div>
            </Html>
          </group>
        ))}
    </group>
  );
}
