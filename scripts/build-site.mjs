import { build } from "vite";
import { mkdir, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const appsDir = resolve(root, "apps");
const distDir = resolve(root, "dist");
const manifest = (
  await import(pathToFileURL(resolve(appsDir, "manifest.json")).href, {
    with: { type: "json" },
  })
).default;

const skip = new Set(["_starter"]);
const folders = (await readdir(appsDir, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory() && !skip.has(entry.name))
  .map((entry) => entry.name);

if (!folders.includes("gallery")) {
  throw new Error("apps/gallery is required as the hosted index");
}

const extra = folders.filter((name) => name !== "gallery");
const expected = new Set(manifest.apps.map((app) => app.id));
for (const id of expected) {
  if (!folders.includes(id)) {
    throw new Error(`manifest lists "${id}" but apps/${id} is missing`);
  }
}

await mkdir(distDir, { recursive: true });

await build({
  root: resolve(appsDir, "gallery"),
  base: "./",
  build: {
    outDir: distDir,
    emptyOutDir: true,
  },
});

for (const name of extra) {
  await build({
    root: resolve(appsDir, name),
    base: "./",
    build: {
      outDir: resolve(distDir, name),
      emptyOutDir: true,
    },
  });
}

await writeFile(resolve(distDir, ".nojekyll"), "");
console.log(`built gallery + ${extra.length} visualisations into dist/`);
