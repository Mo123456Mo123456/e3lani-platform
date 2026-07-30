"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export function BottomTimeline() {
  const locale = usePlanetStore((s) => s.locale);
  const planetId = usePlanetStore((s) => s.planetId);
  const tick = usePlanetStore((s) => s.tick);
  const maxTick = usePlanetStore((s) => s.maxTick);
  const playing = usePlanetStore((s) => s.playing);
  const setTick = usePlanetStore((s) => s.setTick);
  const setPlaying = usePlanetStore((s) => s.setPlaying);
  const setTimelinePosition = usePlanetStore((s) => s.setTimelinePosition);
  const dict = t(locale);

  const { data } = useQuery({
    queryKey: ["timeline", planetId],
    queryFn: () => api.getTimeline(planetId!),
    enabled: !!planetId,
  });

  const snapshots = data?.snapshots || [];
  const eras =
    snapshots.length > 0
      ? snapshots
      : Array.from({ length: Math.min(8, Math.max(1, maxTick)) }, (_, i) => ({
          id: `era-${i}`,
          tick: Math.round((i / 7) * maxTick) || i,
          label: locale === "ar" ? `عصر ${i + 1}` : `Era ${i + 1}`,
        }));

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const next = tick >= maxTick ? 0 : tick + 1;
      setTick(next);
      setTimelinePosition(maxTick ? next / maxTick : 0);
    }, 800);
    return () => clearInterval(id);
  }, [playing, tick, maxTick, setTick, setTimelinePosition]);

  return (
    <div className="glass-panel flex flex-col gap-2 px-3 py-2 sm:flex-row sm:items-center">
      <div className="flex shrink-0 items-center gap-2">
        <span className="text-xs font-semibold text-ink">{dict.timeline.title}</span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => setPlaying(!playing)}
        >
          {playing ? dict.timeline.pause : dict.timeline.play}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTick(maxTick);
            setTimelinePosition(1);
            setPlaying(false);
          }}
        >
          {dict.timeline.jumpPresent}
        </Button>
        <Badge tone="cyan">
          {dict.timeline.present} · t{tick}
        </Badge>
      </div>

      <div className="relative min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={Math.max(maxTick, 1)}
          value={tick}
          onChange={(e) => {
            const v = Number(e.target.value);
            setTick(v);
            setTimelinePosition(maxTick ? v / maxTick : 0);
          }}
          className="mb-2 w-full accent-cyan"
        />
        <div className="scrollbar-thin flex gap-2 overflow-x-auto pb-1">
          {eras.map((era) => (
            <button
              key={era.id}
              type="button"
              onClick={() => {
                setTick(era.tick);
                setTimelinePosition(maxTick ? era.tick / maxTick : 0);
              }}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] transition ${
                Math.abs(tick - era.tick) <= 1
                  ? "border-cyan/50 bg-cyan/15 text-cyan"
                  : "border-white/10 text-muted hover:border-cyan/30"
              }`}
            >
              {era.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
