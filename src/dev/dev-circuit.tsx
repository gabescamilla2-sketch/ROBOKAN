import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  createCircuitEventBus,
  type PinDrives,
  type CircuitGraph,
} from "../core";
import { CircuitEditor, circuitText as t } from "../modules/circuit";
import {
  circuitSpecs,
  createExample,
  type CircuitProject,
} from "./circuit-fixtures";
function CircuitWorkbench() {
  const requested = new URLSearchParams(window.location.search).get("project");
  const [project, setProject] = useState<CircuitProject>(
    requested === "blank" || requested === "line-follower"
      ? requested
      : "avoider",
  );
  const [example, setExample] = useState(() => createExample(project));
  const [robot, setRobot] = useState(example.robot);
  const [drives, setDrives] = useState<PinDrives>({});
  const [revision, setRevision] = useState(0);
  const events = useMemo(() => createCircuitEventBus(), []);
  const change = (graph: CircuitGraph) => {
    const next = {
      ...robot,
      ...graph,
      boardInstanceId:
        graph.componentInstances.find(
          (instance) =>
            circuitSpecs.find((spec) => spec.specId === instance.specId)
              ?.category === "board",
        )?.instanceId ?? "",
    };
    setRobot(next);
    events.emit("robot:changed", { robotDefinition: next });
  };
  const reset = (nextProject: CircuitProject) => {
    const next = createExample(nextProject);
    setProject(nextProject);
    setExample(next);
    setRobot(next.robot);
    setDrives({});
    setRevision((value) => value + 1);
    const url = new URL(window.location.href);
    url.searchParams.set("project", nextProject);
    window.history.replaceState(null, "", url);
  };
  return (
    <>
      <header className="workbench-header">
        <a
          href="./index.html"
          className="workbench-brand"
          aria-label={t("circuit.home")}
        >
          <img
            src={
              new URL("../../assets/home/brand-logo.png", import.meta.url).href
            }
            width="200"
            height="53"
            alt="ROBOKAN"
          />
        </a>
        <a href="./index.html" className="home-link">
          {t("circuit.home")}
        </a>
        <label>
          {t("circuit.project")}
          <select
            value={project}
            onChange={(event) => reset(event.target.value as CircuitProject)}
          >
            <option value="avoider">{t("circuit.projectAvoider")}</option>
            <option value="line-follower">{t("circuit.projectLine")}</option>
            <option value="blank">{t("circuit.projectBlank")}</option>
          </select>
        </label>
        <button type="button" onClick={() => reset(project)}>
          {t("circuit.example")}
        </button>
      </header>
      <CircuitEditor
        key={`${project}:${revision}`}
        graph={robot}
        specs={circuitSpecs}
        onChange={change}
        drives={drives}
        onLoad={() => setDrives({})}
        onDriveChange={(pinRef, signal) =>
          setDrives((current) => ({ ...current, [pinRef]: signal }))
        }
        ghostWires={example.expected}
        events={events}
      />
      <p className="workbench-note">
        {t("circuit.catalogNotice")} {t("circuit.runtimeNotice")}
      </p>
    </>
  );
}
const root = document.getElementById("circuit-root");
if (!root) throw new Error("Circuit root not found");
createRoot(root).render(
  <StrictMode>
    <CircuitWorkbench />
  </StrictMode>,
);
