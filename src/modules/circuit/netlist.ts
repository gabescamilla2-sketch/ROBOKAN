import { breadboardConnections } from "./breadboard";
/**
 * Convierte el cableado del editor en redes eléctricas (nets).
 * Los nombres de campos siguen convenciones-nombres.md. Estos tipos son
 * internos al módulo; el contrato compartido se importará desde core cuando
 * el equipo lo defina.
 */

export interface CircuitComponentRef {
  instanceId: string;
  specId: string;
}

export interface CircuitWireRef {
  wireId: string;
  fromPin: string;
  toPin: string;
  colorHex?: string;
}

export interface CircuitGraphInput {
  componentInstances: readonly CircuitComponentRef[];
  wires: readonly CircuitWireRef[];
}

export interface CircuitNet {
  netId: string;
  pinRefs: string[];
}

export type NetlistIssueCode =
  | "invalid_pin_ref"
  | "unknown_instance"
  | "unknown_pin"
  | "duplicate_instance_id"
  | "duplicate_wire"
  | "self_connection";

export interface NetlistIssue {
  code: NetlistIssueCode;
  wireId?: string;
  pinRef?: string;
}

export interface NetlistResult {
  nets: CircuitNet[];
  issues: NetlistIssue[];
}

/** Crea una referencia con el formato <instanceId>/<pinName>. */
export function createPinRef(instanceId: string, pinName: string): string {
  return `${instanceId}/${pinName}`;
}

/** Separa una referencia de pin siguiendo el formato compartido. */
export function parsePinRef(
  pinRef: string,
): { instanceId: string; pinName: string } | null {
  const separatorIndex = pinRef.indexOf("/");
  if (separatorIndex <= 0 || separatorIndex === pinRef.length - 1) return null;
  if (pinRef.indexOf("/", separatorIndex + 1) !== -1) return null;

  return {
    instanceId: pinRef.slice(0, separatorIndex),
    pinName: pinRef.slice(separatorIndex + 1),
  };
}

/**
 * Agrupa los pines conectados por cables. `pinNamesBySpecId` se construye a
 * partir de las fichas ComponentSpec que proporciona el módulo de componentes.
 */
export function buildNetlist(
  circuitGraph: CircuitGraphInput,
  pinNamesBySpecId: Readonly<Record<string, readonly string[]>>,
): NetlistResult {
  const issues: NetlistIssue[] = [];
  const componentByInstanceId = new Map<string, CircuitComponentRef>();
  const pinRefs: string[] = [];

  for (const componentInstance of circuitGraph.componentInstances) {
    if (componentByInstanceId.has(componentInstance.instanceId)) {
      issues.push({ code: "duplicate_instance_id" });
      continue;
    }

    componentByInstanceId.set(componentInstance.instanceId, componentInstance);
    for (const pinName of pinNamesBySpecId[componentInstance.specId] ?? []) {
      pinRefs.push(createPinRef(componentInstance.instanceId, pinName));
    }
  }

  const parentByPinRef = new Map<string, string>();
  for (const pinRef of pinRefs) parentByPinRef.set(pinRef, pinRef);

  function findRoot(pinRef: string): string {
    const parentPinRef = parentByPinRef.get(pinRef);
    if (parentPinRef === undefined) return pinRef;
    if (parentPinRef === pinRef) return pinRef;
    const rootPinRef = findRoot(parentPinRef);
    parentByPinRef.set(pinRef, rootPinRef);
    return rootPinRef;
  }

  function joinPins(fromPin: string, toPin: string): void {
    const fromRoot = findRoot(fromPin);
    const toRoot = findRoot(toPin);
    if (fromRoot !== toRoot) {
      const [root, child] = [fromRoot, toRoot].sort();
      parentByPinRef.set(child, root);
    }
  }
  for (const instance of componentByInstanceId.values()) {
    if (instance.specId !== "breadboard") continue;
    for (const [fromPin, toPin] of breadboardConnections(
      pinNamesBySpecId[instance.specId] ?? [],
    )) {
      joinPins(
        createPinRef(instance.instanceId, fromPin),
        createPinRef(instance.instanceId, toPin),
      );
    }
  }

  const wireKeys = new Set<string>();

  for (const wire of circuitGraph.wires) {
    const fromPin = resolvePin(wire.fromPin, wire.wireId);
    const toPin = resolvePin(wire.toPin, wire.wireId);
    if (!fromPin || !toPin) continue;

    if (wire.fromPin === wire.toPin) {
      issues.push({
        code: "self_connection",
        wireId: wire.wireId,
        pinRef: wire.fromPin,
      });
      continue;
    }

    const wireKey = [wire.fromPin, wire.toPin].sort().join("|");
    if (wireKeys.has(wireKey)) {
      issues.push({ code: "duplicate_wire", wireId: wire.wireId });
      continue;
    }
    wireKeys.add(wireKey);

    joinPins(wire.fromPin, wire.toPin);
  }

  const pinRefsByRoot = new Map<string, string[]>();
  for (const pinRef of pinRefs) {
    const rootPinRef = findRoot(pinRef);
    const netPinRefs = pinRefsByRoot.get(rootPinRef) ?? [];
    netPinRefs.push(pinRef);
    pinRefsByRoot.set(rootPinRef, netPinRefs);
  }

  const sortedNets = [...pinRefsByRoot.values()]
    .map((netPinRefs) => netPinRefs.sort())
    .sort((firstNet, secondNet) => firstNet[0].localeCompare(secondNet[0]));

  return {
    nets: sortedNets.map((netPinRefs, index) => ({
      netId: `net:${index + 1}`,
      pinRefs: netPinRefs,
    })),
    issues,
  };

  function resolvePin(pinRef: string, wireId: string): boolean {
    const pinAddress = parsePinRef(pinRef);
    if (!pinAddress) {
      issues.push({ code: "invalid_pin_ref", wireId, pinRef });
      return false;
    }

    const componentInstance = componentByInstanceId.get(pinAddress.instanceId);
    if (!componentInstance) {
      issues.push({ code: "unknown_instance", wireId, pinRef });
      return false;
    }

    const pinNames = pinNamesBySpecId[componentInstance.specId] ?? [];
    if (!pinNames.includes(pinAddress.pinName)) {
      issues.push({ code: "unknown_pin", wireId, pinRef });
      return false;
    }

    return true;
  }
}
