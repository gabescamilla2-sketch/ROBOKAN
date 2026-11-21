import { LoadAssetContainerAsync } from "@babylonjs/core/Loading/sceneLoader";
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import type { Scene } from "@babylonjs/core/scene";
import type { AssetContainer } from "@babylonjs/core/assetContainer";
import type { Material } from "@babylonjs/core/Materials/material";
import "@babylonjs/loaders/glTF";
import { COMPONENT_MODELS, type ComponentModelId } from "../components";

export interface MountedModel {
  root: TransformNode;
  size: Vector3;
  scale: number;
  markers: Map<string, TransformNode>;
  setLed(isOn: boolean, brightness?: number): void;
  dispose(): void;
}

/** Per-scene cache: download a GLB once, reuse its geometry, preserve its pins. */
export class ComponentModelLibrary {
  private containers = new Map<ComponentModelId, Promise<AssetContainer>>();
  private disposed = false;
  constructor(
    private readonly scene: Scene,
    private readonly load = LoadAssetContainerAsync,
  ) {
    scene.onDisposeObservable.addOnce(() => this.dispose());
  }

  async preload(ids: readonly ComponentModelId[], signal?: AbortSignal) {
    signal?.throwIfAborted();
    await Promise.all([...new Set(ids)].map((id) => this.container(id)));
    signal?.throwIfAborted();
  }

  private container(id: ComponentModelId) {
    if (this.disposed)
      throw new DOMException("Model library closed", "AbortError");
    let pending = this.containers.get(id);
    if (!pending) {
      pending = this.load(COMPONENT_MODELS[id].url, this.scene, {
        pluginExtension: ".glb",
      }).then((container) => {
        if (this.disposed) {
          container.dispose();
          throw new DOMException("Model library closed", "AbortError");
        }
        return container;
      });
      this.containers.set(id, pending);
    }
    return pending;
  }

  async mount(id: ComponentModelId, instanceId: string): Promise<MountedModel> {
    const container = await this.container(id);
    if (this.disposed)
      throw new DOMException("Model library closed", "AbortError");
    const entries = container.instantiateModelsToScene(
      (name) => `${instanceId}/${name}`,
      true,
      { doNotInstantiate: true },
    );
    const root = new TransformNode(`component:${instanceId}`, this.scene);
    root.metadata = { instanceId, modelId: id };
    const content = new TransformNode(`model:${instanceId}`, this.scene);
    content.parent = root;
    const orientation = new TransformNode(
      `orientation:${instanceId}`,
      this.scene,
    );
    orientation.parent = content;
    const [rx, ry, rz] = COMPONENT_MODELS[id].rotation;
    orientation.rotation.set(rx, ry, rz);
    entries.rootNodes.forEach((node) => {
      node.parent = orientation;
    });
    const descendants = orientation.getDescendants(false);
    descendants.forEach((node) => {
      if (node instanceof TransformNode) node.computeWorldMatrix(true);
    });
    const bounds = orientation.getHierarchyBoundingVectors();
    const extent = bounds.max.subtract(bounds.min);
    const longest = Math.max(extent.x, extent.y, extent.z);
    if (!Number.isFinite(longest) || longest <= 0) {
      root.dispose();
      throw new Error(`Modelo sin geometría: ${id}`);
    }
    const scale = COMPONENT_MODELS[id].size / longest;
    content.scaling.setAll(scale);
    content.position.set(
      (-(bounds.min.x + bounds.max.x) / 2) * scale,
      -bounds.min.y * scale,
      (-(bounds.min.z + bounds.max.z) / 2) * scale,
    );
    const markers = new Map<string, TransformNode>();
    const materials = new Set<Material>();
    let bulb: (Material & { emissiveColor: Color3 }) | undefined;
    for (const node of descendants) {
      if (!(node instanceof TransformNode)) continue;
      const sourceName = node.name.slice(instanceId.length + 1);
      markers.set(sourceName, node);
      node.metadata = { instanceId, modelId: id, sourceName };
      if ("isPickable" in node) node.isPickable = false;
      if ("material" in node && node.material) {
        const material = node.material as Material;
        materials.add(material);
        if (
          id === "led" &&
          sourceName === "led_body" &&
          "emissiveColor" in material
        )
          bulb = material as typeof bulb;
      }
    }
    return {
      root,
      size: extent.scale(scale),
      scale,
      markers,
      setLed(isOn, brightness = 1) {
        if (bulb)
          bulb.emissiveColor.copyFrom(
            isOn
              ? new Color3(1, 0.12, 0.08).scale(
                  Math.min(1, Math.max(0, brightness)),
                )
              : Color3.Black(),
          );
      },
      dispose() {
        entries.animationGroups.forEach((group) => group.dispose());
        entries.skeletons.forEach((skeleton) => skeleton.dispose());
        root.dispose(false, false);
        materials.forEach((material) => material.dispose(false, false));
      },
    };
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const pending of this.containers.values())
      void pending.then(
        (container) => container.dispose(),
        () => {},
      );
    this.containers.clear();
  }
}
