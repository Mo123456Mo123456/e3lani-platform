"use client";

import { create } from "zustand";

import type { Language, Quality } from "./types";

interface UIState {
  language: Language;
  quality: Quality;
  selectedRegionId: string | null;
  highlightedRegionId: string | null;
  contributionOpen: boolean;
  successMessage: string | null;
  setLanguage: (language: Language) => void;
  setQuality: (quality: Quality) => void;
  selectRegion: (regionId: string | null) => void;
  highlightRegion: (regionId: string | null) => void;
  setContributionOpen: (open: boolean) => void;
  setSuccessMessage: (message: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  language: "ar",
  quality: "high",
  selectedRegionId: "arabian-nexus",
  highlightedRegionId: null,
  contributionOpen: false,
  successMessage: null,
  setLanguage: (language) => set({ language }),
  setQuality: (quality) => set({ quality }),
  selectRegion: (selectedRegionId) => set({ selectedRegionId }),
  highlightRegion: (highlightedRegionId) => set({ highlightedRegionId }),
  setContributionOpen: (contributionOpen) => set({ contributionOpen }),
  setSuccessMessage: (successMessage) => set({ successMessage }),
}));
