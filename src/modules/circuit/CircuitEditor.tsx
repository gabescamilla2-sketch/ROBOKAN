import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  createIdAllocator,
  type CircuitGraph,
  type ComponentSpec,
  type PinDrives,
  type PinSignal,
  type Wire,
  type CircuitEventBus,
  type CircuitState,
} from "../../core";
import { evaluate, publishCircuitChanges } from "./api";
import { Canvas, zoomViewport, type Viewport } from "./Canvas";
import { Palette } from "./Palette";
import {
  addComponent,
  moveComponent,
  rotateComponent,
  removeComponent,
  connectPins,
  removeWire,
} from "./interactions";
import {
  serializeCircuit,
  deserializeCircuit,
  MAX_CIRCUIT_BYTES,
} from "./serialize";
import { t } from "./i18n";
import "./circuit.css";
const STORAGE_KEY = "robokan.circuit.v1";
export interface CircuitEditorProps {
  graph: CircuitGraph;
  specs: readonly ComponentSpec[];
  onChange: (graph: CircuitGraph) => void;
  drives?: PinDrives;
  onDriveChange?: (pinRef: string, signal: PinSignal) => void;
  onLoad?: () => void;
  ghostWires?: readonly Wire[];
  events?: CircuitEventBus;
}
export function CircuitEditor({
  graph,
  specs,
  onChange,
  drives = {},
  onDriveChange,
  onLoad,
  ghostWires = [],
  events,
}: CircuitEditorProps) {
  const [selected, setSelected] = useState<string | null>(null),
    [armedPin, setArmedPin] = useState<string | null>(null),
    [color, setColor] = useState("#006edb"),
    [help, setHelp] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({
    x: 0,
    y: 0,
    width: 1000,
    height: 680,
  });
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [output, setOutput] = useState("D13");
  const [message, setMessage] = useState({
    text: t("circuit.instructions"),
    error: false,
  });
  const upload = useRef<HTMLInputElement>(null),
    request = useRef(0);
  const watermark = useRef({ component: 1, wire: 1 });
  const previous = useRef<CircuitState | undefined>(undefined);
  const state = useMemo(() => {
    const livePins = new Set(
      graph.componentInstances.flatMap((instance) =>
        (specs.find((spec) => spec.specId === instance.specId)?.pins ?? []).map(
          (pin) => `${instance.instanceId}/${pin.pinName}`,
        ),
      ),
    );
    const liveDrives = Object.fromEntries(
      Object.entries(drives).filter(([pinRef]) => livePins.has(pinRef)),
    );
    return evaluate(graph, specs, liveDrives);
  }, [graph, specs, drives]);
  useEffect(() => {
    if (events) publishCircuitChanges(previous.current, state, events);
    previous.current = state;
  }, [state, events]);
  useEffect(
    () => () => {
      request.current++;
    },
    [],
  );
  const allocator = () =>
    createIdAllocator(
      graph.componentInstances.map((instance) => instance.instanceId),
      graph.wires.map((wire) => wire.wireId),
      {
        component: Math.max(
          watermark.current.component,
          graph.idSequence?.component ?? 1,
        ),
        wire: Math.max(watermark.current.wire, graph.idSequence?.wire ?? 1),
      },
    );
  const update = (next: CircuitGraph) => {
    if (next.idSequence)
      watermark.current = {
        component: Math.max(
          watermark.current.component,
          next.idSequence.component,
        ),
        wire: Math.max(watermark.current.wire, next.idSequence.wire),
      };
    onChange(next);
  };
  const add = (
    spec: ComponentSpec,
    position = {
      x: viewport.x + viewport.width / 2,
      y: viewport.y + viewport.height / 2,
    },
  ) => {
    const next = addComponent(graph, spec, position, allocator());
    update(next);
    setSelected(next.componentInstances.at(-1)!.instanceId);
  };
  const connect = (source: string, target: string) => {
    try {
      update(connectPins(graph, specs, source, target, color, allocator()));
      setMessage({ text: t("circuit.connected"), error: false });
    } catch {
      setMessage({ text: t("circuit.connectionError"), error: true });
    }
    setArmedPin(null);
  };
  const pickPin = (pinRef: string) => {
    if (armedPin && armedPin !== pinRef) connect(armedPin, pinRef);
    else {
      setArmedPin(armedPin === pinRef ? null : pinRef);
      setMessage({ text: t("circuit.armed"), error: false });
    }
  };
  const remove = () => {
    if (!selected) return;
    update(
      selected.startsWith("wire:")
        ? removeWire(graph, selected)
        : removeComponent(graph, selected),
    );
    setSelected(null);
    setArmedPin(null);
  };
  const selectedInstance = graph.componentInstances.find(
    (instance) => instance.instanceId === selected,
  );
  const selectedSpec = specs.find(
    (spec) => spec.specId === selectedInstance?.specId,
  );
  const selectedWire = graph.wires.find((wire) => wire.wireId === selected);
  const allPins = graph.componentInstances.flatMap((instance) =>
    (specs.find((spec) => spec.specId === instance.specId)?.pins ?? []).map(
      (pin) => `${instance.instanceId}/${pin.pinName}`,
    ),
  );
  const board = graph.componentInstances.find(
    (instance) =>
      specs.find((spec) => spec.specId === instance.specId)?.category ===
      "board",
  );
  const boardSpec = specs.find((spec) => spec.specId === board?.specId);
  const outputPins =
    boardSpec?.pins.filter((pin) =>
      ["digital_io", "digital_out", "pwm_out"].includes(pin.pinType),
    ) ?? [];
  const outputPin =
    outputPins.find((pin) => pin.pinName === output) ?? outputPins[0];
  const send = (signal: PinSignal) => {
    if (board && outputPin)
      onDriveChange?.(`${board.instanceId}/${outputPin.pinName}`, signal);
  };
  const hardViolations = state.violations.filter(
      (violation) => violation.ruleId !== "floating_pin",
    ),
    floating = state.violations.filter(
      (violation) => violation.ruleId === "floating_pin",
    );
  const unpowered = Object.values(state.statusByInstance).filter(
      (status) => status === "unpowered",
    ).length,
    burned = Object.values(state.statusByInstance).filter(
      (status) => status === "burned",
    ).length;
  const replace = (next: CircuitGraph) => {
    onLoad?.();
    update(next);
    setSelected(null);
    setArmedPin(null);
    setViewport({ x: 0, y: 0, width: 1000, height: 680 });
    setMessage({ text: t("circuit.loaded"), error: false });
  };
  const save = () => {
    try {
      localStorage.setItem(STORAGE_KEY, serializeCircuit(graph, specs));
      setMessage({ text: t("circuit.saved"), error: false });
    } catch {
      setMessage({ text: t("circuit.saveError"), error: true });
    }
  };
  const restore = () => {
    try {
      const source = localStorage.getItem(STORAGE_KEY);
      if (!source) {
        setMessage({ text: t("circuit.noSaved"), error: true });
        return;
      }
      replace(deserializeCircuit(source, specs));
    } catch {
      setMessage({ text: t("circuit.loadError"), error: true });
    }
  };
  const download = () => {
    try {
      const blob = new Blob([serializeCircuit(graph, specs)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = "robokan-circuit.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage({ text: t("circuit.downloaded"), error: false });
    } catch {
      setMessage({ text: t("circuit.saveError"), error: true });
    }
  };
  const load = async (file: File) => {
    const ticket = ++request.current;
    try {
      if (file.size > MAX_CIRCUIT_BYTES) throw new Error("File too large");
      const source = await file.text();
      if (ticket !== request.current) return;
      replace(deserializeCircuit(source, specs));
    } catch {
      if (ticket === request.current)
        setMessage({ text: t("circuit.loadError"), error: true });
    }
  };
  const keyboard = (event: KeyboardEvent<HTMLElement>) => {
    if (
      event.target instanceof HTMLElement &&
      ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)
    )
      return;
    if (event.key === "Escape") {
      setArmedPin(null);
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      remove();
    }
    if (selectedInstance) {
      const delta: Record<string, [number, number]> = {
        ArrowLeft: [-20, 0],
        ArrowRight: [20, 0],
        ArrowUp: [0, -20],
        ArrowDown: [0, 20],
      };
      if (delta[event.key]) {
        event.preventDefault();
        const [x, y] = delta[event.key];
        update(
          moveComponent(graph, selectedInstance.instanceId, {
            x: selectedInstance.circuitPosition.x + x,
            y: selectedInstance.circuitPosition.y + y,
          }),
        );
      }
      if (event.key.toLowerCase() === "r") {
        event.preventDefault();
        update(rotateComponent(graph, selectedInstance.instanceId));
      }
    }
  };
  return (
    <section
      className="circuit-app"
      onKeyDown={keyboard}
      aria-label={t("circuit.title")}
    >
      <div className="editor-toolbar">
        <div className="toolbar-group">
          <h1>{t("circuit.title")}</h1>
          <span className="editor-count">
            {graph.componentInstances.length} {t("circuit.parts")} ·{" "}
            {graph.wires.length} {t("circuit.wires")}
          </span>
        </div>
        <div className="toolbar-group">
          <button type="button" onClick={save}>
            {t("circuit.save")}
          </button>
          <button type="button" onClick={restore}>
            {t("circuit.restore")}
          </button>
          <button type="button" onClick={download}>
            {t("circuit.download")}
          </button>
          <button type="button" onClick={() => upload.current?.click()}>
            {t("circuit.open")}
          </button>
          <input
            ref={upload}
            type="file"
            accept=".json,application/json"
            aria-label={t("circuit.open")}
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void load(file);
              event.target.value = "";
            }}
          />
        </div>
      </div>
      <div className="circuit-workspace">
        <Palette specs={specs} onAdd={(spec) => add(spec)} />
        <main className="circuit-stage">
          <div className="canvas-toolbar">
            <div className="toolbar-group">
              <button
                type="button"
                aria-label={t("circuit.zoomIn")}
                onClick={() => setViewport((view) => zoomViewport(view, 0.8))}
              >
                +
              </button>
              <button
                type="button"
                aria-label={t("circuit.zoomOut")}
                onClick={() => setViewport((view) => zoomViewport(view, 1.25))}
              >
                −
              </button>
              <button
                type="button"
                onClick={() =>
                  setViewport({ x: 0, y: 0, width: 1000, height: 680 })
                }
              >
                {t("circuit.fit")}
              </button>
            </div>
            <div className="toolbar-group">
              <label className="color-field">
                {t("circuit.color")}
                <input
                  type="color"
                  value={color}
                  onChange={(event) => setColor(event.target.value)}
                />
              </label>
              <label className="check-field">
                <input
                  type="checkbox"
                  checked={help}
                  onChange={(event) => setHelp(event.target.checked)}
                />
                {t("circuit.help")}
              </label>
            </div>
          </div>
          <Canvas
            graph={graph}
            specs={specs}
            state={state}
            selected={selected}
            armedPin={armedPin}
            viewport={viewport}
            setViewport={setViewport}
            ghostWires={help ? ghostWires : []}
            onSelect={setSelected}
            onPin={pickPin}
            onMove={(id, point) => update(moveComponent(graph, id, point))}
            onAdd={add}
          />
          <div
            className={`circuit-message ${message.error ? "is-error" : ""}`}
            role={message.error ? "alert" : "status"}
          >
            {armedPin ? `${t("circuit.armed")} ${armedPin}` : message.text}
            {armedPin && (
              <button type="button" onClick={() => setArmedPin(null)}>
                {t("circuit.cancel")}
              </button>
            )}
          </div>
          <p className="keyboard-hint">{t("circuit.keyboardHelp")}</p>
        </main>
        <aside className="circuit-inspector">
          <section>
            <h2>{t("circuit.health")}</h2>
            <p
              className={`health-label ${burned ? "is-burned" : unpowered ? "is-unpowered" : "is-ok"}`}
            >
              {burned
                ? `${burned} ${t("circuit.burned")}`
                : unpowered
                  ? `${unpowered} ${t("circuit.unpowered")}`
                  : t("circuit.healthy")}
            </p>
            {hardViolations.length ? (
              <ul className="violation-list">
                {hardViolations.map((violation, i) => (
                  <li key={`${violation.instanceId}:${violation.ruleId}:${i}`}>
                    <strong>{violation.instanceId}</strong>
                    <span>{t(violation.messageKey)}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="secondary">{t("circuit.noIssues")}</p>
            )}
            {state.netlistIssues.length > 0 && (
              <p role="alert" className="is-error">
                {t("circuit.invalidData")}
              </p>
            )}
            {floating.length > 0 && (
              <details>
                <summary>
                  {t("circuit.freePins")} ({floating.length})
                </summary>
                <ul className="pin-readings">
                  {floating.map((violation) => (
                    <li key={violation.pinRef}>{violation.pinRef}</li>
                  ))}
                </ul>
              </details>
            )}
          </section>
          <section>
            <h2>{t("circuit.selection")}</h2>
            {selectedInstance && selectedSpec ? (
              <>
                <strong>{t(selectedSpec.nameKey)}</strong>
                <p className="mono">
                  {selectedInstance.instanceId} ·{" "}
                  {t(
                    `status.${state.statusByInstance[selectedInstance.instanceId]}`,
                  )}
                </p>
                <div className="toolbar-group">
                  <button
                    type="button"
                    onClick={() =>
                      update(
                        rotateComponent(graph, selectedInstance.instanceId),
                      )
                    }
                  >
                    {t("circuit.rotate")}
                  </button>
                  <button type="button" className="danger" onClick={remove}>
                    {t("circuit.remove")}
                  </button>
                </div>
                <details>
                  <summary>{t("circuit.pins")}</summary>
                  <ul className="pin-readings">
                    {selectedSpec.pins.map((pin) => {
                      const signal =
                        state.signalByPin[
                          `${selectedInstance.instanceId}/${pin.pinName}`
                        ];
                      return (
                        <li key={pin.pinName}>
                          <button
                            type="button"
                            onClick={() =>
                              pickPin(
                                `${selectedInstance.instanceId}/${pin.pinName}`,
                              )
                            }
                          >
                            {pin.pinName}
                            <span>
                              {signal?.signalKind === "floating"
                                ? t("circuit.floating")
                                : `${signal?.voltageV ?? 0} V`}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </details>
              </>
            ) : selectedWire ? (
              <>
                <p className="mono">{selectedWire.wireId}</p>
                <p className="mono">
                  {selectedWire.fromPin}
                  <br />
                  {selectedWire.toPin}
                </p>
                <button type="button" className="danger" onClick={remove}>
                  {t("circuit.removeWire")}
                </button>
              </>
            ) : (
              <p className="secondary">{t("circuit.noneSelected")}</p>
            )}
          </section>
          <section>
            <h2>{t("circuit.connect")}</h2>
            <label className="field-label">
              {t("circuit.from")}
              <select
                value={from}
                onChange={(event) => setFrom(event.target.value)}
              >
                <option value="">—</option>
                {allPins.map((pin) => (
                  <option key={pin} value={pin}>
                    {pin}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              {t("circuit.to")}
              <select
                value={to}
                onChange={(event) => setTo(event.target.value)}
              >
                <option value="">—</option>
                {allPins.map((pin) => (
                  <option key={pin} value={pin}>
                    {pin}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary"
              disabled={!from || !to || from === to}
              onClick={() => connect(from, to)}
            >
              {t("circuit.connect")}
            </button>
          </section>
          {onDriveChange && (
            <section>
              <h2>{t("circuit.signals")}</h2>
              {board && outputPin ? (
                <>
                  <label className="field-label">
                    {t("circuit.outputPin")}
                    <select
                      value={outputPin.pinName}
                      onChange={(event) => setOutput(event.target.value)}
                    >
                      {outputPins.map((pin) => (
                        <option key={pin.pinName}>{pin.pinName}</option>
                      ))}
                    </select>
                  </label>
                  <div className="drive-buttons">
                    <button
                      type="button"
                      onClick={() =>
                        send({
                          signalKind: "digital",
                          voltageV: 0,
                          digitalValue: 0,
                        })
                      }
                    >
                      {t("circuit.low")}
                    </button>
                    <button
                      type="button"
                      className="primary"
                      onClick={() =>
                        send({
                          signalKind: "digital",
                          voltageV: boardSpec!.supplyVoltageV,
                          digitalValue: 1,
                        })
                      }
                    >
                      {t("circuit.high")}
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        send({ signalKind: "floating", voltageV: 0 })
                      }
                    >
                      {t("circuit.release")}
                    </button>
                  </div>
                  {outputPin.pinType === "pwm_out" && (
                    <label className="field-label">
                      {t("circuit.pwm")}
                      <input
                        type="range"
                        min="0"
                        max="255"
                        defaultValue="0"
                        onChange={(event) => {
                          const pwmDuty = event.target.valueAsNumber;
                          send({
                            signalKind: "pwm",
                            voltageV:
                              pwmDuty === 0 ? 0 : boardSpec!.supplyVoltageV,
                            pwmDuty,
                          });
                        }}
                      />
                    </label>
                  )}
                </>
              ) : (
                <p className="secondary">{t("circuit.noBoard")}</p>
              )}
            </section>
          )}
        </aside>
      </div>
    </section>
  );
}
