import { access } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";

const required = ["DATABASE_URL", "JWT_SECRET", "VITE_APP_ID"];
for (const key of required) if (!process.env[key]?.trim()) throw new Error(`PRODUCTION_ENV_MISSING:${key}`);
if (process.env.REQUIRE_MEDIA_STORAGE !== "false") {
  for (const key of ["BUILT_IN_FORGE_API_URL", "BUILT_IN_FORGE_API_KEY"]) {
    if (!process.env[key]?.trim()) throw new Error(`PRODUCTION_ENV_MISSING:${key}`);
  }
}
const ffmpeg = process.env.FFMPEG_PATH?.trim() || "/usr/bin/ffmpeg";
await access(ffmpeg, constants.X_OK).catch(() => { throw new Error("FFMPEG_NOT_AVAILABLE"); });

await new Promise((resolve, reject) => {
  const migration = spawn(process.execPath, ["scripts/verify-production-schema.mjs", "--apply"], { stdio: "inherit", env: process.env });
  migration.once("error", reject);
  migration.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`SCHEMA_VERIFICATION_FAILED:${code}`)));
});

const app = spawn(process.execPath, ["dist/index.js"], { stdio: "inherit", env: process.env });
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => app.kill(signal));
app.once("error", (error) => { throw error; });
app.once("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
