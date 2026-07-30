import { describe, expect, it } from "vitest";

import type { ContributionDraft, Region } from "./types";
import {
  cartesianToLatLon,
  hashString,
  latLonToCartesian,
  nearestRegion,
  splitList,
  validateDraftStep,
} from "./world";

const regions: Region[] = [
  {
    id: "north",
    name: { ar: "الشمال", en: "North" },
    latitude: 62,
    longitude: 10,
    population: 1,
    vitality: 1,
    stability: 1,
    terrainColor: "#fff",
    accentColor: "#fff",
    cityLights: 1,
  },
  {
    id: "south",
    name: { ar: "الجنوب", en: "South" },
    latitude: -55,
    longitude: 20,
    population: 1,
    vitality: 1,
    stability: 1,
    terrainColor: "#fff",
    accentColor: "#fff",
    cityLights: 1,
  },
];

const draft: ContributionDraft = {
  category: "energy",
  title: "شبكة طاقة",
  idea: "A sufficiently detailed idea for validation.",
  regionId: "north",
};

describe("world UI helpers", () => {
  it("maps latitude and longitude through Cartesian coordinates", () => {
    const source = { latitude: 33.2, longitude: 44.4 };
    const result = cartesianToLatLon(
      ...latLonToCartesian(source.latitude, source.longitude),
    );
    expect(result.latitude).toBeCloseTo(source.latitude, 5);
    expect(result.longitude).toBeCloseTo(source.longitude, 5);
  });

  it("selects the nearest region on the globe", () => {
    expect(nearestRegion(regions, 58, 8)?.id).toBe("north");
    expect(nearestRegion(regions, -50, 17)?.id).toBe("south");
  });

  it("provides stable deterministic hashes", () => {
    expect(hashString("aurora")).toBe(hashString("aurora"));
    expect(hashString("aurora")).not.toBe(hashString("delta"));
  });

  it("normalizes comma and line separated lists", () => {
    expect(splitList("one، two\nthree")).toEqual(["one", "two", "three"]);
  });

  it("validates each contribution gate", () => {
    for (let step = 0; step <= 4; step += 1) {
      expect(validateDraftStep(step, draft)).toBe(true);
    }
    expect(validateDraftStep(1, { ...draft, idea: "short" })).toBe(false);
  });
});
