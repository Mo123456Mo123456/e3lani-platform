import "dotenv/config";
import { buildApp } from "./app.js";

const app = await buildApp({ logger: true });

try {
  await app.listen({
    port: Number(process.env.PORT ?? 4200),
    host: process.env.HOST ?? "0.0.0.0",
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
