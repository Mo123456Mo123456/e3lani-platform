"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Dictionary, Locale } from "@/lib/i18n";
import { TopNav } from "./TopNav";

type PageKind = "explore" | "timeline" | "profile";

const accents = ["nature", "civ", "tech", "migration", "hazard", "war"];

export function InteriorPage({
  kind,
  locale,
  dictionary,
}: {
  kind: PageKind;
  locale: Locale;
  dictionary: Dictionary;
}) {
  const content = kind === "explore"
    ? dictionary.explore
    : kind === "timeline"
      ? dictionary.timelinePage
      : dictionary.profilePage;

  const query = useQuery({
    queryKey: [kind],
    queryFn: () => api<unknown[]>(kind === "profile" ? "/users/me/contributions" : `/${kind}`),
  });

  return (
    <main className="interior-shell">
      <TopNav locale={locale} dictionary={dictionary} />
      <header className="interior-hero">
        <span className="eyebrow">PLANET K-07 / {kind.toUpperCase()}</span>
        <h1>{content.title}</h1>
        <p>{content.subtitle}</p>
      </header>
      <section className="interior-grid">
        {accents.map((accent, index) => (
          <article className={`glass-panel data-card accent-${accent}`} key={accent}>
            <span>0{index + 1}</span>
            <div className="data-orb" />
            <h2>{Object.values(dictionary.categories)[index]}</h2>
            <p>{query.isError ? dictionary.fallback : `${12 + index * 17} ${dictionary.impact}`}</p>
            <i style={{ width: `${38 + index * 9}%` }} />
          </article>
        ))}
      </section>
    </main>
  );
}
