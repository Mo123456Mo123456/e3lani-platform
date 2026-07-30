import "dotenv/config";
import bcrypt from "bcrypt";
import { Repository } from "./db/repository.js";

const repository = new Repository();

try {
  const result = await repository.seed({
    adminPasswordHash: await bcrypt.hash("PlanetAdmin!2026", 12),
    explorerPasswordHash: await bcrypt.hash("Explorer!2026", 12),
  });
  console.log(
    JSON.stringify(
      {
        mode: repository.memoryMode ? "memory" : "postgres",
        users: [result.admin.email, result.explorer.email],
        planet: { id: result.planet.id, seed: result.planet.seed },
      },
      null,
      2,
    ),
  );
} finally {
  await repository.close();
}
