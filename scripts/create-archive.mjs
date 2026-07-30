import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const artifacts = resolve(root, "artifacts");
const output = resolve(artifacts, "e3lani-platform.zip");

await mkdir(artifacts, { recursive: true });

await new Promise((resolvePromise, reject) => {
  const archive = spawn(
    "git",
    ["archive", "--format=zip", `--output=${output}`, "HEAD"],
    { cwd: root, stdio: "inherit" },
  );
  archive.once("error", reject);
  archive.once("close", (code) => {
    if (code === 0) resolvePromise();
    else reject(new Error(`git archive exited with code ${code}`));
  });
});

console.info(output);
