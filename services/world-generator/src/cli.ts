import { generateWorld, worldFingerprint } from "@planet/simulation-models";

const seed = Number(process.argv[2] ?? 42424242);
const world = generateWorld({ planetId: "cli", seed });
console.log(
  JSON.stringify(
    {
      seed,
      fingerprint: worldFingerprint(world),
      civilizations: world.civilizations.length,
      cities: world.cities.length,
      resources: world.resources.length,
      species: world.species.length,
      plants: world.plants.length,
      technologies: world.technologies.length,
    },
    null,
    2,
  ),
);
