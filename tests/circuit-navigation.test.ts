import { expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";

it("ships the static circuit workbench and its local dependencies", () => {
  const page = readFileSync(
    new URL("../circuits.html", import.meta.url),
    "utf8",
  );
  expect(page).toContain('src="circuits.js"');
  expect(page).toContain('href="circuits.css"');
  for (const file of ["circuits.js", "circuits.css", "circuits-art.js"]) {
    expect(existsSync(new URL(`../${file}`, import.meta.url))).toBe(true);
  }
});
