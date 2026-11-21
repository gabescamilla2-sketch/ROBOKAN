import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { BlocksEditor, ReadingsPanel, DEFAULT_WAIT_BLOCK, generateCppProgram, generateInstructions, validateProgram, type ProgramBlock } from "../modules/blocks";
import { ProgramRunner } from "../modules/runtime";
import * as spanish from "../i18n/es.json";
import "./dev-blocks.css";
import { createTestDistanceAdapter } from "./test-distance-adapter";
import type { PinDrives } from "../core";
import { circuitSpecs, createExample } from "./circuit-fixtures";
import { createCircuitProgramAdapter } from "./circuit-program-adapter";
import { importCircuitWorkbench } from "./import-circuit-workbench";
import { evaluate } from "../modules/circuit";

function BlocksPage() {
  const params = new URLSearchParams(location.search);
  const isEmbedded = params.get("embedded") === "1";
  const programKey = params.get("programKey") ?? "default";
  const [circuitLoadError, setCircuitLoadError] = useState("");
  const [robot] = useState(() => {
    if (new URLSearchParams(location.search).get("circuit") === "1") {
      try { const imported = importCircuitWorkbench(sessionStorage.getItem("robokan.program.circuit-transfer") ?? "");
        const selectedBoard = new URLSearchParams(location.search).get("board");
        if (selectedBoard && imported.componentInstances.some((instance) => instance.instanceId === selectedBoard && instance.specId === "arduino-uno")) imported.boardInstanceId = selectedBoard;
        return imported; }
      catch { setCircuitLoadError(spanish.blocks.circuitTransferError); return createExample("blank").robot; }
    }
    return createExample("avoider").robot;
  });
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
      setDrives: (next) => { circuitRef.current.drives = next; setDrives(next); },
      getDistanceCm: () => distanceRef.current,
    });
    return new ProgramRunner((instruction, signal) => testModeRef.current ? testAdapter(instruction, signal) : circuitAdapter(instruction, signal));
  });
  const [blocks, setBlocks] = useState<ProgramBlock[]>([DEFAULT_WAIT_BLOCK]);
  const [outputView, setOutputView] = useState<"cpp" | "instructions">("cpp");
  const [copyStatus, setCopyStatus] = useState("");
  const [, refresh] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => refresh((count) => count + 1), 50);
    return () => {
      clearInterval(interval);
      runner.stop();
    };
  }, [runner]);
  const isActive = runner.status === "running" || runner.status === "paused";
  const issues = validateProgram(blocks);
  const instructions = issues.length === 0 ? generateInstructions(blocks) : [];
  const cpp = issues.length === 0 ? generateCppProgram(blocks) : "";
  const canRun = issues.length === 0 && Number.isFinite(testDistanceCm) && testDistanceCm >= 0 && instructions.every((instruction) => ["wait", "read_distance", ...(!isTestMode ? ["digital_write"] : [])].includes(instruction.op));
  const labels = spanish.blocks;
  const hasHardware = instructions.some((instruction) => instruction.op !== "wait");
  useEffect(() => {
    if (!isEmbedded) return;
    const circuitState = evaluate(robot, circuitSpecs, drives);
    window.parent.postMessage({ type: "robokan:circuit-state", statusByInstance: circuitState.statusByInstance }, location.origin);
  }, [robot, drives, isEmbedded]);
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(outputView === "cpp" ? cpp : JSON.stringify(instructions, null, 2));
      setCopyStatus(labels.copied);
    } catch { setCopyStatus(labels.copyError); }
  };
  return (
    <main className={`blocks-app ${isEmbedded ? "is-embedded" : ""}`}>
      {!isEmbedded && <header className="app-header"><a className="brand" href="./index.html">ROBOKAN<span aria-hidden="true">.</span></a><a className="home-link" href="./index.html">{labels.home}</a></header>}
      <div className="page-heading"><div><h1>{labels.title}</h1><p>{labels.instructions}</p></div><span className="block-count">{blocks.length} {labels.blockCount}</span></div>
      <div className="execution-bar">
        <nav aria-label={labels.controls}>
          <button className="primary-button" disabled={isActive || blocks.length === 0 || !canRun} onClick={() => runner.run(instructions, { repeat: true })}><span aria-hidden="true">▶</span> {labels.run}</button>
          {runner.status === "paused" ? <button onClick={() => runner.resume()}><span aria-hidden="true">▶</span> {labels.resume}</button> : <button disabled={runner.status !== "running"} onClick={() => runner.pause()}><span aria-hidden="true">Ⅱ</span> {labels.pause}</button>}
          <button className="stop-button" disabled={!isActive} onClick={() => runner.stop()}><span aria-hidden="true">■</span> {labels.stop}</button>
        </nav>
        <div className="execution-status"><span className={`status-label status-${runner.status}`} role="status">{labels.status[runner.status]}</span><span className="wait-time">{labels.remaining} <strong>{(runner.remainingWaitMs / 1000).toFixed(1)} s</strong></span></div>
      </div>
      {issues.length > 0 && <ul className="notice error-notice" role="alert">{issues.map((issue) => <li key={issue}>{labels.validation[issue as keyof typeof labels.validation]}</li>)}</ul>}
      {hasHardware && !canRun && <p className="notice">{labels.hardwarePending}</p>}
      {runner.violations.length > 0 && <ul className="notice error-notice" role="alert">{runner.violations.map((violation, index) => <li key={index}>{spanish.errors[violation.ruleId]} ({violation.instanceId})</li>)}</ul>}
      {runner.error && <p className="notice error-notice" role="alert">{runner.error}</p>}
      {circuitLoadError && <p className="notice error-notice" role="alert">{circuitLoadError}</p>}
      <div className="editor-layout">
        <section className="workspace-panel" aria-label={labels.workspace}><div className="panel-heading"><h2>{labels.workspace}</h2><span>{labels.connectHint}</span></div><BlocksEditor isReadOnly={isActive} onChange={setBlocks} activeInstructionIndex={isActive ? runner.instructionIndex : undefined} programKey={programKey} onClose={() => { runner.stop(); window.parent.postMessage({ type: "robokan:close-allowed" }, window.location.origin); }} /></section>
        <div className="output-column"><aside className="code-panel">
          <div className="panel-heading"><h2>{labels.output}</h2><button className="copy-button" disabled={issues.length > 0} onClick={copyCode}>{labels.copy}</button></div>
          <div className="output-switch" role="group" aria-label={labels.output}><button aria-pressed={outputView === "cpp"} onClick={() => { setOutputView("cpp"); setCopyStatus(""); }}>C++</button><button aria-pressed={outputView === "instructions"} onClick={() => { setOutputView("instructions"); setCopyStatus(""); }}>{labels.program}</button></div>
          <pre tabIndex={0} aria-label={outputView === "cpp" ? labels.cpp : labels.program}><code>{issues.length > 0 ? labels.fixErrors : outputView === "cpp" ? cpp : JSON.stringify(instructions, null, 2)}</code></pre>
          <p className="copy-status" role="status">{copyStatus}</p>
          {blocks.some((block) => block.type === "motor_write" || block.type === "buzzer_write" || block.type === "read_distance") && <p className="code-note">{labels.cppHelpers}</p>}
        </aside>
        <section className="sensor-test-panel" aria-label={labels.testMode}>
          <label><input type="checkbox" checked={isTestMode} disabled={isActive} onChange={(event) => setIsTestMode(event.target.checked)} /> {labels.testMode}</label>
          <p>{isTestMode ? labels.testModeHint : labels.distanceSource}</p><label>{labels.testDistance} <input type="number" min="0" step="0.1" value={Number.isNaN(testDistanceCm) ? "" : testDistanceCm} disabled={isActive} onChange={(event) => setTestDistanceCm(event.target.valueAsNumber)} /> cm</label>
        </section>
        <ReadingsPanel readings={runner.readings} isTestMode={true} />
        </div>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<BlocksPage />);
