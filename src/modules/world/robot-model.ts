import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import type { Scene } from "@babylonjs/core/scene";
import type { RobotDefinition } from "../../core";
import { getComponentModel, type ComponentModelId } from "../components";
import { ComponentModelLibrary, type MountedModel } from "./component-models";

export interface RobotModel {
  root: TransformNode;
  groundOffset: number;
  collisionRadius: number;
  mounts: Record<string, Vector3>;
  components: Map<string, MountedModel>;
  motorSides: { instanceId: string; side: "left" | "right" }[];
  wheels: { pivot: TransformNode; side: "left" | "right" }[];
  dispose(): void;
}

/** Assemble only pieces present in the circuit, using the chassis model's mounts. */
export async function createRobotModel(
  scene: Scene,
  definition: RobotDefinition,
  library: ComponentModelLibrary,
  signal?: AbortSignal,
): Promise<RobotModel> {
  const modelIds = definition.componentInstances
    .filter((instance) => getComponentModel(instance.specId))
    .map((instance) => instance.specId as ComponentModelId);
  await library.preload(["chassis-2wd", "wheel", ...modelIds], signal);
  const root = new TransformNode("programmed-robot", scene);
  const mounted: MountedModel[] = [];
  const components = new Map<string, MountedModel>();
  const wheels: RobotModel["wheels"] = [];
  const attach = async (id: ComponentModelId, instanceId: string) => {
    signal?.throwIfAborted();
    const model = await library.mount(id, instanceId);
    mounted.push(model);
    signal?.throwIfAborted();
    model.root.parent = root;
    return model;
  };
  try {
    const chassis = await attach("chassis-2wd", "chassis");
    const marker = (name: string) => {
      const node = chassis.markers.get(name);
      if (!node) throw new Error(`Falta el montaje ${name} en chasis.glb`);
      root.computeWorldMatrix(true);
      chassis.root.getDescendants(false).forEach((child) => {
        if (child instanceof TransformNode) child.computeWorldMatrix(true);
      });
      return node.getAbsolutePosition().clone();
    };
    const deck = marker("mount_arduino");
    const left = marker("mount_motor_left");
    const right = marker("mount_motor_right");
    const front = marker("mount_ultrasonic");
    const mounts: Record<string, Vector3> = {
      "top-center": deck,
      "front-center": front,
      "front-left": left.clone(),
      "front-right": right.clone(),
      "rear-left": new Vector3(left.x, left.y, -0.38),
      "rear-right": new Vector3(right.x, right.y, -0.38),
      battery: marker("mount_battery"),
      driver: marker("mount_driver"),
    };
    for (const [name, position] of Object.entries(mounts)) {
      const node = new TransformNode(`mount.${name}`, scene);
      node.parent = root;
      node.position.copyFrom(position);
    }
    const motors = definition.componentInstances
      .filter((instance) => instance.specId === "dc-motor")
      .sort((a, b) =>
        a.instanceId.localeCompare(b.instanceId, undefined, { numeric: true }),
      );
    const motorSides: RobotModel["motorSides"] = motors.map(
      (instance, index) => ({
        instanceId: instance.instanceId,
        side: instance.mountPointId?.endsWith("-left")
          ? "left"
          : instance.mountPointId?.endsWith("-right")
            ? "right"
            : index % 2 === 0
              ? "left"
              : "right",
      }),
    );
    let wheelRadius = 0.36,
      wheelOuterX = 0.95;
    for (const side of ["left", "right"] as const) {
      const wheel = await attach("wheel", `wheel-${side}`);
      const pivot = new TransformNode(`wheel-pivot:${side}`, scene);
      pivot.parent = root;
      const mount = side === "left" ? left : right;
      pivot.position.set(
        mount.x + (side === "left" ? -0.31 : 0.31),
        mount.y,
        0,
      );
      wheel.root.parent = pivot;
      wheel.root.position.y = -wheel.size.y / 2;
      wheelRadius = wheel.size.y / 2;
      wheelOuterX = Math.max(
        wheelOuterX,
        Math.abs(pivot.position.x) + wheel.size.x / 2,
      );
      wheels.push({ pivot, side });
    }
    const counts = new Map<string, number>();
    for (const instance of definition.componentInstances) {
      if (!getComponentModel(instance.specId)) continue;
      const model = await attach(
        instance.specId as ComponentModelId,
        instance.instanceId,
      );
      components.set(instance.instanceId, model);
      const index = counts.get(instance.specId) ?? 0;
      counts.set(instance.specId, index + 1);
      let position = deck.clone();
      if (instance.specId === "dc-motor") {
        const side = motorSides.find(
          (motor) => motor.instanceId === instance.instanceId,
        )!.side;
        position = (side === "left" ? left : right).clone();
        if (side === "right") model.root.rotation.y = Math.PI;
        position.y -= model.size.y / 2;
        position.z += Math.floor(index / 2) * -0.4;
      } else if (instance.specId === "hc-sr04")
        position = front.add(new Vector3(index * 0.62, 0, 0.02));
      else if (instance.specId === "battery-9v")
        position = mounts.battery.add(new Vector3(index * 0.5, 0, 0));
      else if (instance.specId === "motor-driver-l298n")
        position = mounts.driver.add(new Vector3(index * 0.5, 0, 0));
      else if (instance.specId === "led")
        position = deck.add(new Vector3(-0.38 + index * 0.18, 0.1, 0.3));
      else if (instance.specId === "breadboard")
        position = deck.add(new Vector3(0, 0.25 + index * 0.12, -0.22));
      else if (instance.specId === "lm35")
        position = front.add(new Vector3(0.45 + index * 0.15, 0.05, -0.12));
      else position.y += index * 0.2;
      if (instance.mountPointId && mounts[instance.mountPointId]) {
        position = mounts[instance.mountPointId].clone();
        if (instance.specId === "dc-motor") position.y -= model.size.y / 2;
      }
      model.root.position.copyFrom(position);
      if (instance.specId === "hc-sr04") {
        const origin = new TransformNode(
          `sensor.origin:${instance.instanceId}`,
          scene,
        );
        origin.parent = model.root;
        origin.position.set(0, model.size.y * 0.65, model.size.z / 2 + 0.01);
        model.markers.set("sensor.origin", origin);
      }
    }
    return {
      root,
      components,
      wheels,
      mounts,
      motorSides,
      groundOffset: wheelRadius - left.y,
      collisionRadius: wheelOuterX,
      dispose() {
        mounted.forEach((model) => model.dispose());
        root.dispose();
      },
    };
  } catch (error) {
    mounted.forEach((model) => model.dispose());
    root.dispose();
    throw error;
  }
}
