"use client";

import clsx from "clsx";
import { usePlanetStore } from "@/lib/planet-store";
import { t } from "@/lib/i18n";
import { Badge } from "@/components/ui/Badge";

const CATS = ["species", "plant", "element", "invention", "event", "culture"] as const;

const tones = {
  species: "green",
  plant: "cyan",
  element: "muted",
  invention: "gold",
  event: "orange",
  culture: "purple",
} as const;

export function CategoryPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (v: string) => void;
}) {
  const locale = usePlanetStore((s) => s.locale);
  const dict = t(locale);

  return (
    <div>
      <p className="mb-3 text-sm text-muted">{dict.contribute.pickCategory}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {CATS.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => onChange(c)}
            className={clsx(
              "rounded-xl border p-4 text-start transition",
              value === c
                ? "border-cyan/50 bg-cyan/10 shadow-glow"
                : "border-white/10 bg-white/[0.03] hover:border-cyan/30",
            )}
          >
            <Badge tone={tones[c]}>{dict.categories[c]}</Badge>
          </button>
        ))}
      </div>
    </div>
  );
}
