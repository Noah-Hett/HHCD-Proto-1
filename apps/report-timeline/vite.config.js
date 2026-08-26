import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const appRoot = resolve(fileURLToPath(new URL(".", import.meta.url)));
const repoRoot = resolve(appRoot, "../..");

export default defineConfig({
  plugins: [react()],
  base: "./",
  server: {
    fs: {
      allow: [repoRoot],
    },
  },
});
