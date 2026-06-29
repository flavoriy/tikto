import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const serviceNames = new Set(["profile", "tasks", "calendar"]);
const requested = process.argv.slice(2);
const selected = requested.length ? requested : [...serviceNames];
const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, "..");

for (const service of selected) {
  if (!serviceNames.has(service)) {
    throw new Error(`Unknown Prisma-backed service: ${service}`);
  }

  const source = path.join(root, "services", service, "src", "generated", "prisma");
  const destination = path.join(root, "dist-services", "services", service, "src", "generated", "prisma");

  if (!fs.existsSync(source)) {
    throw new Error(
      `Missing generated Prisma client for ${service}. Run npm run service:${service}:build or npm run services:build first.`,
    );
  }

  fs.rmSync(destination, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.cpSync(source, destination, { recursive: true });
  console.log(`Copied ${service} Prisma client to ${path.relative(root, destination)}`);
}
