import { defineConfig } from "vite";
import { resolve } from "node:path";
import { cpSync } from "node:fs";
export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 5173 },
  build: {
    rolldownOptions: {
      input: {
        circuit: resolve(import.meta.dirname, "circuit.html"),
        blocks: resolve(import.meta.dirname, "blocks.html"),
        // The workbench imports TypeScript modules, so it must be bundled:
        // copied as-is, GitHub Pages serves .ts as video/mp2t and nothing runs.
        circuits: resolve(import.meta.dirname, "circuits.html"),
      },
    },
  },
  plugins: [
    {
      name: "preserve-existing-static-assets",
      closeBundle() {
        // The home page loads its static modules by URL at runtime.
        for (const file of ["index.html", "app.js"]) {
          cpSync(
            resolve(import.meta.dirname, file),
            resolve(import.meta.dirname, "dist", file),
          );
        }
        cpSync(
          resolve(import.meta.dirname, "assets"),
          resolve(import.meta.dirname, "dist/assets"),
          { recursive: true },
        );
      },
    },
  ],
});
