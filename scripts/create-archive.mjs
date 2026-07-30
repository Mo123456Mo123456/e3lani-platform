import { mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const releaseDirectory = resolve(root, "release");
const archive = resolve(releaseDirectory, "e3lani-platform.zip");

mkdirSync(releaseDirectory, { recursive: true });
rmSync(archive, { force: true });

const paths = [
  "apps",
  "services",
  "packages",
  "docs",
  "scripts/create-archive.mjs",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
  "docker-compose.yml",
  ".env.example",
  ".gitignore",
  "README.md",
];

const result = spawnSync(
  "zip",
  [
    "-q",
    "-r",
    archive,
    ...paths,
    "-x",
    "*/node_modules/*",
    "*/dist/*",
    "*/.next/*",
    "*/.expo/*",
    "*/.turbo/*",
    "*.tsbuildinfo",
    "*.DS_Store",
  ],
  { cwd: root, stdio: "inherit" },
);

if (result.status !== 0) {
  throw new Error("Failed to create release/e3lani-platform.zip; install the zip utility.");
}

console.info(archive);
