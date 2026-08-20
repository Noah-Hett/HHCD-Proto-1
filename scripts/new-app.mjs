import { access, cp, readFile, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

function usage(message) {
  if (message) console.error(message);
  console.error('Usage: pnpm new-app <id> [--title "..."] [--goal "..."] [--owner "..."]');
  console.error('   or: pnpm new-app -- <id> --title "..." --goal "..." --owner "..."');
  console.error("Name must be lowercase letters, numbers, and hyphens.");
  process.exit(1);
}

function parseArgs(argv) {
  const flags = { title: undefined, goal: undefined, owner: undefined };
  const positionals = [];

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const eq = arg.indexOf("=");
    const flagName = arg.startsWith("--") && eq !== -1 ? arg.slice(0, eq) : arg;
    const inline = arg.startsWith("--") && eq !== -1 ? arg.slice(eq + 1) : undefined;

    if (flagName === "--title" || flagName === "--goal" || flagName === "--owner") {
      const key = flagName.slice(2);
      const value = inline ?? argv[i + 1];
      if (inline === undefined) i += 1;
      if (value === undefined || value === "" || (inline === undefined && value.startsWith("--"))) {
        usage(`${flagName} requires a value`);
      }
      flags[key] = value;
      continue;
    }

    if (arg === "--") {
      continue;
    }

    if (arg.startsWith("--")) {
      usage(`Unknown flag: ${arg}`);
    }

    positionals.push(arg);
  }

  if (positionals.length !== 1) {
    usage(positionals.length === 0 ? "Missing app id." : "Expected a single app id.");
  }

  return { name: positionals[0], ...flags };
}

const { name, title, goal, owner } = parseArgs(process.argv.slice(2));

if (!/^[a-z][a-z0-9-]*$/.test(name)) {
  usage();
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

const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
if (manifest.apps.some((app) => app.id === name)) {
  console.error(`${name} is already in apps/manifest.json`);
  process.exit(1);
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
// Contract with apps/_starter/index.html — keep this exact title string in the starter.
await writeFile(
  htmlPath,
  html.replace("New visualisation — HHCD", `${name} — HHCD`),
);

manifest.apps.push({
  id: name,
  title: title ?? name.replace(/-/g, " "),
  goal: goal ?? "Describe the question this visualisation answers.",
  owner: owner ?? "claim this",
  status: "draft",
});
await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Created apps/${name} and added it to apps/manifest.json`);
console.log("Next:");
console.log("  pnpm install");
console.log(`  pnpm --filter @hhcd/${name} dev`);
console.log(
  `If this was requested by a cloud agent, implement the visualisation in apps/${name}/src/App.jsx next.`,
);
console.log("Open a pull request and Vercel will post a preview URL.");
console.log(`On production it will live at /${name}/`);
