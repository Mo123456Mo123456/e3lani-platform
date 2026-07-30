"use client";

import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function RegionDrawer() {
  const locale = usePlanetStore((s) => s.locale);
  const open = usePlanetStore((s) => s.regionDrawerOpen);
  const selected = usePlanetStore((s) => s.selectedRegion);
  const setRegionDrawerOpen = usePlanetStore((s) => s.setRegionDrawerOpen);
  const planetId = usePlanetStore((s) => s.planetId);
  const dict = t(locale);

  const { data } = useQuery({
    queryKey: ["region-detail", planetId, selected?.id],
    queryFn: async () => {
      const res = await api.getRegions(planetId!);
      const region = res.regions.find((r) => r.id === selected?.id);
      const biome = res.biomes.find((b) => b.id === region?.biomeId);
      return { region, biome };
    },
    enabled: !!planetId && !!selected?.id,
  });

  return (
    <AnimatePresence>
      {open && selected && (
        <motion.aside
          initial={{ x: locale === "ar" ? -320 : 320, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: locale === "ar" ? -320 : 320, opacity: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 28 }}
          className="glass-panel absolute end-3 top-20 z-30 w-[min(100%,300px)] p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-ink">{dict.region.title}</h3>
            <Button variant="ghost" size="sm" onClick={() => setRegionDrawerOpen(false)}>
              {dict.region.close}
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="text-base font-bold text-cyan">
              {selected.name || data?.region?.name || `${selected.lat.toFixed(1)}°, ${selected.lon.toFixed(1)}°`}
            </div>
            <Badge tone="green">{selected.biome || data?.biome?.name || dict.region.biome}</Badge>
            {data?.region && (
              <dl className="mt-3 space-y-1.5 text-xs text-muted">
                <div className="flex justify-between">
                  <dt>{dict.region.elevation}</dt>
                  <dd className="text-ink">{data.region.elevation.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{dict.region.moisture}</dt>
                  <dd className="text-ink">{data.region.moisture.toFixed(2)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>{dict.region.temperature}</dt>
                  <dd className="text-ink">{data.region.temperature.toFixed(1)}°</dd>
                </div>
              </dl>
            )}
            {!data?.region && (
              <p className="text-xs text-muted">
                lat {selected.lat.toFixed(2)} / lon {selected.lon.toFixed(2)}
              </p>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
