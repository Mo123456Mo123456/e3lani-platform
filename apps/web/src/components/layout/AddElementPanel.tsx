"use client";

import type { Dictionary } from "@/lib/i18n";
import { useWorldStore } from "@/lib/store";

const categories = [
  { key: "nature", icon: "⌁", color: "nature" },
  { key: "civilization", icon: "⌂", color: "civ" },
  { key: "creature", icon: "◉", color: "migration" },
  { key: "technology", icon: "◇", color: "tech" },
  { key: "resource", icon: "⬡", color: "gold" },
  { key: "hazard", icon: "△", color: "hazard" },
] as const;

export function AddElementPanel({ dictionary }: { dictionary: Dictionary }) {
  const setWizardOpen = useWorldStore((state) => state.setWizardOpen);

  return (
    <aside className="glass-panel add-panel">
      <div className="add-orbit" aria-hidden="true">
        <span>＋</span>
      </div>
      <div className="add-copy">
        <span className="eyebrow">{dictionary.impact}</span>
        <h2>{dictionary.addTitle}</h2>
        <p>{dictionary.addDescription}</p>
      </div>

      <div className="category-grid">
        {categories.map(({ key, icon, color }) => (
          <button className={`category-item color-${color}`} key={key} onClick={() => setWizardOpen(true)}>
            <span>{icon}</span>
            <small>{dictionary.categories[key]}</small>
          </button>
        ))}
      </div>

      <div className="impact-stats">
        <div>
          <span>{dictionary.balance}</span>
          <strong className="green">+2.8%</strong>
        </div>
        <div>
          <span>{dictionary.population}</span>
          <strong>8.42M</strong>
        </div>
        <div>
          <span>{dictionary.knowledge}</span>
          <strong className="cyan">74</strong>
        </div>
      </div>

      <button className="primary-cta" onClick={() => setWizardOpen(true)}>
        <span>{dictionary.addButton}</span>
        <b aria-hidden="true">←</b>
      </button>
      <button className="text-cta" onClick={() => setWizardOpen(true)}>
        {dictionary.whatHappens}
      </button>
    </aside>
  );
}
