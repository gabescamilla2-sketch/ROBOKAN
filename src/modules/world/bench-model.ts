import type { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { Curve3 } from "@babylonjs/core/Maths/math.path";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { MeshBuilder } from "@babylonjs/core/Meshes/meshBuilder";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import type { RobotDefinition } from "../../core";
import { getComponentModel, type ComponentModelId } from "../components";
import type { ComponentModelLibrary, MountedModel } from "./component-models";
import type { RobotModel } from "./robot-model";
import {
  benchLayout,
  pinAnchorOffsets,
  wireRoute,
  type BenchPoint,
} from "./bench-layout";
import { ARENA_WALL_INNER_M } from "./motion";

/** Extra API of the 3D circuit bench (non-robot circuits). */
export interface BenchParts {
  /** Part roots by instance id; each sits on the floor at its own (x, z). */
  roots: Map<string, TransformNode>;
  /** Instance id of a part's invisible pick box, or undefined. */
  partOf(mesh: { metadata?: unknown }): string | undefined;
  /** Footprint size of a part (x, y, z) in meters. */
  sizeOf(instanceId: string): Vector3;
  /** Moves a part on the floor (kept inside the arena); its wires follow. */
  movePart(instanceId: string, x: number, z: number): void;
}
export type BenchModel = RobotModel & { bench: BenchParts };

const PART_LIMIT_M = ARENA_WALL_INNER_M - 0.4;

const material = (scene: Scene, name: string, hex: string, emissive = 0) => {
  const result = new StandardMaterial(name, scene);
  result.diffuseColor = Color3.FromHexString(hex);
  if (emissive)
    result.emissiveColor = Color3.FromHexString(hex).scale(emissive);
  return result;
};

/** Simple stand-ins for parts that have no GLB model (resistor, buzzer…). */
function proceduralPart(
  scene: Scene,
  instanceId: string,
  specId: string,
): MountedModel {
  const root = new TransformNode(`component:${instanceId}`, scene);
  root.metadata = { instanceId, modelId: specId };
  const meshes: Mesh[] = [];
  const add = <T extends Mesh>(mesh: T, hex: string, y: number) => {
    mesh.material = material(scene, `${mesh.name}-material`, hex);
    mesh.parent = root;
    mesh.position.y = y;
    mesh.isPickable = false;
    meshes.push(mesh);
    return mesh;
  };
  let size = new Vector3(0.3, 0.06, 0.2);
  if (specId === "resistor") {
    size = new Vector3(0.46, 0.08, 0.08);
    const body = add(
      MeshBuilder.CreateCylinder(
        `${instanceId}/body`,
        { diameter: 0.07, height: 0.26 },
        scene,
      ),
      "#DEC79B",
      0.04,
    );
    body.rotation.z = Math.PI / 2;
    for (const [offset, hex] of [
      [-0.07, "#B64B3C"],
      [-0.03, "#B64B3C"],
      [0.01, "#76523B"],
      [0.08, "#B29A51"],
    ] as const) {
      const band = add(
        MeshBuilder.CreateCylinder(
          `${instanceId}/band${offset}`,
          { diameter: 0.074, height: 0.018 },
          scene,
        ),
        hex,
        0.04,
      );
      band.rotation.z = Math.PI / 2;
      band.position.x = offset;
    }
    for (const side of [-1, 1]) {
      const lead = add(
        MeshBuilder.CreateCylinder(
          `${instanceId}/lead${side}`,
          { diameter: 0.012, height: 0.1 },
          scene,
        ),
        "#A8B5C2",
        0.04,
      );
      lead.rotation.z = Math.PI / 2;
      lead.position.x = side * 0.18;
    }
  } else if (specId === "buzzer") {
    size = new Vector3(0.22, 0.14, 0.22);
    add(
      MeshBuilder.CreateCylinder(
        `${instanceId}/body`,
        { diameter: 0.22, height: 0.14 },
        scene,
      ),
      "#17243B",
      0.07,
    );
    add(
      MeshBuilder.CreateCylinder(
        `${instanceId}/hole`,
        { diameter: 0.05, height: 0.01 },
        scene,
      ),
      "#52627A",
      0.145,
    );
  } else if (specId === "servo-sg90") {
    size = new Vector3(0.24, 0.26, 0.12);
    add(
      MeshBuilder.CreateBox(
        `${instanceId}/body`,
        { width: 0.24, height: 0.22, depth: 0.12 },
        scene,
      ),
      "#2E65A5",
      0.11,
    );
    add(
      MeshBuilder.CreateBox(
        `${instanceId}/arm`,
        { width: 0.2, height: 0.03, depth: 0.04 },
        scene,
      ),
      "#F2F3ED",
      0.24,
    );
  } else {
    // Sensor boards: a coloured PCB with a feature on top.
    const pcb =
      {
        "flame-sensor": "#1F5FA8",
        "mq2-gas-sensor": "#1F5FA8",
        "ir-line-sensor": "#1E7A4C",
      }[specId] ?? "#37495F";
    add(
      MeshBuilder.CreateBox(
        `${instanceId}/pcb`,
        { width: 0.3, height: 0.03, depth: 0.2 },
        scene,
      ),
      pcb,
      0.015,
    );
    if (specId === "mq2-gas-sensor") {
      size = new Vector3(0.3, 0.14, 0.2);
      add(
        MeshBuilder.CreateCylinder(
          `${instanceId}/can`,
          { diameter: 0.12, height: 0.1 },
          scene,
        ),
        "#C9CED6",
        0.08,
      );
    } else if (specId === "flame-sensor") {
      size = new Vector3(0.3, 0.12, 0.2);
      add(
        MeshBuilder.CreateSphere(
          `${instanceId}/eye`,
          { diameter: 0.07 },
          scene,
        ),
        "#17243B",
        0.07,
      );
    } else if (specId === "ir-line-sensor") {
      size = new Vector3(0.3, 0.08, 0.2);
      for (const side of [-1, 1]) {
        const eye = add(
          MeshBuilder.CreateBox(
            `${instanceId}/eye${side}`,
            { size: 0.05 },
            scene,
          ),
          "#17243B",
          0.055,
        );
        eye.position.x = side * 0.06;
      }
    }
  }
  return {
    root,
    size,
    scale: 1,
    markers: new Map(),
    setLed() {},
    setLedColor() {},
    dispose() {
      meshes.forEach((mesh) => {
        mesh.material?.dispose();
        mesh.dispose();
      });
      root.dispose();
    },
  };
}

/**
 * Builds the 3D circuit bench: every part on the floor where the 2D workbench
 * places it, joined by coloured 3D wires that follow parts when they move.
 */
export async function createBenchModel(
  scene: Scene,
  definition: RobotDefinition,
  library: ComponentModelLibrary,
  signal?: AbortSignal,
): Promise<BenchModel> {
  const modelIds = definition.componentInstances
    .filter((instance) => getComponentModel(instance.specId))
    .map((instance) => instance.specId as ComponentModelId);
  await library.preload(modelIds, signal);
  const root = new TransformNode("circuit-bench", scene);
  const components = new Map<string, MountedModel>();
  const roots = new Map<string, TransformNode>();
  const sizes = new Map<string, Vector3>();
  const pickBoxes: Mesh[] = [];
  const specOf = new Map(
    definition.componentInstances.map((instance) => [
      instance.instanceId,
      instance.specId,
    ]),
  );
  const layout = benchLayout(definition.componentInstances);
  try {
    for (const instance of definition.componentInstances) {
      signal?.throwIfAborted();
      const model = getComponentModel(instance.specId)
        ? await library.mount(
            instance.specId as ComponentModelId,
            instance.instanceId,
          )
        : proceduralPart(scene, instance.instanceId, instance.specId);
      const userScale = instance.scale ?? 1;
      model.root.scaling.scaleInPlace(userScale);
      model.size.scaleInPlace(userScale);
      model.root.parent = root;
      const place = layout.get(instance.instanceId)!;
      model.root.position.set(place.x, 0, place.z);
      components.set(instance.instanceId, model);
      roots.set(instance.instanceId, model.root);
      sizes.set(instance.instanceId, model.size.clone());
      // GLB meshes are not pickable: an invisible box makes the part draggable.
      const pick = MeshBuilder.CreateBox(
        `pick:${instance.instanceId}`,
        { size: 1 },
        scene,
      );
      pick.scaling.set(
        model.size.x + 0.06,
        model.size.y + 0.06,
        model.size.z + 0.06,
      );
      pick.position.y = model.size.y / 2;
      pick.parent = model.root;
      pick.visibility = 0;
      pick.metadata = { benchPart: instance.instanceId };
      pickBoxes.push(pick);
      if (instance.specId === "hc-sr04") {
        const origin = new TransformNode(
          `sensor.origin:${instance.instanceId}`,
          scene,
        );
        origin.parent = model.root;
        origin.position.set(0, model.size.y * 0.65, model.size.z / 2 + 0.01);
        model.markers.set("sensor.origin", origin);
      } else if (
        ["flame-sensor", "mq2-gas-sensor", "ir-line-sensor", "lm35"].includes(
          instance.specId,
        )
      ) {
        const origin = new TransformNode(
          `sensor.origin:${instance.instanceId}`,
          scene,
        );
        origin.parent = model.root;
        origin.position.set(0, model.size.y, 0);
        model.markers.set("sensor.origin", origin);
      }
    }
  } catch (error) {
    components.forEach((model) => model.dispose());
    root.dispose();
    throw error;
  }

  // ---- 3D wires
  const usedPins = new Map<string, string[]>();
  const endpoint = (pinRef: string) => {
    const slash = pinRef.lastIndexOf("/");
    return { instanceId: pinRef.slice(0, slash), pin: pinRef.slice(slash + 1) };
  };
  for (const wire of definition.wires)
    for (const ref of [wire.fromPin, wire.toPin]) {
      const { instanceId, pin } = endpoint(ref);
      usedPins.set(instanceId, [...(usedPins.get(instanceId) ?? []), pin]);
    }
  const anchorOf = (pinRef: string): BenchPoint | null => {
    const { instanceId, pin } = endpoint(pinRef);
    const partRoot = roots.get(instanceId);
    const size = sizes.get(instanceId);
    if (!partRoot || !size) return null;
    const spec = specOf.get(instanceId);
    let offset =
      pinAnchorOffsets(usedPins.get(instanceId) ?? [pin], size.x).get(pin) ?? 0;
    if (spec === "resistor")
      offset = pin === "PIN_A" ? -size.x / 2 : size.x / 2;
    // Legs of LEDs and resistors are low; boards and modules take wires on top.
    const y = spec === "led" || spec === "resistor" ? 0.04 : size.y;
    return { x: partRoot.position.x + offset, y, z: partRoot.position.z };
  };
  let wireMeshes: Mesh[] = [];
  const refreshWires = () => {
    wireMeshes.forEach((mesh) => {
      mesh.material?.dispose();
      mesh.dispose();
    });
    wireMeshes = definition.wires.flatMap((wire, index) => {
      const from = anchorOf(wire.fromPin);
      const to = anchorOf(wire.toPin);
      if (!from || !to) return [];
      const points = Curve3.CreateCatmullRomSpline(
        wireRoute(from, to, index % 6).map(
          (point) => new Vector3(point.x, point.y, point.z),
        ),
        8,
      ).getPoints();
      const tube = MeshBuilder.CreateTube(
        `wire3d:${wire.wireId}`,
        { path: points, radius: 0.014, tessellation: 8, cap: Mesh.CAP_ALL },
        scene,
      );
      tube.material = material(
        scene,
        `wire3d-material:${wire.wireId}`,
        wire.colorHex ?? "#2878F0",
        0.25,
      );
      tube.isPickable = false;
      tube.parent = root;
      return [tube];
    });
  };
  refreshWires();

  return {
    root,
    components,
    wheels: [],
    mounts: {},
    motorSides: [],
    groundOffset: 0,
    collisionRadius: 0.5,
    bench: {
      roots,
      partOf: (mesh) =>
        (mesh.metadata as { benchPart?: string } | undefined)?.benchPart,
      sizeOf: (instanceId) =>
        sizes.get(instanceId)?.clone() ?? new Vector3(0.3, 0.1, 0.3),
      movePart(instanceId, x, z) {
        const partRoot = roots.get(instanceId);
        if (!partRoot) return;
        partRoot.position.x = Math.max(
          -PART_LIMIT_M,
          Math.min(PART_LIMIT_M, x),
        );
        partRoot.position.z = Math.max(
          -PART_LIMIT_M,
          Math.min(PART_LIMIT_M, z),
        );
        refreshWires();
      },
    },
    dispose() {
      wireMeshes.forEach((mesh) => {
        mesh.material?.dispose();
        mesh.dispose();
      });
      pickBoxes.forEach((mesh) => mesh.dispose());
      components.forEach((model) => model.dispose());
      root.dispose();
    },
  };
}
