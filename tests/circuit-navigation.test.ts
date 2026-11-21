import { expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
it.each(["avoider", "line-follower", "blank"])(
  "preserves selection and opens the matching circuit: %s",
  (project) => {
    const element = (dataset: Record<string, string> = {}) => ({
      dataset,
      handlers: {} as Record<string, (event?: unknown) => void>,
      attributes: {} as Record<string, string>,
      hidden: true,
      href: "",
      textContent: "",
      addEventListener(name: string, handler: (event?: unknown) => void) {
        this.handlers[name] = handler;
      },
      setAttribute(name: string, value: string) {
        this.attributes[name] = value;
      },
      showModal() {},
      close() {},
    });
    const dialog = element(),
      status = element(),
      link = element();
    const options = ["avoider", "line-follower", "blank"].map((project) =>
      element({ project, title: project }),
    );
    const document = {
      querySelector: (selector: string) =>
        selector === "#start-dialog"
          ? dialog
          : selector === "#selection-status"
            ? status
            : link,
      querySelectorAll: (selector: string) =>
        selector === "[data-project]" ? options : [],
    };
    runInNewContext(
      readFileSync(new URL("../app.js", import.meta.url), "utf8"),
      { document, encodeURIComponent },
    );
    const chosen = options.find(
      (option) => option.dataset.project === project,
    )!;
    chosen.handlers.click();
    expect(chosen.attributes["aria-pressed"]).toBe("true");
    expect(
      options.filter((option) => option.attributes["aria-pressed"] === "true"),
    ).toHaveLength(1);
    expect(status.textContent).toBe(`Seleccionaste: ${project}.`);
    expect(link.hidden).toBe(false);
    expect(link.href).toBe(`./circuit.html?project=${project}`);
  },
);
