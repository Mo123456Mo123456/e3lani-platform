import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const createAd = readFileSync(
  new URL("../app/create-ad.tsx", import.meta.url).pathname,
  "utf8",
);
const citySeed = readFileSync(
  new URL("../scripts/seed-country-city-links.mjs", import.meta.url).pathname,
  "utf8",
);
const packageJson = readFileSync(
  new URL("../package.json", import.meta.url).pathname,
  "utf8",
);

describe("country-specific city publishing", () => {
  it("loads cities from the selected country instead of the global catalog", () => {
    expect(createAd).toContain("trpc.countries.cities.useQuery");
    expect(createAd).toContain("{ countryCode: adCountry }");
    expect(createAd).toContain("const availableCities = countryCitiesQuery.data");
    expect(createAd).toContain("(availableCities ?? []).map");
    expect(createAd).not.toContain("{productData.cities.map");
  });

  it("keeps custom city support country-scoped", () => {
    expect(createAd).toContain('cityId.startsWith("other")');
    expect(createAd).toContain("setCityId(\"\")");
    expect(createAd).toContain("setCustomCity(\"\")");
    expect(createAd).toContain("cityCode: cityId");
  });

  it("links seeded Saudi, Emirati and Egyptian cities before launch verification", () => {
    expect(citySeed).toContain('["riyadh", "SA"]');
    expect(citySeed).toContain('["uae", "AE"]');
    expect(citySeed).toContain('["egypt", "EG"]');
    expect(citySeed).toContain("UPDATE cities SET countryId = ?");
    expect(packageJson).toContain(
      "node scripts/seed-central-data.mjs && node scripts/seed-country-city-links.mjs",
    );
  });
});
