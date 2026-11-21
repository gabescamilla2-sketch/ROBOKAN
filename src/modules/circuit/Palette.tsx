import { useEffect, useState } from "react";
import type { ComponentSpec } from "../../core";
import { t } from "./i18n";
export function Palette({
  specs,
  onAdd,
}: {
  specs: readonly ComponentSpec[];
  onAdd: (spec: ComponentSpec) => void;
}) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(
    () =>
      typeof window === "undefined" ||
      !window.matchMedia("(max-width:720px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width:720px)");
    const update = () => setOpen(!media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  return (
    <aside className="circuit-palette" aria-label={t("circuit.catalog")}>
      <h2>
        <button
          type="button"
          className="catalog-toggle"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {t("circuit.catalog")}{" "}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
      </h2>
      {open && (
        <>
          <label className="field-label">
            {t("circuit.search")}
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <p className="secondary">{t("circuit.paletteHint")}</p>
          <div className="palette-items">
            {specs
              .filter((spec) =>
                t(spec.nameKey)
                  .toLocaleLowerCase()
                  .includes(search.toLocaleLowerCase()),
              )
              .map((spec) => (
                <button
                  type="button"
                  className={`palette-item category-${spec.category}`}
                  key={spec.specId}
                  draggable
                  onDragStart={(event) =>
                    event.dataTransfer.setData(
                      "application/x-robokan-component",
                      spec.specId,
                    )
                  }
                  onClick={() => onAdd(spec)}
                >
                  <span className="component-mark" aria-hidden="true">
                    {spec.category === "board"
                      ? "▦"
                      : spec.category === "sensor"
                        ? "◎"
                        : spec.category === "power_source"
                          ? "+"
                          : "◇"}
                  </span>
                  <span>{t(spec.nameKey)}</span>
                  <span aria-hidden="true">+</span>
                </button>
              ))}
          </div>
        </>
      )}
    </aside>
  );
}
