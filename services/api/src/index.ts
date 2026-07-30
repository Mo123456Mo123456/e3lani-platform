import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { pathToFileURL } from "node:url";

export { createApp } from "./app.js";

async function main() {
  const config = loadConfig();
  const app = await createApp({ config });
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, "Shutting down");
    await app.close();
    process.exit(0);
  };
  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
  await app.listen({ host: config.host, port: config.port });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
