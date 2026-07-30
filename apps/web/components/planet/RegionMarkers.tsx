"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";

function gridToPos(x: number, y: number, grid = 8): [number, number, number] {
  const lon = (x / (grid - 1)) * 360 - 180;
  const lat = 90 - (y / (grid - 1)) * 180;
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  const r = 1.015;
  return [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];
}

export function RegionMarkers() {
  const planetId = usePlanetStore((s) => s.planetId);
  const selected = usePlanetStore((s) => s.selectedRegion);
  const layers = usePlanetStore((s) => s.layers);

  const { data } = useQuery({
    queryKey: ["regions", planetId],
    queryFn: () => api.getRegions(planetId!),
    enabled: !!planetId && layers.civilizations,
  });

  if (!data?.regions) return null;

  return (
    <group>
      {data.regions
        .filter((_, i) => i % 4 === 0)
        .map((r) => {
          const pos = gridToPos(r.x, r.y);
          const active = selected?.id === r.id;
          return (
            <mesh key={r.id} position={pos}>
              <sphereGeometry args={[active ? 0.03 : 0.015, 8, 8]} />
              <meshBasicMaterial color={active ? "#fbbf24" : "#22d3ee"} transparent opacity={0.85} />
            </mesh>
          );
        })}
    </group>
  );
}
