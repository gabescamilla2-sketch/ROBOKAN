import { Engine } from "@babylonjs/core/Engines/engine";
import { Scene } from "@babylonjs/core/scene";
import { ArcRotateCamera } from "@babylonjs/core/Cameras/arcRotateCamera";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3, Color4 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { Ray } from "@babylonjs/core/Culling/ray";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { ImportMeshAsync } from "@babylonjs/core/Loading/sceneLoader";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import "@babylonjs/core/Culling/ray";
import "@babylonjs/loaders/glTF";
import type { RobotDefinition } from "../../core";
import type { RobotWorld, WorldActuatorCommand } from "./types";
import { advanceRobot, type ObstacleBounds, type RobotPose } from "./motion";

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
    camera.lowerRadiusLimit = 5;
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
    robot.setParent(null);
    robot.scaling.set(1, 1, 1);
    robot.rotationQuaternion = null;
    const obstacles = imported.meshes.filter((mesh) =>
      /^(arena-wall|obstacle-|gas-tank|fire-base)/.test(mesh.name),
    );
    const bounds: ObstacleBounds[] = obstacles.map((mesh) => {
      mesh.computeWorldMatrix(true);
      const box = mesh.getBoundingInfo().boundingBox;
      return {
        minX: box.minimumWorld.x,
        maxX: box.maximumWorld.x,
        minZ: box.minimumWorld.z,
        maxZ: box.maximumWorld.z,
      };
    });
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
    const mounts: Record<string, Vector3> = {
      "front-center": new Vector3(0, 0.03, 0.93),
      "front-left": new Vector3(-0.65, -0.12, 0.52),
      "front-right": new Vector3(0.65, -0.12, 0.52),
      "rear-left": new Vector3(-0.65, -0.12, -0.52),
      "rear-right": new Vector3(0.65, -0.12, -0.52),
      "top-center": new Vector3(0, 0.48, -0.28),
    };
    for (const [name, position] of Object.entries(mounts)) {
      const node = new TransformNode(`mount.${name}`, scene);
      node.parent = robot;
      node.position.copyFrom(position);
    }
    let definition = robotDefinition;
    let pose: RobotPose = { x: -5.5, z: -5.5, headingRad: 0 };
    const motorSpeeds = new Map<string, number>();
    const sensorOrigins = new Map<string, TransformNode>();
    const ledMeshes = new Map<string, AbstractMesh>();
    const servoNodes = new Map<string, TransformNode>();
    const componentNodes: TransformNode[] = [];
    const wheelMeshes = imported.meshes.filter((mesh) =>
      /^wheel-.*(?<!center)$/.test(mesh.name),
    );
    wheelMeshes.forEach((wheel) => {
      if (wheel.rotationQuaternion)
        wheel.rotation.copyFrom(wheel.rotationQuaternion.toEulerAngles());
      wheel.rotationQuaternion = null;
    });
    imported.meshes
      .find((mesh) => mesh.name === "robot-status-led")
      ?.setEnabled(false);
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
    let showRay = true,
      showTrace = true;
    const stopSounds = () => {
      sounds.forEach((oscillator) => oscillator.stop());
      sounds.clear();
    };
    const syncPose = () => {
      robot.position.set(pose.x, 0.43, pose.z);
      robot.rotation.set(0, pose.headingRad, 0);
      robot.computeWorldMatrix(true);
    };
    const configureRobot = (next: RobotDefinition) => {
      definition = next;
      const motors = next.componentInstances
        .filter((instance) => instance.specId === "dc-motor")
        .sort((a, b) =>
          a.instanceId.localeCompare(b.instanceId, undefined, {
            numeric: true,
          }),
        );
      motorSides = motors.map((instance, index) => ({
        instanceId: instance.instanceId,
        side: instance.mountPointId?.endsWith("-left")
          ? "left"
          : instance.mountPointId?.endsWith("-right")
            ? "right"
            : index % 2 === 0
              ? "left"
              : "right",
      }));
      motorSpeeds.clear();
      stopSounds();
      componentNodes.forEach((node) => node.dispose(false, true));
      componentNodes.length = 0;
      sensorOrigins.clear();
      ledMeshes.clear();
      servoNodes.clear();
      for (const instance of next.componentInstances) {
        if (instance.specId === "servo-sg90") {
          const arm = MeshBuilder.CreateBox(
            `servo:${instance.instanceId}`,
            { width: 0.12, height: 0.07, depth: 0.5 },
            scene,
          );
          arm.parent = robot;
          arm.position.set(0, 0.6, 0.15);
          servoNodes.set(instance.instanceId, arm);
          componentNodes.push(arm);
        }
        if (
          [
            "hc-sr04",
            "flame-sensor",
            "mq2-gas-sensor",
            "ir-line-sensor",
          ].includes(instance.specId)
        ) {
          const origin = new TransformNode(
            `sensor.origin:${instance.instanceId}`,
            scene,
          );
          origin.parent = robot;
          origin.position.copyFrom(
            mounts[instance.mountPointId ?? "front-center"] ??
              mounts["front-center"],
          );
          sensorOrigins.set(instance.instanceId, origin);
          componentNodes.push(origin);
        }
        if (instance.specId === "led") {
          const led = MeshBuilder.CreateSphere(
            `led:${instance.instanceId}`,
            { diameter: 0.13 },
            scene,
          );
          led.parent = robot;
          led.position.copyFrom(
            mounts[instance.mountPointId ?? "top-center"] ??
              mounts["top-center"],
          );
          const material = new StandardMaterial(
            `led-material:${instance.instanceId}`,
            scene,
          );
          material.diffuseColor = Color3.FromHexString("#F16C75");
          led.material = material;
          ledMeshes.set(instance.instanceId, led);
          componentNodes.push(led);
        }
      }
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
      const hit = scene.pickWithRay(new Ray(origin, direction, 4.5), (mesh) =>
        obstacles.includes(mesh),
      );
      return (hit?.hit ? hit.distance : 4.5) * 100;
    };
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
        const material = ledMeshes.get(command.instanceId)?.material as
          StandardMaterial | undefined;
        if (material)
          material.emissiveColor = command.isOn
            ? new Color3(1, 0.15, 0.2).scale(
                Math.max(0, Math.min(1, command.brightnessNorm)),
              )
            : Color3.Black();
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
      pose = { x: -5.5, z: -5.5, headingRad: 0 };
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
      ledMeshes.forEach((mesh) => {
        (mesh.material as StandardMaterial).emissiveColor = Color3.Black();
      });
      syncPose();
    };
    configureRobot(robotDefinition);
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
      pose = advanceRobot(pose, leftSpeedPct, rightSpeedPct, seconds, bounds);
      const moved = Math.hypot(pose.x - previous.x, pose.z - previous.z);
      isColliding =
        Math.abs(leftSpeedPct + rightSpeedPct) > 0.01 &&
        moved < 0.00001 &&
        seconds > 0;
      syncPose();
      wheelMeshes.forEach((wheel) => {
        wheel.rotation.x +=
          ((wheel.name.includes("left") ? leftSpeedPct : rightSpeedPct) / 100) *
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
      if (firstSensor && showRay) {
        const origin = sensorPosition(firstSensor.instanceId, "hc-sr04");
        const end = origin.add(
          new Vector3(
            Math.sin(pose.headingRad),
            0,
            Math.cos(pose.headingRad),
          ).scale(distance(firstSensor.instanceId) / 100),
        );
        MeshBuilder.CreateLines(
          "sensor-ray",
          { points: [origin, end], instance: sensorRay },
          scene,
        );
        targetMarker.position.copyFrom(end);
      }
      if (followCamera) camera.target.copyFrom(robot.position);
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
          motorSides: motorSides.map((motor) => ({ ...motor })),
        };
      },
      setCameraView: (view) => {
        followCamera = view === "follow";
        camera.setTarget(
          followCamera ? robot.position.clone() : new Vector3(0, 0.4, 0),
        );
        camera.alpha = -Math.PI / 2;
        camera.beta = view === "top" ? 0.06 : Math.PI / 3;
        camera.radius = followCamera ? 8 : 20;
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
      dispose,
    };
  } catch (error) {
    dispose();
    throw error;
  }
}
