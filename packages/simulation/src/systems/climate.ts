import { clamp, clamp01, type SystemContext } from "../context.js";

/**
 * Climate & geology tick: greenhouse forcing, cellular-automata style storms,
 * droughts, wildfires, floods, volcanic eruptions, ice and pollution diffusion.
 * Nothing changes without a driver: every event carries its cause ids.
 */
export function tickClimate(ctx: SystemContext, prevAnomaly: number): number {
  const { grid, state, rng, emit, touch, yearsPerTick } = ctx;
  const cells = state.cells;

  // --- global forcing ------------------------------------------------------
  let pollutionSum = 0;
  let inhabited = 0;
  for (const c of cells) {
    if (c.ownerCivId || c.population > 0) {
      pollutionSum += c.pollution;
      inhabited++;
    }
  }
  const meanPollution = inhabited > 0 ? pollutionSum / inhabited : 0;
  const forcing = (meanPollution * 0.05 - 0.004) * state.laws.climateSensitivityMultiplier;
  state.volcanicAerosol *= Math.pow(0.9, yearsPerTick);
  state.globalTempAnomaly = clamp(
    state.globalTempAnomaly + forcing * yearsPerTick * 10 - state.volcanicAerosol * 0.02,
    -6,
    8,
  );
  const anomalyDelta = state.globalTempAnomaly - prevAnomaly;

  let climateEventEmitted = false;
  if (Math.abs(anomalyDelta) > 0.05 && !climateEventEmitted) {
    const drivers = ctx.recentGlobalCauses();
    emit("CLIMATE_CHANGED", {
      region: null,
      causeIds: drivers.length > 0 ? drivers : [ctx.genesisIds.formed],
      magnitude: Math.min(0.9, Math.abs(anomalyDelta) / 2),
      confidence: 1,
      title: anomalyDelta > 0 ? "Global warming pulse" : "Global cooling pulse",
      summary: `Mean temperature shifted ${anomalyDelta.toFixed(2)}°C driven by pollution ${(meanPollution * 100).toFixed(1)}% and volcanic aerosol ${(state.volcanicAerosol * 100).toFixed(0)}%.`,
      data: { anomalyDelta, meanPollution, aerosol: state.volcanicAerosol },
    });
    climateEventEmitted = true;
  }

  // --- persistent phenomena (contribution-driven climate modifiers) ----------
  for (const ph of state.phenomena) {
    ph.strength *= Math.pow(0.995, yearsPerTick);
    if (ph.strength < 0.05) continue;
    for (const c of cells) {
      if (grid.distance(c.index, ph.centerIndex) > ph.radius) continue;
      c.moisture = clamp01(c.moisture + ph.moistureDelta * 0.03 * ph.strength * yearsPerTick);
      c.temperature += ph.tempDelta * 0.02 * ph.strength * yearsPerTick;
      if (ph.stormBoost > 0 && c.isOcean && rng.chance(ph.stormBoost * 0.01 * yearsPerTick)) {
        c.storm = Math.max(c.storm, 0.5);
      }
    }
  }

  // --- per-cell automata -----------------------------------------------------
  const pollutionNext = new Float32Array(cells.length);
  let eventsLeft = 10;
  for (const c of cells) {
    if (anomalyDelta !== 0) {
      c.temperature += anomalyDelta * (c.isOcean ? 0.6 : 1);
      touch(c.index);
    }
    c.hasIce = c.temperature < -8;

    // pollution diffusion: keep 88%, blend neighbour mean, minus plant uptake
    let nSum = 0;
    let nCount = 0;
    for (const nb of grid.neighbors(c.index)) {
      nSum += cells[nb]!.pollution;
      nCount++;
    }
    const nMean = nCount > 0 ? nSum / nCount : c.pollution;
    const uptake = c.plantCoverage * 0.03 + trackedAbsorption(ctx, c.index);
    pollutionNext[c.index] = clamp01(c.pollution * 0.86 + nMean * 0.12 - uptake);

    if (c.isOcean) {
      // storm genesis over warm water
      c.storm *= 0.7;
      if (c.temperature > 25 && rng.chance(0.0012 * (1 + Math.max(0, state.globalTempAnomaly) * 0.4) * yearsPerTick)) {
        c.storm = rng.range(0.4, 1);
        if (eventsLeft > 0 && c.storm > 0.6) {
          eventsLeft--;
          emit("STORM_FORMED", {
            region: c.index,
            causeIds: causeFor(ctx, c.index),
            magnitude: c.storm * 0.5,
            title: "Oceanic storm formed",
            summary: `Warm surface waters (${c.temperature.toFixed(1)}°C) spun up a storm cell.`,
            data: { intensity: c.storm, temperature: c.temperature },
          });
        }
      }
      continue;
    }

    // storms make landfall: weaken, dump rain, damage coasts
    if (c.storm > 0.05) {
      c.moisture = clamp01(c.moisture + c.storm * 0.1);
      if (c.cityId && c.storm > 0.5) {
        const city = state.cities.get(c.cityId);
        if (city) {
          city.prosperity = clamp01(city.prosperity - c.storm * 0.03);
          city.population = Math.max(50, Math.floor(city.population * (1 - c.storm * 0.005)));
        }
      }
      if (c.river > 0.5 && c.storm > 0.55 && eventsLeft > 0 && rng.chance(0.2)) {
        eventsLeft--;
        emit("FLOOD_OCCURRED", {
          region: c.index,
          causeIds: causeFor(ctx, c.index),
          magnitude: 0.4,
          title: "River flood",
          summary: "Storm rainfall swelled the river beyond its banks.",
          data: { river: c.river, storm: c.storm },
        });
      }
      c.storm *= 0.45;
    }

    // drought accumulation
    if (c.moisture < 0.15 && c.temperature > 10) {
      const was = c.droughtTicks;
      c.droughtTicks += yearsPerTick;
      if (was < 3 && c.droughtTicks >= 3 && eventsLeft > 0) {
        eventsLeft--;
        emit("DROUGHT_STARTED", {
          region: c.index,
          causeIds: causeFor(ctx, c.index),
          magnitude: 0.35,
          title: "Drought begins",
          summary: "Persistent low moisture is stressing soils and rivers.",
          data: { moisture: c.moisture },
        });
      }
    } else if (c.droughtTicks > 0) {
      if (c.droughtTicks >= 3 && eventsLeft > 0) {
        eventsLeft--;
        emit("DROUGHT_ENDED", {
          region: c.index,
          causeIds: causeFor(ctx, c.index),
          magnitude: 0.25,
          title: "Drought breaks",
          summary: "Rains returned to the parched land.",
          data: {},
        });
      }
      c.droughtTicks = 0;
    }

    // wildfire
    if (c.fire > 0) {
      c.fire *= 0.5;
      c.plantCoverage *= 0.6;
      pollutionNext[c.index] = clamp01(pollutionNext[c.index]! + 0.08);
    } else if (c.droughtTicks >= 2 && c.temperature > 24 && c.plantCoverage > 0.3 && rng.chance(0.02 * yearsPerTick)) {
      c.fire = 1;
      if (eventsLeft > 0) {
        eventsLeft--;
        emit("WILDFIRE_STARTED", {
          region: c.index,
          causeIds: causeFor(ctx, c.index),
          magnitude: 0.4,
          title: "Wildfire ignites",
          summary: "Heat and drought turned dry vegetation into fuel.",
          data: { temperature: c.temperature, droughtTicks: c.droughtTicks },
        });
      }
    }

    // volcanism
    if (c.isVolcanic && rng.chance(0.0015 * yearsPerTick)) {
      state.volcanicAerosol = clamp01(state.volcanicAerosol + 0.2);
      c.fertility = clamp01(c.fertility + 0.08);
      c.plantCoverage *= 0.3;
      for (const nb of grid.neighbors(c.index)) {
        const n = cells[nb]!;
        n.plantCoverage *= 0.6;
        n.population = Math.floor(n.population * 0.9);
        touch(nb);
      }
      emit("VOLCANO_ERUPTED", {
        region: c.index,
        causeIds: [ctx.genesisIds.formed],
        magnitude: 0.7,
        title: "Volcanic eruption",
        summary: "Eruption blanketed the region in ash; aerosols will cool the planet for years.",
        data: { aerosol: state.volcanicAerosol },
      });
    }

    // sea-level encroachment on low coasts
    if (!c.isOcean && c.elevation < 0.03 && state.globalTempAnomaly > 1.5 && rng.chance(0.002 * state.globalTempAnomaly * yearsPerTick)) {
      c.isOcean = true;
      c.biome = "ocean";
      c.population = 0;
      c.ownerCivId = null;
      touch(c.index);
      emit("SEA_LEVEL_CHANGED", {
        region: c.index,
        causeIds: causeFor(ctx, c.index),
        magnitude: 0.65,
        title: "Coastline swallowed",
        summary: "Thermal expansion and ice melt flooded low-lying coast.",
        data: { anomaly: state.globalTempAnomaly },
      });
    }
  }

  // storm drift: move storm intensity along wind bands (east at low lat, west at mid)
  const stormNext = new Float32Array(cells.length);
  for (const c of cells) {
    if (c.storm <= 0.05) continue;
    const latAbs = Math.abs(grid.lat(c.index));
    const dir = latAbs < 30 ? 1 : latAbs < 60 ? -1 : 1;
    const nx = grid.index(grid.x(c.index) + dir, grid.y(c.index));
    stormNext[nx] = Math.max(stormNext[nx]!, c.storm * 0.85);
    stormNext[c.index] = Math.max(stormNext[c.index]!, c.storm * 0.3);
  }
  for (let i = 0; i < cells.length; i++) {
    if (stormNext[i]! > (cells[i]!.storm || 0)) cells[i]!.storm = stormNext[i]!;
    cells[i]!.pollution = pollutionNext[i]!;
    if (cells[i]!.pollution > 0.7 && eventsLeft > 0) {
      eventsLeft--;
      emit("POLLUTION_SPIKE", {
        region: i,
        causeIds: causeFor(ctx, i),
        magnitude: 0.5,
        title: "Pollution spike",
        summary: "Air and water quality collapsed in this region.",
        data: { pollution: cells[i]!.pollution },
      });
    }
  }
  return state.globalTempAnomaly;
}

/** weather events trace to local history, else to the oceans that drive weather */
function causeFor(ctx: SystemContext, index: number): string[] {
  const last = ctx.lastEventByCell.get(index);
  return last ? [last] : [ctx.genesisIds.oceans];
}

/** pollution uptake contributed by tracked (contribution-origin) plants */
function trackedAbsorption(ctx: SystemContext, index: number): number {
  let sum = 0;
  for (const plant of ctx.state.plants.values()) {
    if (plant.cells.size > 0 && plant.cells.has(index)) sum += plant.traits.pollutionAbsorption * 0.06;
  }
  return sum;
}
