"use client";

import { useRouter } from "next/navigation";
import { Panel } from "@kawkab/ui";
import { QUALITY_PRESETS, type QualityPreset } from "@kawkab/shared-types";
import { useWorldStore } from "@/lib/store";
import { useT } from "@/components/LocaleProvider";
import type { MessageKey } from "@/i18n";

export default function SettingsPage() {
  const { t, locale } = useT();
  const router = useRouter();
  const quality = useWorldStore((s) => s.quality);
  const setQuality = useWorldStore((s) => s.setQuality);
  const autoQuality = useWorldStore((s) => s.autoQuality);
  const setAutoQuality = useWorldStore((s) => s.setAutoQuality);
  const heavyEffects = useWorldStore((s) => s.heavyEffects);
  const setHeavyEffects = useWorldStore((s) => s.setHeavyEffects);

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <h1 className="text-xl font-bold">{t("settings.title")}</h1>
      <Panel title={t("settings.quality")}>
        <div className="grid grid-cols-2 gap-2">
          {QUALITY_PRESETS.map((q: QualityPreset) => (
            <button
              key={q}
              onClick={() => setQuality(q)}
              className={`rounded border px-3 py-2 text-sm ${quality === q ? "border-tech text-tech bg-tech/10" : "border-line text-dim"}`}
            >
              {t(`quality.${q}` as MessageKey)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 mt-3 text-sm text-dim cursor-pointer">
          <input type="checkbox" checked={autoQuality} onChange={(e) => setAutoQuality(e.target.checked)} className="accent-sky-400" />
          {t("settings.auto")}
        </label>
        <label className="flex items-center gap-2 mt-2 text-sm text-dim cursor-pointer">
          <input type="checkbox" checked={heavyEffects} onChange={(e) => setHeavyEffects(e.target.checked)} className="accent-sky-400" />
          {t("settings.effects")}
        </label>
      </Panel>
      <Panel title={t("settings.language")}>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              document.cookie = "kawkab_locale=ar;path=/;max-age=31536000";
              router.refresh();
            }}
            className={`rounded border px-3 py-2 text-sm ${locale === "ar" ? "border-tech text-tech bg-tech/10" : "border-line text-dim"}`}
          >
            العربية (RTL)
          </button>
          <button
            onClick={() => {
              document.cookie = "kawkab_locale=en;path=/;max-age=31536000";
              router.refresh();
            }}
            className={`rounded border px-3 py-2 text-sm ${locale === "en" ? "border-tech text-tech bg-tech/10" : "border-line text-dim"}`}
          >
            English (LTR)
          </button>
        </div>
      </Panel>
    </div>
  );
}
