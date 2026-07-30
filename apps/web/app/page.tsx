"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { LeftEventLog } from "@/components/layout/LeftEventLog";
import { RightImpactPanel } from "@/components/layout/RightImpactPanel";
import { BottomTimeline } from "@/components/layout/BottomTimeline";
import { LayerControls } from "@/components/planet/LayerControls";
import { RegionDrawer } from "@/components/region/RegionDrawer";

const PlanetCanvas = dynamic(
  () => import("@/components/planet/PlanetCanvas").then((m) => m.PlanetCanvas),
  { ssr: false, loading: () => <div className="absolute inset-0 animate-pulse bg-slate-950/40" /> },
);

export default function CommandCenterPage() {
  const locale = usePlanetStore((s) => s.locale);
  const setPlanet = usePlanetStore((s) => s.setPlanet);
  const planetName = usePlanetStore((s) => s.planetName);
  const dict = t(locale);

  const { data } = useQuery({
    queryKey: ["planets"],
    queryFn: () => api.getPlanets(),
  });

  useEffect(() => {
    const p = data?.planets?.[0];
    if (p) setPlanet({ id: p.id, seed: p.seed, name: p.name, tick: p.currentTick });
  }, [data, setPlanet]);

  return (
    <div className="relative flex min-h-[calc(100vh-6.5rem)] flex-col">
      {/* Hero brand band */}
      <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col items-center px-4 text-center">
        <motion.h1
          className="text-2xl font-bold tracking-tight text-gradient-cyan sm:text-4xl"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          {dict.brand}
        </motion.h1>
        <motion.p
          className="mt-1 max-w-xl text-sm text-muted sm:text-base"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25, duration: 0.7 }}
        >
          {dict.slogan}
        </motion.p>
        <motion.span
          className="mt-2 text-[11px] text-cyan/70"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {planetName}
        </motion.span>
      </div>

      <div className="relative grid flex-1 grid-cols-1 gap-3 p-3 lg:grid-cols-[260px_1fr_260px] xl:grid-cols-[280px_1fr_280px]">
        <div className="order-2 z-10 lg:order-1">
          <LeftEventLog />
        </div>

        <div className="relative order-1 min-h-[420px] overflow-hidden rounded-xl border border-cyan/20 bg-slate-950/30 lg:order-2 lg:min-h-0">
          <PlanetCanvas />
          <LayerControls />
          <RegionDrawer />
        </div>

        <div className="order-3 z-10">
          <RightImpactPanel />
        </div>
      </div>

      <div className="px-3 pb-3">
        <BottomTimeline />
      </div>
    </div>
  );
}
