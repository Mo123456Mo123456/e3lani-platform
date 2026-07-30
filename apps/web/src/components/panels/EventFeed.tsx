"use client";

import { eventColorOf } from "@kawkab/ui";
import { useWorldStore } from "@/lib/store";
import { formatNumber } from "@/lib/format";
import { useT } from "../LocaleProvider";

/** left panel: the live event feed */
export function EventFeed() {
  const { t, locale } = useT();
  const feed = useWorldStore((s) => s.feed);
  const selectRegion = useWorldStore((s) => s.selectRegion);

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-line text-sm font-semibold flex items-center gap-2">
        <span className="w-1.5 h-1.5 rounded-full bg-war animate-pulse" />
        {t("home.liveFeed")}
      </div>
      <div className="flex-1 overflow-y-auto">
        {feed.length === 0 && <div className="p-4 text-dim text-xs">{t("loading")}</div>}
        {feed.map((ev) => (
          <button
            key={ev.id}
            onClick={() => {
              if (ev.region?.index !== undefined) selectRegion(ev.region.index, null);
            }}
            className="w-full text-start px-3 py-2 border-b border-line/50 hover:bg-panelAlt transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: eventColorOf(ev.type) }} />
              <span className="text-[13px] font-medium truncate flex-1">{ev.title}</span>
              <span className="text-[10px] text-dim whitespace-nowrap">{formatNumber(ev.simYear, locale)}</span>
            </div>
            <div className="text-[11px] text-dim mt-0.5 line-clamp-2">{ev.summary}</div>
            <div className="flex gap-1 mt-1">
              <span className="text-[9px] px-1 rounded bg-line/60 text-dim">{ev.type}</span>
              {ev.contributionId && <span className="text-[9px] px-1 rounded bg-tech/20 text-tech">★</span>}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
