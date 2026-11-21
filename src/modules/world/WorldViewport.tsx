import { useEffect, useRef, useState } from "react";
import type { RobotDefinition } from "../../core";
import type { RobotWorld, WorldSnapshot } from "./types";
import { createRobotWorld } from "./create-world";
import { world as labels } from "../../i18n/es.json";

export function WorldViewport({
  robot,
  onReady,
}: {
  robot: RobotDefinition;
  onReady(world: RobotWorld | null): void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const readyRef = useRef(onReady);
  const worldRef = useRef<RobotWorld | null>(null);
  readyRef.current = onReady;
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [generation, setGeneration] = useState(0);
  const [snapshot, setSnapshot] = useState<WorldSnapshot | null>(null);
  const [cameraView, setCameraView] = useState<"orbit" | "top" | "follow">(
    "orbit",
  );
  const [showRay, setShowRay] = useState(true);
  const [showTrace, setShowTrace] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    let poll: ReturnType<typeof setInterval> | undefined;
    setIsLoading(true);
    setError("");
    void createRobotWorld(canvasRef.current!, robot, controller.signal)
      .then((world) => {
        if (controller.signal.aborted) {
          world.dispose();
          return;
        }
        readyRef.current(world);
        worldRef.current = world;
        world.setCameraView(cameraView);
        world.setSensorRayVisible(showRay);
        world.setTraceVisible(showTrace);
        setSnapshot(world.getSnapshot());
        poll = setInterval(() => setSnapshot(world.getSnapshot()), 100);
        setIsLoading(false);
      })
      .catch((failure) => {
        if (controller.signal.aborted) return;
        setError(failure instanceof Error ? failure.message : String(failure));
        setIsLoading(false);
      });
    return () => {
      clearInterval(poll);
      worldRef.current = null;
      setSnapshot(null);
      controller.abort();
      readyRef.current(null);
    };
  }, [robot, generation]);
  return (
    <section className="world-viewport" aria-label={labels.title}>
      <div
        className="world-camera-tools"
        role="group"
        aria-label={labels.camera}
      >
        {(["orbit", "top", "follow"] as const).map((view) => (
          <button
            key={view}
            disabled={isLoading || Boolean(error)}
            aria-pressed={cameraView === view}
            onClick={() => {
              setCameraView(view);
              worldRef.current?.setCameraView(view);
            }}
          >
            {labels[view]}
          </button>
        ))}
      </div>
      <div className="world-display-options">
        <label>
          <input
            type="checkbox"
            checked={showRay}
            onChange={(event) => {
              setShowRay(event.target.checked);
              worldRef.current?.setSensorRayVisible(event.target.checked);
            }}
          />
          {labels.sensorRay}
        </label>
        <label>
          <input
            type="checkbox"
            checked={showTrace}
            onChange={(event) => {
              setShowTrace(event.target.checked);
              worldRef.current?.setTraceVisible(event.target.checked);
            }}
          />
          {labels.trajectory}
        </label>
      </div>
      {isLoading && <p role="status">{labels.loading}</p>}
      {error && (
        <div role="alert">
          <p>
            {labels.loadError} {error}
          </p>
          <button onClick={() => setGeneration((value) => value + 1)}>
            {labels.retry}
          </button>
        </div>
      )}
      <canvas ref={canvasRef} tabIndex={0} aria-label={labels.canvas} />
      {snapshot && (
        <>
          <dl className="world-telemetry">
            <div>
              <dt>{labels.leftMotor}</dt>
              <dd>{snapshot.leftSpeedPct.toFixed(0)} %</dd>
            </div>
            <div>
              <dt>{labels.rightMotor}</dt>
              <dd>{snapshot.rightSpeedPct.toFixed(0)} %</dd>
            </div>
            <div>
              <dt>{labels.ultrasonic}</dt>
              <dd>
                {snapshot.distanceCm === null
                  ? "—"
                  : `${snapshot.distanceCm.toFixed(1)} cm`}
              </dd>
            </div>
            <div>
              <dt>{labels.heading}</dt>
              <dd>{snapshot.headingDeg.toFixed(0)}°</dd>
            </div>
          </dl>
          <p
            className={snapshot.isColliding ? "world-collision" : "code-note"}
            role="status"
          >
            {snapshot.isColliding ? labels.collision : labels.cameraHint}
          </p>
          <details className="motor-mapping">
            <summary>{labels.motorMapping}</summary>
            {snapshot.motorSides.length === 0 ? (
              <p>{labels.noMotors}</p>
            ) : (
              <ul>
                {snapshot.motorSides.map((motor) => (
                  <li key={motor.instanceId}>
                    {motor.instanceId} —{" "}
                    {motor.side === "left"
                      ? labels.leftMotor
                      : labels.rightMotor}
                  </li>
                ))}
              </ul>
            )}
          </details>
        </>
      )}
    </section>
  );
}
