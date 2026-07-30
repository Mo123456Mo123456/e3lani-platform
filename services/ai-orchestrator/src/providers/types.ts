import type { StructuredContribution, SimulationEffect } from "@planet/shared-types";

export interface AiProvider {
  readonly name: string;
  readonly sandbox: boolean;
  parseIdea(input: {
    category: string;
    idea: string;
    locale: "ar" | "en";
  }): Promise<StructuredContribution>;
  narrate(input: {
    locale: "ar" | "en";
    contributionName: string;
    effects: SimulationEffect[];
    eventTitles: string[];
  }): Promise<{ narrative: string; narrativeEn: string }>;
}
