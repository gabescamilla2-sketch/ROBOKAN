import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Matrix, Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Ray } from "@babylonjs/core/Culling/ray";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import type { Mesh } from "@babylonjs/core/Meshes/mesh";
import { PointerEventTypes } from "@babylonjs/core/Events/pointerEvents";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/core/Rendering/outlineRenderer";
import "@babylonjs/loaders/glTF";
import type { RobotDefinition } from "../../core";
import type { RobotWorld, WorldActuatorCommand } from "./types";
import {
  ROBOT_SELECTION_ID,
  clampUltrasonicRangeCm,
  createDefaultWorldMap,
  obstacleBounds,
  setRobotStart,
  updateObstacle,
  type ObstacleKind,
  type WorldMap,
} from "./map";
import { ComponentModelLibrary } from "./component-models";
import { createRobotModel, type RobotModel } from "./robot-model";
import { getComponentModel } from "../components";
import {
  advanceRobot,
  collidesAt,
  type ObstacleBounds,
  type RobotPose,
} from "./motion";

/** Arena walls are raised from 0.75 m to 1.5 m so the ultrasonic sensor sees them. */
const ARENA_WALL_HEIGHT_SCALE = 2;

export async function createRobotWorld(
  canvas: HTMLCanvasElement,
  robotDefinition: RobotDefinition,
  signal?: AbortSignal,
): Promise<RobotWorld> {
  const engine = new Engine(canvas, true, {
    preserveDrawingBuffer: true,
    stencil: true,
  });
  const scene = new Scene(engine);
  let disposed = false;
  let audio: AudioContext | undefined;
  const sounds = new Map<string, OscillatorNode>();
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    sounds.forEach((oscillator) => oscillator.stop());
    sounds.clear();
    void audio?.close();
    observer.disconnect();
    engine.stopRenderLoop();
    scene.dispose();
    engine.dispose();
    signal?.removeEventListener("abort", dispose);
  };
  const observer = new ResizeObserver(() => {
    if (canvas.clientWidth > 0 && canvas.clientHeight > 0) engine.resize();
  });
  observer.observe(canvas);
  signal?.addEventListener("abort", dispose, { once: true });
  try {
    signal?.throwIfAborted();
    scene.clearColor = Color4.FromHexString("#F3F6FBFF");
    const camera = new ArcRotateCamera(
      "camera",
      -Math.PI / 2,
      Math.PI / 3,
      20,
      new Vector3(0, 0.4, 0),
      scene,
    );
    camera.lowerRadiusLimit = 2.5;
    camera.upperRadiusLimit = 30;
    camera.upperBetaLimit = Math.PI / 2.05;
    camera.attachControl(canvas, true);
    new HemisphericLight("light", new Vector3(0, 1, 0), scene).intensity = 1;
    const imported = await ImportMeshAsync(
      `${import.meta.env.BASE_URL}models/scenery/scene.glb`,
      scene,
    );
    signal?.throwIfAborted();
    if (disposed) throw new DOMException("World disposed", "AbortError");
    const robot = imported.meshes.find((mesh) => mesh.name === "robot-chassis");
    if (!robot) throw new Error("El modelo 3D no contiene robot-chassis.");
    // The arena GLB supplies scenery only; the robot is assembled from Rol 5 assets.
    robot.setEnabled(false);
    const meshBounds = (mesh: AbstractMesh): ObstacleBounds => {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        minX: box.minimumWorld.x,
        maxX: box.maximumWorld.x,
        minZ: box.minimumWorld.z,
        maxZ: box.maximumWorld.z,
      };
    };
    // Arena walls, gas tank and fire never move; the three scenery obstacles can be hidden.
    // Collisions and the ultrasonic ray share the same tall solids: the flat
    // fire and gas bases sit below the sensor, so they neither block nor echo.
    const fixedMeshes = imported.meshes.filter((mesh) =>
      /^(arena-wall-|gas-tank$|outer-flame$)/.test(mesh.name),
    );
    // The scenery walls are 0.75 m high but the HC-SR04 sits about 1 m up, so
    // its ray passed over them. Raise them (base stays on the floor) so the
    // sensor sees the arena edge like any other obstacle.
    for (const wall of fixedMeshes.filter((mesh) => /^arena-wall-/.test(mesh.name))) {
      wall.scaling.y *= ARENA_WALL_HEIGHT_SCALE;
      wall.position.y *= ARENA_WALL_HEIGHT_SCALE;
      wall.computeWorldMatrix(true);
    }
    const sceneryObstacleMeshes = imported.meshes.filter((mesh) =>
      /^obstacle-/.test(mesh.name),
    );
    const fixedBounds = fixedMeshes.map(meshBounds);
    const sceneryBounds = sceneryObstacleMeshes.map(meshBounds);
    // User-designed arena: one box mesh per map obstacle.
    let worldMap: WorldMap = createDefaultWorldMap();
    let selectedObstacleId: string | null = null;
    let isEditing = false;
    const userObstacleMeshes = new Map<string, Mesh>();
    const mapListeners = new Set<
      (map: WorldMap, selectedId: string | null) => void
    >();
    let bounds: ObstacleBounds[] = [];
    let rayTargets = new Set<AbstractMesh>();
    imported.meshes
      .find((mesh) => mesh.name === "ultrasonic-ray")
      ?.setEnabled(false);
    const line = MeshBuilder.CreateGround(
      "infrared-track",
      { width: 0.3, height: 16 },
      scene,
    );
    line.position.y = 0.012;
    const lineMaterial = new StandardMaterial("track-material", scene);
    lineMaterial.diffuseColor = Color3.FromHexString("#17243B");
    line.material = lineMaterial;
    const hazardPosition = (name: string, fallback: Vector3) => {
      const mesh = imported.meshes.find((candidate) => candidate.name === name);
      mesh?.computeWorldMatrix(true);
      return mesh?.getAbsolutePosition().clone() ?? fallback;
    };
    const firePosition = hazardPosition(
      "fire-base",
      new Vector3(-5.1, 0.4, 4.1),
    );
    const gasPosition = hazardPosition("gas-tank", new Vector3(5.2, 0.4, 4.2));
    const modelLibrary = new ComponentModelLibrary(scene);
    let assembly: RobotModel | undefined;
    let assemblyGeneration = 0;
    let definition = robotDefinition;
    let pose: RobotPose = { x: -5.5, z: -5.5, headingRad: 0 };
    const motorSpeeds = new Map<string, number>();
    const sensorOrigins = new Map<string, TransformNode>();
    const servoNodes = new Map<string, TransformNode>();
    const componentNodes: TransformNode[] = [];
    let followCamera = false;
    let leftSpeedPct = 0,
      rightSpeedPct = 0,
      isColliding = false;
    let motorSides: { instanceId: string; side: "left" | "right" }[] = [];
    let tracePoints = [
      new Vector3(pose.x, 0.025, pose.z),
      new Vector3(pose.x, 0.025, pose.z),
    ];
    let trace = MeshBuilder.CreateLines(
      "program-trajectory",
      { points: tracePoints },
      scene,
    );
    trace.color = Color3.FromHexString("#2878F0");
    const sensorRay = MeshBuilder.CreateLines(
      "sensor-ray",
      { points: [Vector3.Zero(), Vector3.Zero()], updatable: true },
      scene,
    );
    sensorRay.color = Color3.FromHexString("#FFB84D");
    const targetMarker = MeshBuilder.CreateSphere(
      "sensor-hit",
      { diameter: 0.12 },
      scene,
    );
    const targetMaterial = new StandardMaterial("sensor-hit-material", scene);
    targetMaterial.emissiveColor = Color3.FromHexString("#FFB84D");
    targetMarker.material = targetMaterial;
    // Avoid distance from the program: a red ring on the ray marks it, and the
    // ray turns red while an obstacle is closer than it.
    let avoidThresholdCm: number | null = null;
    const RAY_COLOR = Color3.FromHexString("#FFB84D");
    const NEAR_COLOR = Color3.FromHexString("#E8433A");
    const thresholdRing = MeshBuilder.CreateTorus(
      "avoid-threshold",
      { diameter: 0.5, thickness: 0.05, tessellation: 32 },
      scene,
    );
    const thresholdMaterial = new StandardMaterial("avoid-threshold-material", scene);
    thresholdMaterial.emissiveColor = NEAR_COLOR;
    thresholdMaterial.disableLighting = true;
    thresholdRing.material = thresholdMaterial;
    thresholdRing.isPickable = false;
    thresholdRing.setEnabled(false);
    let showRay = true,
      showTrace = true;
    const stopSounds = () => {
      sounds.forEach((oscillator) => oscillator.stop());
      sounds.clear();
    };
    const syncPose = () => {
      if (!assembly) return;
      assembly.root.position.set(pose.x, assembly.groundOffset, pose.z);
      assembly.root.rotation.set(0, pose.headingRad, 0);
      assembly.root.computeWorldMatrix(true);
    };
    const configureRobot = async (next: RobotDefinition) => {
      const generation = ++assemblyGeneration;
      motorSpeeds.clear();
      stopSounds();
      const nextAssembly = await createRobotModel(
        scene,
        next,
        modelLibrary,
        signal,
      );
      if (disposed || generation !== assemblyGeneration) {
        nextAssembly.dispose();
        return;
      }
      componentNodes.forEach((node) => node.dispose(false, true));
      componentNodes.length = 0;
      assembly?.dispose();
      assembly = nextAssembly;
      definition = next;
      motorSides = assembly.motorSides;
      sensorOrigins.clear();
      servoNodes.clear();
      for (const instance of next.componentInstances) {
        const model = assembly.components.get(instance.instanceId);
        const nativeOrigin = model?.markers.get("sensor.origin");
        if (nativeOrigin) sensorOrigins.set(instance.instanceId, nativeOrigin);
        else if (
          ["flame-sensor", "mq2-gas-sensor", "ir-line-sensor", "lm35"].includes(
            instance.specId,
          )
        ) {
          const origin = new TransformNode(
            `sensor.origin:${instance.instanceId}`,
            scene,
          );
          origin.parent = assembly.root;
          origin.position.copyFrom(
            assembly.mounts[instance.mountPointId ?? "front-center"] ??
              assembly.mounts["front-center"],
          );
          sensorOrigins.set(instance.instanceId, origin);
          componentNodes.push(origin);
        }
        if (instance.specId === "servo-sg90") {
          const arm = MeshBuilder.CreateBox(
            `servo:${instance.instanceId}`,
            { width: 0.12, height: 0.07, depth: 0.5 },
            scene,
          );
          arm.parent = assembly.root;
          arm.position.copyFrom(
            assembly.mounts[instance.mountPointId ?? "top-center"] ??
              assembly.mounts["top-center"],
          );
          arm.position.y += 0.2;
          servoNodes.set(instance.instanceId, arm);
          componentNodes.push(arm);
        }
        if (instance.specId === "buzzer") {
          const buzzer = MeshBuilder.CreateCylinder(
            `buzzer:${instance.instanceId}`,
            { diameter: 0.2, height: 0.14 },
            scene,
          );
          buzzer.parent = assembly.root;
          buzzer.position.copyFrom(assembly.mounts["top-center"]);
          buzzer.position.addInPlace(new Vector3(0.35, 0.12, -0.2));
          const material = new StandardMaterial(
            `buzzer-material:${instance.instanceId}`,
            scene,
          );
          material.diffuseColor = Color3.FromHexString("#17243B");
          buzzer.material = material;
          componentNodes.push(buzzer);
        }
      }
      syncPose();
    };
    const assertInstance = (id: string, specId: string) => {
      if (
        !definition.componentInstances.some(
          (instance) =>
            instance.instanceId === id && instance.specId === specId,
        )
      )
        throw new Error(`Componente 3D inválido: ${id}`);
    };
    const sensorPosition = (id: string, specId: string) => {
      assertInstance(id, specId);
      const origin = sensorOrigins.get(id)!;
      origin.computeWorldMatrix(true);
      return origin.getAbsolutePosition();
    };
    const distance = (id: string) => {
      const origin = sensorPosition(id, "hc-sr04");
      const direction = new Vector3(
        Math.sin(pose.headingRad),
        0,
        Math.cos(pose.headingRad),
      );
      const rangeM = worldMap.ultrasonicRangeCm / 100;
      const hit = scene.pickWithRay(new Ray(origin, direction, rangeM), (mesh) =>
        rayTargets.has(mesh),
      );
      return (hit?.hit ? hit.distance : rangeM) * 100;
    };
    const notifyMap = () =>
      mapListeners.forEach((listener) => listener(worldMap, selectedObstacleId));
    const refreshCollisionTargets = () => {
      bounds = [
        ...fixedBounds,
        ...(worldMap.showSceneryObstacles ? sceneryBounds : []),
        ...worldMap.obstacles.map(obstacleBounds),
      ];
      rayTargets = new Set<AbstractMesh>([
        ...fixedMeshes,
        ...(worldMap.showSceneryObstacles ? sceneryObstacleMeshes : []),
        ...userObstacleMeshes.values(),
      ]);
    };
    // Ring drawn under the robot while it is selected in design mode.
    const robotRing = MeshBuilder.CreateTorus(
      "robot-selection",
      { diameter: 2.1, thickness: 0.07, tessellation: 48 },
      scene,
    );
    const robotRingMaterial = new StandardMaterial("robot-selection-material", scene);
    robotRingMaterial.emissiveColor = Color3.FromHexString("#FFB84D");
    robotRingMaterial.disableLighting = true;
    robotRing.material = robotRingMaterial;
    robotRing.isPickable = false;
    robotRing.setEnabled(false);
    const highlightSelection = () => {
      userObstacleMeshes.forEach((mesh, id) => {
        mesh.renderOutline = id === selectedObstacleId;
      });
      robotRing.setEnabled(selectedObstacleId === ROBOT_SELECTION_ID);
    };
    /** Unit-sized mesh for a shape; scaling stretches it to the obstacle size. */
    const createShapeMesh = (name: string, kind: ObstacleKind): Mesh => {
      switch (kind) {
        case "cylinder":
          return MeshBuilder.CreateCylinder(
            name,
            { diameter: 1, height: 1, tessellation: 32 },
            scene,
          );
        case "sphere":
          return MeshBuilder.CreateSphere(name, { diameter: 1, segments: 16 }, scene);
        case "cone":
          return MeshBuilder.CreateCylinder(
            name,
            { diameterTop: 0, diameterBottom: 1, height: 1, tessellation: 32 },
            scene,
          );
        case "pyramid": {
          // A 4-sided cylinder has its corners on the axes; turn it so its
          // square base lines up with the width/depth footprint.
          const mesh = MeshBuilder.CreateCylinder(
            name,
            { diameterTop: 0, diameterBottom: Math.SQRT2, height: 1, tessellation: 4 },
            scene,
          );
          mesh.rotation.y = Math.PI / 4;
          mesh.bakeCurrentTransformIntoVertices();
          return mesh;
        }
        default:
          return MeshBuilder.CreateBox(name, { size: 1 }, scene);
      }
    };
    const rebuildObstacles = () => {
      userObstacleMeshes.forEach((mesh) => mesh.dispose(false, true));
      userObstacleMeshes.clear();
      for (const obstacle of worldMap.obstacles) {
        const mesh = createShapeMesh(`user-obstacle:${obstacle.id}`, obstacle.kind);
        mesh.scaling.set(obstacle.widthM, obstacle.heightM, obstacle.depthM);
        mesh.position.set(obstacle.x, obstacle.heightM / 2, obstacle.z);
        const material = new StandardMaterial(
          `user-obstacle-material:${obstacle.id}`,
          scene,
        );
        material.diffuseColor = Color3.FromHexString(obstacle.colorHex);
        mesh.material = material;
        mesh.outlineColor = Color3.FromHexString("#FFB84D");
        mesh.outlineWidth = 0.04;
        mesh.metadata = { obstacleId: obstacle.id };
        // Ray queries can run before the next frame; keep picking bounds current.
        mesh.computeWorldMatrix(true);
        userObstacleMeshes.set(obstacle.id, mesh);
      }
      sceneryObstacleMeshes.forEach((mesh) =>
        mesh.setEnabled(worldMap.showSceneryObstacles),
      );
      refreshCollisionTargets();
      highlightSelection();
    };
    const placeRobotAtStart = () => {
      pose = {
        x: worldMap.robotStart.x,
        z: worldMap.robotStart.z,
        headingRad: (worldMap.robotStart.headingDeg * Math.PI) / 180,
      };
      syncPose();
    };
    const setMap = (next: WorldMap) => {
      const previousStart = worldMap.robotStart;
      worldMap = {
        ...next,
        obstacles: next.obstacles.map((obstacle) => ({ ...obstacle })),
        ultrasonicRangeCm: clampUltrasonicRangeCm(next.ultrasonicRangeCm),
        robotStart: { ...next.robotStart },
      };
      if (
        selectedObstacleId &&
        selectedObstacleId !== ROBOT_SELECTION_ID &&
        !worldMap.obstacles.some((obstacle) => obstacle.id === selectedObstacleId)
      )
        selectedObstacleId = null;
      rebuildObstacles();
      // A new start pose (dragged, turned or loaded) moves the robot right away.
      if (
        previousStart.x !== worldMap.robotStart.x ||
        previousStart.z !== worldMap.robotStart.z ||
        previousStart.headingDeg !== worldMap.robotStart.headingDeg
      )
        placeRobotAtStart();
      notifyMap();
    };
    const selectObstacle = (id: string | null) => {
      selectedObstacleId =
        id === ROBOT_SELECTION_ID ||
        (id && worldMap.obstacles.some((obstacle) => obstacle.id === id))
          ? id
          : null;
      highlightSelection();
      notifyMap();
    };
    /** Floor point (y = 0) under a canvas pixel, or null above the horizon. */
    const floorPointAtCanvas = (canvasX: number, canvasY: number) => {
      const ray = scene.createPickingRay(
        canvasX,
        canvasY,
        Matrix.Identity(),
        camera,
      );
      if (Math.abs(ray.direction.y) < 1e-6) return null;
      const t = -ray.origin.y / ray.direction.y;
      return t > 0 ? ray.origin.add(ray.direction.scale(t)) : null;
    };
    const floorPointUnderPointer = () =>
      floorPointAtCanvas(scene.pointerX, scene.pointerY);
    // Design mode: click selects an obstacle or the robot; dragging moves it on the floor.
    let drag: { id: string; offsetX: number; offsetZ: number } | null = null;
    scene.onPointerObservable.add((info) => {
      if (!isEditing) return;
      if (info.type === PointerEventTypes.POINTERDOWN) {
        const meshes = new Set<AbstractMesh>(userObstacleMeshes.values());
        const robotRoot = assembly?.root;
        const hit = scene.pick(
          scene.pointerX,
          scene.pointerY,
          (mesh) =>
            meshes.has(mesh) ||
            Boolean(robotRoot && mesh.isDescendantOf(robotRoot)),
        );
        const picked = hit?.pickedMesh;
        const id: string | undefined =
          picked && robotRoot && picked.isDescendantOf(robotRoot)
            ? ROBOT_SELECTION_ID
            : (picked?.metadata?.obstacleId as string | undefined);
        selectObstacle(id ?? null);
        const point = floorPointUnderPointer();
        const target =
          id === ROBOT_SELECTION_ID
            ? { x: pose.x, z: pose.z }
            : worldMap.obstacles.find((item) => item.id === id);
        if (id && point && target) {
          drag = { id, offsetX: target.x - point.x, offsetZ: target.z - point.z };
          camera.detachControl();
        }
      } else if (info.type === PointerEventTypes.POINTERMOVE && drag) {
        const point = floorPointUnderPointer();
        if (!point) return;
        const id = drag.id;
        const x = point.x + drag.offsetX;
        const z = point.z + drag.offsetZ;
        if (id === ROBOT_SELECTION_ID) {
          // The robot never lands on top of an obstacle: keep the last free spot.
          const start = setRobotStart(worldMap, { x, z }).robotStart;
          if (
            collidesAt(start.x, start.z, bounds, assembly?.collisionRadius ?? 0.9)
          )
            return;
          worldMap = { ...worldMap, robotStart: start };
          placeRobotAtStart();
          return;
        }
        worldMap = updateObstacle(worldMap, id, { x, z });
        const moved = worldMap.obstacles.find((item) => item.id === id);
        const mesh = userObstacleMeshes.get(id);
        if (moved && mesh) {
          mesh.position.set(moved.x, moved.heightM / 2, moved.z);
          mesh.computeWorldMatrix(true);
        }
        refreshCollisionTargets();
      } else if (info.type === PointerEventTypes.POINTERUP && drag) {
        drag = null;
        camera.attachControl(canvas, true);
        notifyMap();
      }
    });
    const applyActuator = (command: WorldActuatorCommand) => {
      if (disposed) throw new Error("El mundo 3D está cerrado.");
      const expectedSpec = {
        motor: "dc-motor",
        servo: "servo-sg90",
        led: "led",
        buzzer: "buzzer",
      }[command.actuatorKind];
      assertInstance(command.instanceId, expectedSpec);
      if (command.actuatorKind === "motor") {
        if (!Number.isFinite(command.speedPct))
          throw new Error("Velocidad inválida");
        motorSpeeds.set(
          command.instanceId,
          Math.max(-100, Math.min(100, command.speedPct)),
        );
      } else if (command.actuatorKind === "led") {
        assembly?.components
          .get(command.instanceId)
          ?.setLed(command.isOn, command.brightnessNorm);
      } else if (command.actuatorKind === "buzzer") {
        sounds.get(command.instanceId)?.stop();
        sounds.delete(command.instanceId);
        if (command.isOn) {
          if (!Number.isFinite(command.frequencyHz) || command.frequencyHz <= 0)
            throw new Error("Frecuencia inválida");
          audio ??= new AudioContext();
          void audio.resume();
          const oscillator = audio.createOscillator();
          const gain = audio.createGain();
          oscillator.frequency.value = Math.min(20000, command.frequencyHz);
          gain.gain.value = 0.025;
          oscillator.connect(gain);
          gain.connect(audio.destination);
          oscillator.start();
          oscillator.onended = () => {
            oscillator.disconnect();
            gain.disconnect();
          };
          sounds.set(command.instanceId, oscillator);
        }
      } else {
        assertInstance(command.instanceId, "servo-sg90");
        const servo = servoNodes.get(command.instanceId);
        if (servo)
          servo.rotation.y =
            ((Math.max(0, Math.min(180, command.angleDeg)) - 90) * Math.PI) /
            180;
      }
    };
    const reset = () => {
      pose = {
        x: worldMap.robotStart.x,
        z: worldMap.robotStart.z,
        headingRad: (worldMap.robotStart.headingDeg * Math.PI) / 180,
      };
      motorSpeeds.clear();
      leftSpeedPct = 0;
      rightSpeedPct = 0;
      isColliding = false;
      tracePoints = [
        new Vector3(pose.x, 0.025, pose.z),
        new Vector3(pose.x, 0.025, pose.z),
      ];
      trace.dispose();
      trace = MeshBuilder.CreateLines(
        "program-trajectory",
        { points: tracePoints },
        scene,
      );
      trace.color = Color3.FromHexString("#2878F0");
      trace.setEnabled(showTrace);
      stopSounds();
      assembly?.components.forEach((model) => model.setLed(false));
      assembly?.wheels.forEach((wheel) => wheel.pivot.rotation.setAll(0));
      servoNodes.forEach((servo) => servo.rotation.setAll(0));
      syncPose();
    };
    rebuildObstacles();
    await configureRobot(robotDefinition);
    reset();
    engine.runRenderLoop(() => {
      if (disposed) return;
      const speedFor = (side: "left" | "right") => {
        const motors = motorSides.filter((motor) => motor.side === side);
        return (
          motors.reduce(
            (sum, motor) => sum + (motorSpeeds.get(motor.instanceId) ?? 0),
            0,
          ) / Math.max(1, motors.length)
        );
      };
      leftSpeedPct = speedFor("left");
      rightSpeedPct = speedFor("right");
      const seconds = Math.min(engine.getDeltaTime() / 1000, 0.25);
      const previous = pose;
      pose = advanceRobot(
        pose,
        leftSpeedPct,
        rightSpeedPct,
        seconds,
        bounds,
        assembly?.collisionRadius,
      );
      const moved = Math.hypot(pose.x - previous.x, pose.z - previous.z);
      isColliding =
        Math.abs(leftSpeedPct + rightSpeedPct) > 0.01 &&
        moved < 0.00001 &&
        seconds > 0;
      syncPose();
      assembly?.wheels.forEach((wheel) => {
        wheel.pivot.rotation.x +=
          ((wheel.side === "left" ? leftSpeedPct : rightSpeedPct) / 100) *
          seconds *
          6;
      });
      if (
        Math.hypot(
          tracePoints.at(-1)!.x - pose.x,
          tracePoints.at(-1)!.z - pose.z,
        ) > 0.15 &&
        moved > 0
      ) {
        tracePoints.push(new Vector3(pose.x, 0.025, pose.z));
        if (tracePoints.length > 500) tracePoints.shift();
        trace.dispose();
        trace = MeshBuilder.CreateLines(
          "program-trajectory",
          { points: tracePoints },
          scene,
        );
        trace.color = Color3.FromHexString("#2878F0");
        trace.setEnabled(showTrace);
      }
      const firstSensor = definition.componentInstances.find(
        (instance) => instance.specId === "hc-sr04",
      );
      sensorRay.setEnabled(showRay && Boolean(firstSensor));
      targetMarker.setEnabled(showRay && Boolean(firstSensor));
      thresholdRing.setEnabled(false);
      if (firstSensor && showRay) {
        const origin = sensorPosition(firstSensor.instanceId, "hc-sr04");
        const direction = new Vector3(
          Math.sin(pose.headingRad),
          0,
          Math.cos(pose.headingRad),
        );
        const readingCm = distance(firstSensor.instanceId);
        const end = origin.add(direction.scale(readingCm / 100));
        const isNear = avoidThresholdCm !== null && readingCm < avoidThresholdCm;
        sensorRay.color = isNear ? NEAR_COLOR : RAY_COLOR;
        MeshBuilder.CreateLines(
          "sensor-ray",
          { points: [origin, end], instance: sensorRay },
          scene,
        );
        targetMaterial.emissiveColor = isNear ? NEAR_COLOR : RAY_COLOR;
        targetMarker.position.copyFrom(end);
        if (
          avoidThresholdCm !== null &&
          avoidThresholdCm <= worldMap.ultrasonicRangeCm
        ) {
          // Ring standing across the ray, facing the robot.
          thresholdRing.position.copyFrom(
            origin.add(direction.scale(avoidThresholdCm / 100)),
          );
          thresholdRing.rotation.set(Math.PI / 2, pose.headingRad, 0);
          thresholdRing.setEnabled(true);
        }
      }
      robotRing.position.set(pose.x, 0.04, pose.z);
      if (followCamera && assembly)
        camera.target.copyFrom(assembly.root.position);
      scene.render();
    });
    return {
      query: {
        ultrasonicDistanceCm: distance,
        flameIntensityNorm: (id) =>
          Math.max(
            0,
            1 -
              Vector3.Distance(
                sensorPosition(id, "flame-sensor"),
                firePosition,
              ) /
                4.5,
          ),
        gasLevelNorm: (id) =>
          Math.max(
            0,
            1 -
              Vector3.Distance(
                sensorPosition(id, "mq2-gas-sensor"),
                gasPosition,
              ) /
                5,
          ),
        groundReflectanceNorm: (id) => {
          const origin = sensorPosition(id, "ir-line-sensor");
          return Math.abs(origin.x) < 0.15 ? 0.1 : 0.9;
        },
        temperatureC: (id) =>
          24 + Math.max(0, 60 - Vector3.Distance(sensorPosition(id, "lm35"), firePosition) * 12),
      },
      applyActuator,
      getSnapshot: () => {
        const sensor = definition.componentInstances.find(
          (instance) => instance.specId === "hc-sr04",
        );
        return {
          xM: pose.x,
          zM: pose.z,
          headingDeg: ((((pose.headingRad * 180) / Math.PI) % 360) + 360) % 360,
          leftSpeedPct,
          rightSpeedPct,
          isColliding,
          distanceCm: sensor ? distance(sensor.instanceId) : null,
          avoidThresholdCm,
          sensorHeightCm: sensor
            ? Math.round(sensorPosition(sensor.instanceId, "hc-sr04").y * 100)
            : null,
          motorSides: motorSides.map((motor) => ({ ...motor })),
          models: [...(assembly?.components ?? [])].map(
            ([instanceId, model]) => ({
              instanceId,
              label: getComponentModel(String(model.root.metadata.modelId))!
                .label,
            }),
          ),
        };
      },
      setCameraView: (view) => {
        followCamera = view === "follow";
        camera.setTarget(
          followCamera && assembly
            ? assembly.root.position.add(new Vector3(0, 0.5, 0))
            : new Vector3(0, 0.4, 0),
        );
        camera.alpha = -Math.PI / 2;
        camera.beta = view === "top" ? 0.06 : Math.PI / 3;
        camera.radius = followCamera ? 5 : 20;
      },
      setSensorRayVisible: (visible) => {
        showRay = visible;
      },
      setTraceVisible: (visible) => {
        showTrace = visible;
        trace.setEnabled(visible);
      },
      reset,
      configureRobot,
      getMap: () => ({
        ...worldMap,
        obstacles: worldMap.obstacles.map((obstacle) => ({ ...obstacle })),
      }),
      setMap,
      getSelectedObstacleId: () => selectedObstacleId,
      setAvoidThresholdCm: (thresholdCm) => {
        avoidThresholdCm =
          thresholdCm !== null && Number.isFinite(thresholdCm) && thresholdCm > 0
            ? thresholdCm
            : null;
      },
      floorPointAt: (clientX, clientY) => {
        const rect = canvas.getBoundingClientRect();
        const point = floorPointAtCanvas(clientX - rect.left, clientY - rect.top);
        return point ? { x: point.x, z: point.z } : null;
      },
      selectObstacle,
      setEditMode: (enabled) => {
        isEditing = enabled;
        if (!enabled && drag) {
          drag = null;
          camera.attachControl(canvas, true);
        }
      },
      onMapChange: (listener) => {
        mapListeners.add(listener);
        return () => {
          mapListeners.delete(listener);
        };
      },
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
