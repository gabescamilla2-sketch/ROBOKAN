import type { Point, Wire as CircuitWire } from "../../core";
import { orthogonalPath } from "./wiring";
import { t } from "./i18n";
export function Wire({
  wire,
  from,
  to,
  selected = false,
  ghost = false,
  onSelect,
}: {
  wire: CircuitWire;
  from: Point;
  to: Point;
  selected?: boolean;
  ghost?: boolean;
  onSelect?: () => void;
}) {
  const path = orthogonalPath(from, to);
  return (
    <g className={ghost ? "ghost-wire" : "circuit-wire"}>
      <path
        d={path}
        fill="none"
        stroke={ghost ? "#d97706" : wire.colorHex}
        strokeWidth={selected ? 5 : 3}
        strokeDasharray={ghost ? "8 6" : undefined}
        strokeLinecap="round"
        strokeLinejoin="round"
        pointerEvents="none"
      />
      {!ghost && (
        <path
          d={path}
          fill="none"
          stroke="transparent"
          strokeWidth={18}
          role="button"
          tabIndex={0}
          aria-label={`${t("circuit.wire")} ${wire.wireId}: ${wire.fromPin} / ${wire.toPin}`}
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            onSelect?.();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.stopPropagation();
              onSelect?.();
            }
          }}
        />
      )}
    </g>
  );
}
