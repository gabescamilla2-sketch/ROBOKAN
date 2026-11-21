import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BlocksEditor,
  ReadingsPanel,
  DEFAULT_WAIT_BLOCK,
  generateCppProgram,
  generateInstructions,
  validateProgram,
  type ProgramBlock,
} from "../modules/blocks";
import { ProgramRunner } from "../modules/runtime";
import * as spanish from "../i18n/es.json";
import "./dev-blocks.css";
import { createTestDistanceAdapter } from "./test-distance-adapter";
import type { PinDrives } from "../core";
import { circuitSpecs, createExample } from "./circuit-fixtures";
import { createCircuitProgramAdapter } from "./circuit-program-adapter";
import { importCircuitWorkbench } from "./import-circuit-workbench";
import { evaluate, createExecuteHardwareInstruction } from "../modules/circuit";
import type { RobotWorld } from "../modules/world";
import {
  avoidThresholdCm,
  createWorldExample,
  presetProgramFor,
} from "./world-example";
const WorldViewport = lazy(() =>
  import("../modules/world").then((module) => ({
    default: module.WorldViewport,
  })),
);

function BlocksPage() {
  const params = new URLSearchParams(location.search);
  const isEmbedded = params.get("embedded") === "1";
  const isMotorExample = params.get("example") === "motors";
  const programKey =
    params.get("programKey") ?? (isMotorExample ? "world-motors" : "default");
  const [isWorldOpen, setIsWorldOpen] = useState(
    params.get("world") === "1" || isMotorExample,
  );
  const [isWorldReady, setIsWorldReady] = useState(false);
  const [repeatProgram, setRepeatProgram] = useState(true);
  const [resetOnRun, setResetOnRun] = useState(true);
  const worldRef = useRef<RobotWorld | null>(null);
  const [circuitLoadError, setCircuitLoadError] = useState("");
  const [robot] = useState(() => {
    if (new URLSearchParams(location.search).get("circuit") === "1") {
      try {
        const imported = importCircuitWorkbench(
          sessionStorage.getItem("robokan.program.circuit-transfer") ?? "",
        );
        const selectedBoard = new URLSearchParams(location.search).get("board");
        if (
          selectedBoard &&
          imported.componentInstances.some(
            (instance) =>
              instance.instanceId === selectedBoard &&
              circuitSpecs.find((spec) => spec.specId === instance.specId)
                ?.category === "board",
          )
        )
          imported.boardInstanceId = selectedBoard;
        return imported;
      } catch {
        setCircuitLoadError(spanish.blocks.circuitTransferError);
        return createExample("blank").robot;
      }
    }
    return isMotorExample
      ? createWorldExample().robot
      : createExample("avoider").robot;
  });
  // The motors example and any circuit with both drive motors (such as the
  // workbench "Evasor de obstáculos" starter) open with the avoider routine.
  const [presetProgram] = useState(() =>
    isMotorExample ? createWorldExample().program : presetProgramFor(robot),
  );
  const [drives, setDrives] = useState<PinDrives>({});
  const circuitRef = useRef({ robot, drives });
  circuitRef.current = { robot, drives };
  const [isTestMode, setIsTestMode] = useState(false);
  const [testDistanceCm, setTestDistanceCm] = useState(23.5);
  const distanceRef = useRef(testDistanceCm);
  distanceRef.current = testDistanceCm;
  const testModeRef = useRef(isTestMode);
  testModeRef.current = isTestMode;
  const [runner] = useState(() => {
    const testAdapter = createTestDistanceAdapter(() => distanceRef.current);
    const circuitAdapter = createCircuitProgramAdapter({
      getGraph: () => circuitRef.current.robot,
      getSpecs: () => circuitSpecs,
      getBoardInstanceId: () => circuitRef.current.robot.boardInstanceId,
      getDrives: () => circuitRef.current.drives,
      setDrives: (next) => {
        circuitRef.current.drives = next;
        setDrives(next);
      },
      getDistanceCm: () => distanceRef.current,
    });
    const getWorld = () => {
      if (!worldRef.current) throw new Error(spanish.world.loading);
      return worldRef.current;
    };
    const worldAdapter = createExecuteHardwareInstruction({
      getCircuitGraph: () => circuitRef.current.robot,
      getComponentSpecs: () => circuitSpecs,
      getBoardInstanceId: () => circuitRef.current.robot.boardInstanceId,
      onDrivesChange: (next) => {
        circuitRef.current.drives = next;
        setDrives(next);
      },
      world: {
        query: {
          ultrasonicDistanceCm: (id) =>
            getWorld().query.ultrasonicDistanceCm(id),
          flameIntensityNorm: (id) => getWorld().query.flameIntensityNorm(id),
          gasLevelNorm: (id) => getWorld().query.gasLevelNorm(id),
          groundReflectanceNorm: (id) =>
            getWorld().query.groundReflectanceNorm(id),
          temperatureC: (id) => getWorld().query.temperatureC(id),
        },
        applyActuator: (command) => getWorld().applyActuator(command),
      },
    });
    return new ProgramRunner((instruction, signal) =>
      worldRef.current
        ? worldAdapter(instruction, signal)
        : testModeRef.current
          ? testAdapter(instruction, signal)
          : circuitAdapter(instruction, signal),
    );
  });
  const [blocks, setBlocks] = useState<ProgramBlock[]>(
    presetProgram ?? [DEFAULT_WAIT_BLOCK],
  );
  const [outputView, setOutputView] = useState<
    "cpp" | "instructions" | "world"
  >(isWorldOpen ? "world" : "cpp");
  const [copyStatus, setCopyStatus] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => refresh((count) => count + 1), 50);
    const pauseWhenHidden = () => {
      if (document.hidden && runner.status === "running") runner.pause();
    };
    document.addEventListener("visibilitychange", pauseWhenHidden);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", pauseWhenHidden);
      runner.stop();
    };
  }, [runner]);
  const avoidThreshold = avoidThresholdCm(blocks);
  useEffect(() => {
    worldRef.current?.setAvoidThresholdCm(avoidThreshold);
  }, [avoidThreshold, isWorldReady]);
  const isActive = runner.status === "running" || runner.status === "paused";
  const issues = validateProgram(blocks);
  const instructions = issues.length === 0 ? generateInstructions(blocks) : [];
  const cpp =
    issues.length === 0
      ? generateCppProgram(blocks, { repeat: repeatProgram })
      : "";
  const canRun =
    issues.length === 0 &&
    (isWorldReady ||
      (!isWorldOpen &&
        Number.isFinite(testDistanceCm) &&
        testDistanceCm >= 0 &&
        instructions.every((instruction) =>
          [
            "wait",
            "read_distance",
            ...(!isTestMode ? ["digital_write"] : []),
          ].includes(instruction.op),
        )));
  const labels = spanish.blocks;
  const componentOptions = (
    matches: (specId: string) => boolean,
  ): [string, string][] =>
    robot.componentInstances
      .filter((instance) => matches(instance.specId))
      .map((instance) => [
        `${instance.specId} · ${instance.instanceId}`,
        instance.instanceId,
      ]);
  const sensorOptions = componentOptions((specId) => {
    const kind = circuitSpecs.find(
      (spec) => spec.specId === specId,
    )?.sensorKind;
    return Boolean(kind && kind !== "ultrasonic");
  });
  const servoOptions = componentOptions(
    (specId) =>
      circuitSpecs.find((spec) => spec.specId === specId)?.actuatorKind ===
      "servo",
  );
  const hasHardware = instructions.some(
    (instruction) => instruction.op !== "wait",
  );
  useEffect(() => {
    if (!isEmbedded) return;
    const circuitState = evaluate(robot, circuitSpecs, drives);
    window.parent.postMessage(
      {
        type: "robokan:circuit-state",
        statusByInstance: circuitState.statusByInstance,
      },
      location.origin,
    );
  }, [robot, drives, isEmbedded]);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(
        outputView === "cpp" ? cpp : JSON.stringify(instructions, null, 2),
      );
      setCopyStatus(labels.copied);
    } catch {
      setCopyStatus(labels.copyError);
    }
  };
  return (
    <main className={`blocks-app ${isEmbedded ? "is-embedded" : ""}`}>
      {!isEmbedded && (
        <header className="app-header">
          <a className="brand" href="./index.html">
            <img
              src={
                new URL("../../assets/home/brand-logo.png", import.meta.url)
                  .href
              }
              width="200"
              height="53"
              alt="ROBOKAN"
            />
          </a>
          <a className="home-link" href="./index.html">
            {labels.home}
          </a>
        </header>
      )}
      <div className="page-heading">
        <div>
          <h1>{labels.title}</h1>
          <p>{labels.instructions}</p>
        </div>
        <span className="block-count">
          {blocks.length} {labels.blockCount}
        </span>
      </div>
      <div className="execution-bar">
        <nav aria-label={labels.controls}>
          <button
            className="primary-button"
            disabled={isActive || blocks.length === 0 || !canRun}
            onClick={() => {
              if (resetOnRun) worldRef.current?.reset();
              runner.run(instructions, { repeat: repeatProgram });
            }}
          >
            <span aria-hidden="true">▶</span> {labels.run}
          </button>
          {runner.status === "paused" ? (
            <button onClick={() => runner.resume()}>
              <span aria-hidden="true">▶</span> {labels.resume}
            </button>
          ) : (
            <button
              disabled={runner.status !== "running"}
              onClick={() => runner.pause()}
            >
              <span aria-hidden="true">Ⅱ</span> {labels.pause}
            </button>
          )}
          <button
            className="stop-button"
            disabled={!isActive}
            onClick={() => runner.stop()}
          >
            <span aria-hidden="true">■</span> {labels.stop}
          </button>
        </nav>
        <div className="execution-status">
          <span
            className={`status-label status-${runner.status}`}
            role="status"
          >
            {labels.status[runner.status]}
          </span>
          <span className="wait-time">
            {labels.remaining}{" "}
            <strong>{(runner.remainingWaitMs / 1000).toFixed(1)} s</strong>
          </span>
        </div>
      </div>
      <div className="program-options">
        <label>
          <input
            type="checkbox"
            checked={repeatProgram}
            disabled={isActive}
            onChange={(event) => setRepeatProgram(event.target.checked)}
          />
          {spanish.world.repeat}
        </label>
        <label>
          <input
            type="checkbox"
            checked={resetOnRun}
            disabled={isActive || !isWorldReady}
            onChange={(event) => setResetOnRun(event.target.checked)}
          />
          {spanish.world.resetOnRun}
        </label>
        {isActive && (
          <span className="active-instruction" role="status">
            {spanish.world.step} {runner.instructionIndex + 1} /{" "}
            {instructions.length} ·{" "}
            {
              spanish.world.operations[
                instructions[runner.instructionIndex]?.op ?? "wait"
              ]
            }
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="notice error-notice" role="alert">
          {issues.map((issue) => (
            <li key={issue}>
              {labels.validation[issue as keyof typeof labels.validation]}
            </li>
          ))}
        </ul>
      )}
      {hasHardware && !canRun && (
        <p className="notice">{labels.hardwarePending}</p>
      )}
      {runner.violations.length > 0 && (
        <ul className="notice error-notice" role="alert">
          {runner.violations.map((violation, index) => (
            <li key={index}>
              {spanish.errors[violation.ruleId]} ({violation.instanceId})
            </li>
          ))}
        </ul>
      )}
      {runner.error && (
        <p className="notice error-notice" role="alert">
          {runner.error}
        </p>
      )}
      {circuitLoadError && (
        <p className="notice error-notice" role="alert">
          {circuitLoadError}
        </p>
      )}
      <nav className="world-tools" aria-label={spanish.world.title}>
        <button
          disabled={isActive}
          onClick={() => {
            setIsWorldOpen((open) => !open);
            setOutputView(isWorldOpen ? "cpp" : "world");
          }}
        >
          {isWorldOpen ? spanish.world.hide : spanish.world.show}
        </button>
        <button
          disabled={isActive || !isWorldReady}
          onClick={() => worldRef.current?.reset()}
        >
          {spanish.world.reset}
        </button>
        <a href="blocks.html?example=motors&world=1">{spanish.world.sample}</a>
      </nav>
      {isMotorExample && (
        <p className="code-note">{spanish.world.sampleHint}</p>
      )}
      {isWorldOpen && (
        <p className="code-note">
          {spanish.world.components}{" "}
          {robot.componentInstances
            .filter((instance) =>
              ["dc-motor", "buzzer", "hc-sr04", "led", "servo-sg90"].includes(
                instance.specId,
              ),
            )
            .map((instance) => instance.instanceId)
            .join(" · ")}
        </p>
      )}

      <div className="editor-layout">
        <section className="workspace-panel" aria-label={labels.workspace}>
          <div className="panel-heading">
            <h2>{labels.workspace}</h2>
            <span>{labels.connectHint}</span>
          </div>
          <BlocksEditor
            isReadOnly={isActive}
            onChange={setBlocks}
            activeInstructionIndex={
              isActive ? runner.instructionIndex : undefined
            }
            programKey={programKey}
            sensorOptions={sensorOptions}
            servoOptions={servoOptions}
            initialProgram={presetProgram}
            onClose={() => {
              runner.stop();
              window.parent.postMessage(
                { type: "robokan:close-allowed" },
                window.location.origin,
              );
            }}
          />
        </section>
        <div className="output-column">
          <div
            className="output-switch"
            role="group"
            aria-label={labels.output}
          >
            {isWorldOpen && (
              <button
                aria-pressed={outputView === "world"}
                onClick={() => setOutputView("world")}
              >
                {spanish.world.title}
              </button>
            )}
            <button
              aria-pressed={outputView === "cpp"}
              onClick={() => setOutputView("cpp")}
            >
              C++
            </button>
            <button
              aria-pressed={outputView === "instructions"}
              onClick={() => setOutputView("instructions")}
            >
              {labels.program}
            </button>
          </div>
          <div hidden={outputView !== "world"}>
            {isWorldOpen && (
              <Suspense fallback={<p role="status">{spanish.world.loading}</p>}>
                <WorldViewport
                  robot={robot}
                  onReady={(world) => {
                    worldRef.current = world;
                    setIsWorldReady(Boolean(world));
                  }}
                />
              </Suspense>
            )}
          </div>
          <aside className="code-panel" hidden={outputView === "world"}>
            <div className="panel-heading">
              <h2>{labels.output}</h2>
              <button
                className="copy-button"
                disabled={issues.length > 0}
                onClick={copyCode}
              >
                {labels.copy}
              </button>
            </div>
            <pre
              tabIndex={0}
              aria-label={outputView === "cpp" ? labels.cpp : labels.program}
            >
              <code>
                {issues.length > 0
                  ? labels.fixErrors
                  : outputView === "cpp"
                    ? cpp
                    : JSON.stringify(instructions, null, 2)}
              </code>
            </pre>
            <p className="copy-status" role="status">
              {copyStatus}
            </p>
            {blocks.some(
              (block) =>
                block.type === "motor_write" ||
                block.type === "buzzer_write" ||
                block.type === "read_distance",
            ) && <p className="code-note">{labels.cppHelpers}</p>}
          </aside>
          {!isWorldOpen && (
            <section className="sensor-test-panel" aria-label={labels.testMode}>
              <label>
                <input
                  type="checkbox"
                  checked={isTestMode}
                  disabled={isActive}
                  onChange={(event) => setIsTestMode(event.target.checked)}
                />{" "}
                {labels.testMode}
              </label>
              <p>{isTestMode ? labels.testModeHint : labels.distanceSource}</p>
              <label>
                {labels.testDistance}{" "}
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={Number.isNaN(testDistanceCm) ? "" : testDistanceCm}
                  disabled={isActive}
                  onChange={(event) =>
                    setTestDistanceCm(event.target.valueAsNumber)
                  }
                />{" "}
                cm
              </label>
            </section>
          )}
          <ReadingsPanel
            readings={runner.readings}
            isTestMode={!isWorldReady}
          />
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<BlocksPage />);
