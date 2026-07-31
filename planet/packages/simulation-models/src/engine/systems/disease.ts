import { WorldEventType } from "@planet/shared-types";
import { chance, random } from "../../rng.js";
import { neighbors4 } from "../../math.js";
import { emitEvent } from "../events.js";
import { nextId, type WorldState } from "../types.js";
import { speciesName } from "../names.js";

/**
 * Disease dynamics: outbreaks emerge from dense, connected, unhealthy cities;
 * pathogens spread along trade routes and to neighbouring cells; health
 * investment and low virulence end outbreaks.
 */
export function applyDiseases(world: WorldState): void {
  // New spontaneous outbreaks (contribution diseases enter via applyContribution).
  if (world.tick % 7 === 0 && chance(world.rng, "disease", 0.15)) {
    const crowded = world.cities.filter((c) => !c.fallen && c.population > 400);
    if (crowded.length > 0) {
      const city = crowded[Math.floor(random(world.rng, "disease") * crowded.length)]!;
      const civ = world.civs.find((c) => c.id === city.civId);
      const disease = {
        id: nextId(world, "disease"),
        name: speciesName(world.rng, "disease") + " fever",
        virulence: 0.2 + random(world.rng, "disease") * 0.5,
        lethality: 0.02 + random(world.rng, "disease") * 0.1,
        cells: [city.cell],
        startedTick: world.tick,
        active: true,
      };
      world.diseases.push(disease);
      if (civ) civ.stability = Math.max(0, civ.stability - 0.05);
      emitEvent(world, {
        type: WorldEventType.DiseaseOutbreak,
        cellIndex: city.cell,
        civIds: civ ? [civ.id] : [],
        payload: { name: disease.name, origin: city.name },
        importance: 0.6,
      });
    }
  }

  for (const d of world.diseases) {
    if (!d.active) continue;
    // Spread: neighbours + trade routes touching infected cells.
    const newCells: number[] = [];
    for (const cell of d.cells) {
      for (const n of neighbors4(world.grid.width, world.grid.height, cell)) {
        if (!d.cells.includes(n) && !newCells.includes(n) && chance(world.rng, "disease", d.virulence * 0.3)) {
          newCells.push(n);
        }
      }
    }
    for (const route of world.tradeRoutes) {
      if (!route.active) continue;
      const fromCity = world.cities.find((c) => c.id === route.fromCity);
      const toCity = world.cities.find((c) => c.id === route.toCity);
      if (!fromCity || !toCity) continue;
      const fromInfected = d.cells.includes(fromCity.cell);
      const toInfected = d.cells.includes(toCity.cell);
      if (fromInfected !== toInfected && chance(world.rng, "disease", d.virulence * 0.5)) {
        newCells.push(fromInfected ? toCity.cell : fromCity.cell);
      }
    }
    d.cells.push(...newCells.slice(0, 8));

    // Mortality in affected cities.
    for (const city of world.cities) {
      if (city.fallen || !d.cells.includes(city.cell)) continue;
      const deaths = city.population * d.lethality * 0.1;
      city.population = Math.max(0, city.population - deaths);
      const civ = world.civs.find((c) => c.id === city.civId);
      if (civ) {
        civ.population = Math.max(0, civ.population - deaths);
        civ.health = Math.min(1, civ.health + 0.001); // societies adapt
      }
    }

    // Burn-out: virulence decays, recovery outpaces spread.
    d.virulence *= 0.995;
    if (d.virulence < 0.05 || world.tick - d.startedTick > 400) {
      d.active = false;
    }
  }
  if (world.diseases.length > 40) {
    world.diseases = world.diseases.filter((d) => d.active).slice(-20);
  }
}
