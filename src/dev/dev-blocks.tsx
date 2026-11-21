import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BlocksEditor, DEFAULT_WAIT_BLOCK, generateCppProgram, generateInstructions, validateProgram, type ProgramBlock } from "../modules/blocks";
import { ProgramRunner } from "../modules/runtime";
import * as spanish from "../i18n/es.json";
import "./dev-blocks.css";

function BlocksPage() {
  const [runner] = useState(() => new ProgramRunner());
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
  const waitInstructions = instructions.filter((instruction) => instruction.op === "wait");
  const canRun = issues.length === 0 && waitInstructions.length === instructions.length;
  const labels = spanish.blocks;
  const hasHardware = instructions.some((instruction) => instruction.op !== "wait");
  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(outputView === "cpp" ? cpp : JSON.stringify(instructions, null, 2));
      setCopyStatus(labels.copied);
    } catch { setCopyStatus(labels.copyError); }
  };
  return (
    <main className="blocks-app">
      <header className="app-header"><a className="brand" href="./index.html">ROBOKAN<span aria-hidden="true">.</span></a><a className="home-link" href="./index.html">{labels.home}</a></header>
      <div className="page-heading"><div><h1>{labels.title}</h1><p>{labels.instructions}</p></div><span className="block-count">{blocks.length} {labels.blockCount}</span></div>
      <div className="execution-bar">
        <nav aria-label={labels.controls}>
          <button className="primary-button" disabled={isActive || blocks.length === 0 || !canRun} onClick={() => runner.run(waitInstructions, { repeat: true })}><span aria-hidden="true">▶</span> {labels.run}</button>
          {runner.status === "paused" ? <button onClick={() => runner.resume()}><span aria-hidden="true">▶</span> {labels.resume}</button> : <button disabled={runner.status !== "running"} onClick={() => runner.pause()}><span aria-hidden="true">Ⅱ</span> {labels.pause}</button>}
          <button className="stop-button" disabled={!isActive} onClick={() => runner.stop()}><span aria-hidden="true">■</span> {labels.stop}</button>
        </nav>
        <div className="execution-status"><span className={`status-label status-${runner.status}`} role="status">{labels.status[runner.status]}</span><span className="wait-time">{labels.remaining} <strong>{(runner.remainingWaitMs / 1000).toFixed(1)} s</strong></span></div>
      </div>
      {issues.length > 0 && <ul className="notice error-notice" role="alert">{issues.map((issue) => <li key={issue}>{labels.validation[issue as keyof typeof labels.validation]}</li>)}</ul>}
      {hasHardware && <p className="notice">{labels.hardwarePending}</p>}
      {runner.violations.length > 0 && <ul className="notice error-notice" role="alert">{runner.violations.map((violation, index) => <li key={index}>{spanish.errors[violation.ruleId]} ({violation.instanceId})</li>)}</ul>}
      {runner.error && <p className="notice error-notice" role="alert">{runner.error}</p>}
      <div className="editor-layout">
        <section className="workspace-panel" aria-label={labels.workspace}><div className="panel-heading"><h2>{labels.workspace}</h2><span>{labels.connectHint}</span></div><BlocksEditor isReadOnly={isActive} onChange={setBlocks} activeInstructionIndex={isActive ? runner.instructionIndex : undefined} /></section>
        <aside className="code-panel">
          <div className="panel-heading"><h2>{labels.output}</h2><button className="copy-button" disabled={issues.length > 0} onClick={copyCode}>{labels.copy}</button></div>
          <div className="output-switch" role="group" aria-label={labels.output}><button aria-pressed={outputView === "cpp"} onClick={() => { setOutputView("cpp"); setCopyStatus(""); }}>C++</button><button aria-pressed={outputView === "instructions"} onClick={() => { setOutputView("instructions"); setCopyStatus(""); }}>{labels.program}</button></div>
          <pre tabIndex={0} aria-label={outputView === "cpp" ? labels.cpp : labels.program}><code>{issues.length > 0 ? labels.fixErrors : outputView === "cpp" ? cpp : JSON.stringify(instructions, null, 2)}</code></pre>
          <p className="copy-status" role="status">{copyStatus}</p>
          {blocks.some((block) => block.type === "motor_write" || block.type === "buzzer_write" || block.type === "read_distance") && <p className="code-note">{labels.cppHelpers}</p>}
        </aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<BlocksPage />);
