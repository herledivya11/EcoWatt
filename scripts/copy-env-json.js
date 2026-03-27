import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

async function main() {
  const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
  const repoRoot = path.resolve(scriptsDir, "..");
  const frontendDir = path.join(repoRoot, "src", "frontend");
  const srcPath = path.join(frontendDir, "env.json");
  const distDir = path.join(frontendDir, "dist");
  const destPath = path.join(distDir, "env.json");

  await fs.mkdir(distDir, { recursive: true });
  await fs.copyFile(srcPath, destPath);
}

await main();
