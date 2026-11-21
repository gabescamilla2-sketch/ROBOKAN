import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { BlocksEditor, DEFAULT_WAIT_BLOCK, generateCpp, generateInstructions, type WaitBlock } from "../modules/blocks";
import { ProgramRunner } from "../modules/runtime";
import * as spanish from "../i18n/es.json";
import "./dev-blocks.css";

function BlocksPage() {
  const [runner] = useState(() => new ProgramRunner());
  const [blocks, setBlocks] = useState<WaitBlock[]>([DEFAULT_WAIT_BLOCK]);
  const [, refresh] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => refresh((count) => count + 1), 50);
    return () => {
      clearInterval(interval);
      runner.stop();
    };
  }, [runner]);
  const isActive = runner.status === "running" || runner.status === "paused";
  const instructions = generateInstructions(blocks);
  const cpp = `void setup() {\n}\n\nvoid loop() {\n${blocks.map((block) => `  ${generateCpp(block)}`).join("\n")}\n}`;
  const labels = spanish.blocks;
  return (
    <main>
      <header><a href="./index.html">ROBOKAN</a><h1>{labels.title}</h1></header>
      <p>{labels.instructions}</p>
      <nav aria-label={labels.controls}>
        <button disabled={isActive || blocks.length === 0} onClick={() => runner.run(instructions, { repeat: true })}>{labels.run}</button>
        <button disabled={runner.status !== "running"} onClick={() => runner.pause()}>{labels.pause}</button>
        <button disabled={runner.status !== "paused"} onClick={() => runner.resume()}>{labels.resume}</button>
        <button disabled={!isActive} onClick={() => runner.stop()}>{labels.stop}</button>
      </nav>
      <p role="status">{labels.status[runner.status]} · {labels.remaining} {(runner.remainingWaitMs / 1000).toFixed(1)} s</p>
      <div className="editor-layout">
        <section aria-label={labels.workspace}><BlocksEditor isReadOnly={isActive} onChange={setBlocks} /></section>
        <aside><h2>{labels.cpp}</h2><pre>{cpp}</pre><h2>{labels.program}</h2><pre>{JSON.stringify(instructions, null, 2)}</pre></aside>
      </div>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<BlocksPage />);
