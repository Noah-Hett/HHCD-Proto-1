import { access, cp, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const name = process.argv[2]?.trim();

if (!name || !/^[a-z][a-z0-9-]*$/.test(name)) {
  console.error("Usage: pnpm new-app your-viz-name");
  console.error("Name must be lowercase letters, numbers, and hyphens.");
  process.exit(1);
}

const dest = resolve(root, "apps", name);
const starter = resolve(root, "apps", "_starter");
const manifestPath = resolve(root, "apps", "manifest.json");

try {
  await access(dest, constants.F_OK);
  console.error(`apps/${name} already exists`);
  process.exit(1);
} catch {
  // Destination is free.
}

await cp(starter, dest, {
  recursive: true,
  filter: (source) =>
    !source.split(/[\\/]/).some((part) => part === "node_modules" || part === "dist"),
});

const pkgPath = resolve(dest, "package.json");
const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
pkg.name = `@hhcd/${name}`;
await writeFile(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const htmlPath = resolve(dest, "index.html");
const html = await readFile(htmlPath, "utf8");
await writeFile(
  htmlPath,
  html.replace("New visualisation — HHCD Report Atlas", `${name} — HHCD Report Atlas`),
);

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.apps.some((app) => app.id === name)) {
  console.error(`${name} is already in apps/manifest.json`);
  process.exit(1);
}
manifest.apps.push({
  id: name,
  title: name.replace(/-/g, " "),
  goal: "Describe the question this visualisation answers.",
  owner: "claim this",
  status: "draft",
});
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Created apps/${name} and added it to apps/manifest.json`);
console.log("Next:");
console.log("  pnpm install");
console.log(`  pnpm --filter @hhcd/${name} dev`);
console.log("Open a pull request and Vercel will post a preview URL.");
console.log(`On production it will live at /${name}/`);
