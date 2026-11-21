import {
  useEffect,
  useRef,
  useState,
  type Dispatch,
  type SetStateAction,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type {
  CircuitGraph,
  CircuitState,
  ComponentSpec,
  Point,
  Wire as CircuitWire,
} from "../../core";
import { componentSize, resolvePinPosition } from "./pins";
import { missingGhostWires, orthogonalPath } from "./wiring";
import { Wire } from "./Wire";
import { t } from "./i18n";
export interface Viewport {
  x: number;
  y: number;
  width: number;
  height: number;
}
export function zoomViewport(
  view: Viewport,
  factor: number,
  at: Point = { x: view.x + view.width / 2, y: view.y + view.height / 2 },
): Viewport {
  const width = Math.min(4000, Math.max(200, view.width * factor));
  const scale = width / view.width;
  return {
    x: at.x - (at.x - view.x) * scale,
    y: at.y - (at.y - view.y) * scale,
    width,
    height: view.height * scale,
  };
}
interface Props {
  graph: CircuitGraph;
  specs: readonly ComponentSpec[];
  state: CircuitState;
  selected: string | null;
  armedPin: string | null;
  viewport: Viewport;
  setViewport: Dispatch<SetStateAction<Viewport>>;
  ghostWires: readonly CircuitWire[];
  onSelect: (id: string | null) => void;
  onPin: (pinRef: string) => void;
  onMove: (id: string, point: Point) => void;
  onAdd: (spec: ComponentSpec, point: Point) => void;
}
export function Canvas(props: Props) {
  const { graph, specs, state, selected, armedPin, viewport, setViewport } =
    props;
  const svg = useRef<SVGSVGElement>(null);
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 });
  const gesture = useRef<
    | { kind: "move"; id: string; start: Point; origin: Point }
    | { kind: "pan"; start: Point; view: Viewport; scale: number }
    | null
  >(null);
  const point = (clientX: number, clientY: number): Point => {
    const root = svg.current,
      matrix = root?.getScreenCTM();
    if (!root || !matrix) return { x: 0, y: 0 };
    const p = root.createSVGPoint();
    p.x = clientX;
    p.y = clientY;
    const world = p.matrixTransform(matrix.inverse());
    return { x: world.x, y: world.y };
  };
  useEffect(() => {
    const root = svg.current;
    if (!root) return;
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      const at = point(event.clientX, event.clientY);
      setViewport((view) =>
        zoomViewport(view, event.deltaY > 0 ? 1.12 : 1 / 1.12, at),
      );
    };
    root.addEventListener("wheel", wheel, { passive: false });
    return () => root.removeEventListener("wheel", wheel);
  }, [setViewport]);
  const lines = (label: string, width: number) => {
    const result: string[] = [];
    for (const word of label.split(" ")) {
      const last = result.length - 1;
      if (last >= 0 && (result[last].length + word.length + 1) * 7 < width - 16)
        result[last] += " " + word;
      else result.push(word);
    }
    return result;
  };
  const wireView = (wire: CircuitWire, ghost = false) => {
    try {
      return (
        <Wire
          key={`${ghost ? "ghost:" : ""}${wire.wireId}`}
          wire={wire}
          from={resolvePinPosition(wire.fromPin, graph, specs)}
          to={resolvePinPosition(wire.toPin, graph, specs)}
          ghost={ghost}
          selected={selected === wire.wireId}
          onSelect={() => props.onSelect(wire.wireId)}
        />
      );
    } catch {
      return null;
    }
  };
  const startPan = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (
      event.button !== 1 &&
      !(
        event.target instanceof Element &&
        event.target.getAttribute("data-pan-background")
      )
    )
      return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    gesture.current = {
      kind: "pan",
      start: { x: event.clientX, y: event.clientY },
      view: viewport,
      scale: Math.min(
        rect.width / viewport.width,
        rect.height / viewport.height,
      ),
    };
    props.onSelect(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  };
  const move = (event: ReactPointerEvent<SVGSVGElement>) => {
    const current = point(event.clientX, event.clientY);
    setPointer(current);
    const active = gesture.current;
    if (!active) return;
    if (active.kind === "move")
      props.onMove(active.id, {
        x: active.origin.x + current.x - active.start.x,
        y: active.origin.y + current.y - active.start.y,
      });
    else
      setViewport({
        ...active.view,
        x: active.view.x - (event.clientX - active.start.x) / active.scale,
        y: active.view.y - (event.clientY - active.start.y) / active.scale,
      });
  };
  const end = (event: ReactPointerEvent<SVGSVGElement>) => {
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  };
  let preview: string | undefined;
  if (armedPin) {
    try {
      preview = orthogonalPath(
        resolvePinPosition(armedPin, graph, specs),
        pointer,
      );
    } catch {
      /* A loaded graph can remove the armed pin. */
    }
  }
  return (
    <svg
      ref={svg}
      className="circuit-canvas"
      viewBox={`${viewport.x} ${viewport.y} ${viewport.width} ${viewport.height}`}
      tabIndex={0}
      role="application"
      aria-label={t("circuit.canvas")}
      onPointerDown={startPan}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => {
        event.preventDefault();
        const spec = specs.find(
          (spec) =>
            spec.specId ===
            event.dataTransfer.getData("application/x-robokan-component"),
        );
        if (spec) props.onAdd(spec, point(event.clientX, event.clientY));
      }}
    >
      <defs>
        <pattern
          id="circuit-grid"
          width="20"
          height="20"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="1" cy="1" r="1" fill="#c9d6e5" />
        </pattern>
      </defs>
      <rect
        data-pan-background="true"
        x={viewport.x}
        y={viewport.y}
        width={viewport.width}
        height={viewport.height}
        fill="#f6f9fd"
      />
      <rect
        data-pan-background="true"
        x={viewport.x}
        y={viewport.y}
        width={viewport.width}
        height={viewport.height}
        fill="url(#circuit-grid)"
      />
      {missingGhostWires(graph.wires, props.ghostWires).map((wire) =>
        wireView(wire, true),
      )}
      {graph.wires.map((wire) => wireView(wire))}
      {preview && (
        <path
          d={preview}
          fill="none"
          stroke="#d97706"
          strokeWidth={3}
          strokeDasharray="6 5"
          pointerEvents="none"
        />
      )}
      {graph.componentInstances.map((instance) => {
        const spec = specs.find((spec) => spec.specId === instance.specId);
        if (!spec) return null;
        const size = componentSize(spec),
          status = state.statusByInstance[instance.instanceId] ?? "unpowered";
        return (
          <g
            key={instance.instanceId}
            className={`circuit-component category-${spec.category} state-${status}`}
            role="group"
            aria-label={`${t(spec.nameKey)} ${instance.instanceId}`}
            transform={`translate(${instance.circuitPosition.x} ${instance.circuitPosition.y}) rotate(${instance.rotationDeg} ${size.width / 2} ${size.height / 2})`}
          >
            <rect
              className={`component-body ${selected === instance.instanceId ? "is-selected" : ""}`}
              x="0"
              y="0"
              width={size.width}
              height={size.height}
              rx="10"
              role="button"
              tabIndex={0}
              aria-label={`${t("circuit.select")} ${t(spec.nameKey)} ${instance.instanceId}`}
              onFocus={() => props.onSelect(instance.instanceId)}
              onPointerDown={(event) => {
                if (event.button !== 0) return;
                event.stopPropagation();
                props.onSelect(instance.instanceId);
                gesture.current = {
                  kind: "move",
                  id: instance.instanceId,
                  start: point(event.clientX, event.clientY),
                  origin: instance.circuitPosition,
                };
                svg.current?.setPointerCapture(event.pointerId);
                svg.current?.focus();
              }}
            />
            {spec.svgPath ? (
              <image
                href={spec.svgPath}
                width={size.width}
                height={size.height}
                pointerEvents="none"
              />
            ) : (
              <g pointerEvents="none">
                <text
                  x={size.width / 2}
                  y={size.height / 2 - 8}
                  textAnchor="middle"
                  className="component-name"
                >
                  {lines(t(spec.nameKey), size.width).map((line, i) => (
                    <tspan key={i} x={size.width / 2} dy={i === 0 ? 0 : 15}>
                      {line}
                    </tspan>
                  ))}
                </text>
                {size.height >= 100 && (
                  <text
                    x={size.width / 2}
                    y={size.height / 2 + 27}
                    textAnchor="middle"
                    className="component-id"
                  >
                    {instance.instanceId}
                  </text>
                )}
                {spec.specId === "led" && (
                  <circle
                    cx={size.width / 2}
                    cy="23"
                    r="10"
                    fill={
                      status === "burned"
                        ? "#334155"
                        : status === "ok"
                          ? "#16a34a"
                          : "#e2e8f0"
                    }
                    stroke="#334155"
                  />
                )}
              </g>
            )}
            {status !== "ok" && size.height >= 110 && (
              <text
                x={size.width / 2}
                y={size.height - 23}
                textAnchor="middle"
                className="component-status"
                pointerEvents="none"
              >
                {t(`status.${status}`)}
              </text>
            )}
            {spec.pins.map((pin) => {
              const pinRef = `${instance.instanceId}/${pin.pinName}`,
                signal = state.signalByPin[pinRef],
                isArmed = armedPin === pinRef;
              return (
                <g
                  key={pin.pinName}
                  data-pin-ref={pinRef}
                  className={`circuit-pin ${isArmed ? "is-armed" : ""}`}
                  transform={`translate(${pin.svgPosition.x} ${pin.svgPosition.y})`}
                  onPointerDown={(event) => event.stopPropagation()}
                >
                  <circle
                    r={spec.category === "breadboard" ? 6 : 12}
                    fill="transparent"
                    role="button"
                    tabIndex={0}
                    aria-label={`${instance.instanceId} ${pin.pinName}: ${signal?.signalKind === "floating" ? t("circuit.floating") : `${signal?.voltageV ?? 0} V`}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.onPin(pinRef);
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        event.stopPropagation();
                        props.onPin(pinRef);
                      }
                    }}
                  >
                    <title>{`${pinRef} · ${signal?.signalKind === "floating" ? t("circuit.floating") : `${signal?.voltageV ?? 0} V`}`}</title>
                  </circle>
                  <circle
                    r={spec.category === "breadboard" ? 3 : 5}
                    className="pin-dot"
                    pointerEvents="none"
                  />
                  {spec.category !== "breadboard" && (
                    <text
                      y={pin.svgPosition.y < size.height / 2 ? 20 : -12}
                      textAnchor="middle"
                      pointerEvents="none"
                    >
                      {pin.pinName}
                    </text>
                  )}
                </g>
              );
            })}
          </g>
        );
      })}
    </svg>
  );
}
