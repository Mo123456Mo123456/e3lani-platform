import { describe, expect, it } from "vitest";
import { latLonToVec3, uvToLatLon } from "./format";
import { overlayColor } from "../components/globe/painter";

describe("geo math", () => {
  it("uv ↔ lat/lon round-trips", () => {
    const { lat, lon } = uvToLatLon(0.75, 0.25);
    expect(lat).toBeCloseTo(45);
    expect(lon).toBeCloseTo(90);
  });

  it("lat/lon → vec3 lands on the unit sphere", () => {
    const [x, y, z] = latLonToVec3(30, 120, 1);
    expect(Math.sqrt(x * x + y * y + z * z)).toBeCloseTo(1, 5);
  });

  it("equator/prime meridian points along +x in our mapping", () => {
    const [x, y, z] = latLonToVec3(0, 0, 1);
    expect(x).toBeCloseTo(1, 5);
    expect(y).toBeCloseTo(0, 5);
    expect(z).toBeCloseTo(0, 5);
  });
});

describe("overlay colors", () => {
  it("returns transparent for empty civilization cells", () => {
    expect(overlayColor("civilization", 0)[3]).toBe(0);
  });
  it("conflict cells glow red", () => {
    const [r, g, b, a] = overlayColor("conflict", 1);
    expect(r).toBeGreaterThan(200);
    expect(a).toBeGreaterThan(0.5);
  });
});
