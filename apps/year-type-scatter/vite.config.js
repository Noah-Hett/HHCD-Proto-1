import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");
const reportsCsv = resolve(repoRoot, "data/reports.csv");

function reportsCsvPlugin() {
  const virtual = "\0hhcd-reports-csv";
  return {
    name: "hhcd-reports-csv",
    resolveId(id) {
      if (id === "@hhcd-reports-csv" || id.startsWith("@hhcd-reports-csv?")) {
        return virtual;
      }
    },
    load(id) {
      if (id === virtual) {
        return `export default ${JSON.stringify(readFileSync(reportsCsv, "utf8"))}`;
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), reportsCsvPlugin()],
  base: "./",
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
