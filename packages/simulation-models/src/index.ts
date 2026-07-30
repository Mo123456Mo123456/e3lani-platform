export { SeededRNG, createRng } from "./seeded-rng.js";
export {
  NoiseGenerator,
  noise2D,
  noise3D,
  fbm2D,
  ridged2D,
  worley2D,
} from "./noise.js";
export {
  ProceduralPlanetGenerator,
  classifyBiome,
  biomeToId,
  idToBiome,
  BIOME_LIST,
  type PlanetTerrainData,
  type RiverPath,
  type TectonicPlate,
  type BiomeId,
  type RegionSummary,
} from "./world-generator.js";
export {
  World,
  createStore,
  type EntityId,
  type ComponentStore,
  type Position,
  type Population,
  type SpeciesTraitsComponent,
  type CivStats,
  type ResourceStock,
  type ClimateCell,
  type System,
  type WorldSnapshot,
} from "./ecs.js";
export {
  CausalGraph,
  type CausalNode,
  type CausalEdge,
  type CausalEdgeType,
  type CausalPathExplanation,
} from "./causal-graph.js";
export {
  SimulationTickEngine,
  type WorldEventRecord,
  type UserElementInput,
  type EngineState,
  type SimSpecies,
  type SimCiv,
} from "./tick-engine.js";
export {
  habitatSuitability,
  carryingCapacity,
  populationGrowth,
  lotkaVolterraStep,
  buildFoodWeb,
  predationPressure,
  type HabitatContext,
  type FoodWeb,
  type FoodWebEdge,
} from "./ecology.js";
export {
  scoreActions,
  chooseAction,
  warProbability,
  resolveWar,
  type CivAction,
  type CivState,
  type CivRelation,
  type ActionScore,
  type WarForces,
  type WarOutcome,
} from "./civilization.js";
export {
  createClimateGrid,
  climateStep,
  DEFAULT_CLIMATE_THRESHOLDS,
  type ClimateGrid,
  type ClimateThresholds,
} from "./climate.js";
export {
  priceFromSupplyDemand,
  scarcity,
  tradeRouteCost,
  updateMarket,
  deliveredPrice,
  type MarketGood,
  type RegionNode,
  type TradePath,
} from "./economy.js";
export {
  balanceUserElement,
  type ElementTraits,
  type BalanceResult,
} from "./balance.js";
