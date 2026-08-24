import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const repoRoot = resolve(fileURLToPath(new URL(".", import.meta.url)), "../..");

export default defineConfig({
  plugins: [react()],
  base: "./",
  resolve: {
    alias: {
      "@hhcd-reports-csv": resolve(repoRoot, "data/reports.csv"),
    },
  },
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
