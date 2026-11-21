import { readFile } from "node:fs/promises";
import { resolve, basename } from "node:path";
import { afterEach, expect, it, vi } from "vitest";
import { NullEngine } from "@babylonjs/core/Engines/nullEngine";
import { Scene } from "@babylonjs/core/scene";
import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import {
  COMPONENT_MODELS,
  type ComponentModelId,
} from "../src/modules/components";
import { ComponentModelLibrary } from "../src/modules/world/component-models";
import { createRobotModel } from "../src/modules/world/robot-model";
import { createWorldExample } from "../src/dev/world-example";

const engines: NullEngine[] = [];
afterEach(() => engines.splice(0).forEach((engine) => engine.dispose()));
const setup = () => {
  const engine = new NullEngine();
  engines.push(engine);
  const scene = new Scene(engine);
  // Parse the actual checked-in GLBs with Babylon. Skip textures for headless tests.
  const load = vi.fn<typeof LoadAssetContainerAsync>(
    async (source, targetScene, options) => {
      const bytes = await readFile(
        resolve("src/modules/components", basename(String(source))),
      );
      return LoadAssetContainerAsync(bytes, targetScene, {
        ...options,
        pluginOptions: {
          gltf: { skipMaterials: !String(source).endsWith("led.glb") },
        },
      });
    },
  );
  return { scene, load, library: new ComponentModelLibrary(scene, load) };
};

it("loads and normalizes all eleven actual GLBs, preserving their model nodes", async () => {
  const { library } = setup();
  const ids = Object.keys(COMPONENT_MODELS) as ComponentModelId[];
  expect(ids).toHaveLength(11);
  for (const id of ids) {
    const model = await library.mount(id, id);
    expect(Math.max(model.size.x, model.size.y, model.size.z)).toBeCloseTo(
      COMPONENT_MODELS[id].size,
      4,
    );
    model.root
      .getChildMeshes()
      .forEach((mesh) => mesh.computeWorldMatrix(true));
    const bounds = model.root.getHierarchyBoundingVectors();
    expect(bounds.min.y).toBeCloseTo(0, 4);
    expect((bounds.max.x + bounds.min.x) / 2).toBeCloseTo(0, 4);
    expect((bounds.max.z + bounds.min.z) / 2).toBeCloseTo(0, 4);
    if (id === "chassis-2wd")
      expect(model.markers.has("mount_ultrasonic")).toBe(true);
    if (id === "arduino-uno") {
      expect(model.size.y).toBeLessThan(0.2);
      expect(model.markers.has("D13")).toBe(true);
    }
    model.dispose();
  }
});

it("mounts real circuit instances on chassis mounts and keeps the sensor and wheels aligned", async () => {
  const { scene, library, load } = setup();
  const { robot } = createWorldExample();
  const model = await createRobotModel(scene, robot, library);
  expect([...model.components.keys()].sort()).toEqual(
    ["arduino-uno:1", "dc-motor:1", "dc-motor:2", "hc-sr04:1", "led:1"].sort(),
  );
  expect(model.components.get("dc-motor:1")!.root.position.x).toBeLessThan(0);
  expect(model.components.get("dc-motor:2")!.root.position.x).toBeGreaterThan(
    0,
  );
  model.root.position.y = model.groundOffset;
  for (const wheel of model.wheels) {
    wheel.pivot
      .getChildMeshes()
      .forEach((mesh) => mesh.computeWorldMatrix(true));
    expect(wheel.pivot.getHierarchyBoundingVectors().min.y).toBeCloseTo(0, 4);
  }
  const sensor = model.components.get("hc-sr04:1")!;
  const origin = sensor.markers.get("sensor.origin")!;
  origin.computeWorldMatrix(true);
  expect(origin.getAbsolutePosition().z).toBeGreaterThan(0.6);
  expect(model.collisionRadius).toBeGreaterThan(0.9);
  // Two motors share one downloaded GLB. Robot movement carries every component.
  expect(
    load.mock.calls.filter(([url]) => String(url).endsWith("motor.glb")),
  ).toHaveLength(1);
  const before = origin.getAbsolutePosition().clone();
  model.root.position.x = 3;
  origin.computeWorldMatrix(true);
  expect(origin.getAbsolutePosition().x - before.x).toBeCloseTo(3);
  model.root.rotation.y = Math.PI / 2;
  origin.computeWorldMatrix(true);
  expect(origin.getAbsolutePosition().x).toBeGreaterThan(3.6);
  expect(origin.getAbsolutePosition().z).toBeCloseTo(0, 4);
  model.dispose();
});

it("mounts battery, driver, breadboard, Raspberry and LM35 when present, without adding absent parts", async () => {
  const { scene, library } = setup();
  const { robot } = createWorldExample();
  robot.componentInstances = [
    ...[
      "battery-9v",
      "motor-driver-l298n",
      "breadboard",
      "raspberry-pi-4",
      "lm35",
    ].map((specId) => ({
      specId,
      instanceId: `${specId}:1`,
      circuitPosition: { x: 0, y: 0 },
      rotationDeg: 0,
    })),
  ];
  const model = await createRobotModel(scene, robot, library);
  expect([...model.components.keys()]).toEqual(
    robot.componentInstances.map((instance) => instance.instanceId),
  );
  expect(model.components.has("arduino-uno:1")).toBe(false);
  expect(model.components.has("hc-sr04:1")).toBe(false);
  expect(model.components.get("battery-9v:1")!.root.position.y).toBeLessThan(
    model.mounts["top-center"].y,
  );
  model.dispose();
});

it("changes the actual LED bulb without changing another LED or the metal legs", async () => {
  const { library } = setup();
  const first = await library.mount("led", "led:1");
  const second = await library.mount("led", "led:2");
  const bulb = first.root
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("/led_body"))!.material as unknown as {
    emissiveColor: Color3;
  };
  const other = second.root
    .getChildMeshes()
    .find((mesh) => mesh.name.endsWith("/led_body"))!.material as unknown as {
    emissiveColor: Color3;
  };
  first.setLed(true, 0.5);
  expect(bulb.emissiveColor.r).toBe(0.5);
  expect(other.emissiveColor.r).toBe(0);
  first.setLed(false);
  expect(bulb.emissiveColor.r).toBe(0);
  first.dispose();
  second.dispose();
});

it("rejects canceled assembly without placing components in the scene", async () => {
  const { scene, library, load } = setup();
  const controller = new AbortController();
  controller.abort();
  await expect(
    createRobotModel(
      scene,
      createWorldExample().robot,
      library,
      controller.signal,
    ),
  ).rejects.toHaveProperty("name", "AbortError");
  expect(load).not.toHaveBeenCalled();
  expect(scene.meshes).toHaveLength(0);
});
