import type { ReactElement } from "react";
import type { ObstacleKind } from "./map";

/** Mixes a #RRGGBB color toward white (amount > 0) or black (amount < 0). */
function shade(hex: string, amount: number): string {
  const channels = [1, 3, 5].map((index) =>
    parseInt(hex.slice(index, index + 2), 16),
  );
  const target = amount > 0 ? 255 : 0;
  const mixed = channels.map((channel) =>
    Math.round(channel + (target - channel) * Math.abs(amount)),
  );
  return `#${mixed.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

/**
 * Small shaded 3D-looking picture of a shape, like a shape-library tile.
 * Pure SVG: no WebGL is needed to show the palette.
 */
export function ShapeIcon({
  kind,
  color,
}: {
  kind: ObstacleKind;
  color: string;
}) {
  const light = shade(color, 0.35);
  const dark = shade(color, -0.3);
  const shapes: Record<ObstacleKind, ReactElement> = {
    box: (
      <>
        <path d="M32 10 54 21 32 32 10 21Z" fill={light} />
        <path d="M10 21 32 32v24L10 45Z" fill={color} />
        <path d="M54 21 32 32v24l22-11Z" fill={dark} />
      </>
    ),
    wall: (
      <>
        <path d="M6 30 46 14 58 19 18 35Z" fill={light} />
        <path d="M6 30 18 35v16L6 46Z" fill={dark} />
        <path d="M18 35 58 19v16L18 51Z" fill={color} />
      </>
    ),
    cylinder: (
      <>
        <path d="M18 16v32a14 6 0 0 0 28 0V16Z" fill={color} />
        <path d="M32 22a14 6 0 0 0 14-6v32a14 6 0 0 1-14 6Z" fill={dark} />
        <ellipse cx="32" cy="16" rx="14" ry="6" fill={light} />
      </>
    ),
    sphere: (
      <>
        <defs>
          <radialGradient
            id={`sphere-${color.slice(1)}`}
            cx="0.35"
            cy="0.3"
            r="0.75"
          >
            <stop offset="0" stopColor={light} />
            <stop offset="0.55" stopColor={color} />
            <stop offset="1" stopColor={dark} />
          </radialGradient>
        </defs>
        <circle
          cx="32"
          cy="33"
          r="21"
          fill={`url(#sphere-${color.slice(1)})`}
        />
      </>
    ),
    cone: (
      <>
        <path d="M32 8 13 50a19 7 0 0 0 38 0Z" fill={color} />
        <path d="M32 8 51 50a19 7 0 0 1-19 7Z" fill={dark} />
      </>
    ),
    pyramid: (
      <>
        <path d="M32 8 10 44l22 12Z" fill={color} />
        <path d="M32 8 54 44 32 56Z" fill={dark} />
        <path d="M32 8 10 44l22-8 22 8Z" fill={light} opacity="0.35" />
      </>
    ),
  };
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <ellipse cx="32" cy="57" rx="20" ry="4" fill="#17243B" opacity="0.12" />
      {shapes[kind]}
    </svg>
  );
}
