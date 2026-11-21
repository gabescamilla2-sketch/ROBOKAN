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
      },
    },
  },
  plugins: [
    {
      name: "preserve-existing-static-assets",
      closeBundle() {
        // The existing home loads its static modules by URL at runtime.
        for (const file of ["index.html", "app.js", "circuits.html", "circuits.js", "circuits.css", "circuits-art.js", "circuit-projects.js"]) {
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
