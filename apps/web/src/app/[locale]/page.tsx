"use client";

import { GlobeView } from "@/components/globe/GlobeView";
import { ContributionPanel } from "@/components/panels/ContributionPanel";
import { EventFeed } from "@/components/panels/EventFeed";
import { RegionInspector } from "@/components/panels/RegionInspector";
import { StatsStrip } from "@/components/panels/StatsStrip";
import { TimelineBar } from "@/components/panels/TimelineBar";
import { useT } from "@/components/LocaleProvider";
import { usePlanetBootstrap } from "@/lib/usePlanetBootstrap";

export default function HomePage() {
  const { t } = useT();
  const { loading, error } = usePlanetBootstrap();

  if (error) {
    return (
      <div className="h-[calc(100vh-3rem)] flex items-center justify-center text-dim text-sm px-6 text-center">
        {t("error.offline")}
      </div>
    );
  }
  if (loading) {
    return (
      <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
        <div className="text-dim text-sm animate-pulse">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden">
      {/* left: live event feed */}
      <aside className="hidden md:block w-72 lg:w-80 border-e border-line bg-panel/70 shrink-0">
        <EventFeed />
      </aside>

      {/* center: the living planet */}
      <section className="relative flex-1 flex flex-col min-w-0">
        <div className="relative flex-1 min-h-0">
          <GlobeView />
          <RegionInspector />
        </div>
        <StatsStrip />
        <TimelineBar />
      </section>

      {/* right: contribution panel */}
      <aside className="hidden lg:block w-72 border-s border-line bg-panel/70 shrink-0">
        <ContributionPanel />
      </aside>
    </div>
  );
}
