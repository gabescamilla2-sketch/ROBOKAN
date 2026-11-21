import { defineConfig } from "vite";
import { resolve } from "node:path";
import { cpSync } from "node:fs";
export default defineConfig({
  base: "./",
  server: { host: "127.0.0.1", port: 5173, strictPort: true },
  build: { rolldownOptions: { input: {
    home: resolve(import.meta.dirname, "index.html"),
    circuit: resolve(import.meta.dirname, "circuit.html"),
  } } },
  plugins: [{ name: "preserve-existing-static-assets", closeBundle() {
    cpSync(resolve(import.meta.dirname, "assets"), resolve(import.meta.dirname, "dist/assets"), { recursive: true });
  } }],
});
