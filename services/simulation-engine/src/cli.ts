import { runTicks, snapshot } from "./index";

const seed = process.env.SIMULATION_SEED ?? process.argv[2] ?? "kawkab-rich-demo";
const ticks = Number(process.env.SIMULATION_TICKS ?? process.argv[3] ?? 12);
const state = runTicks({ seed, resolution: 12 }, ticks);
console.log(JSON.stringify({ seed, ticks, snapshot: snapshot(state), latestEvents: state.events.slice(-5) }, null, 2));
