import { RULE_IDS } from "../../core";
import {
  buildNetlist,
  createPinRef,
  type CircuitGraphInput,
  type CircuitNet,
  type NetlistIssue,
} from "./netlist";

/** Forma mínima de ComponentSpec que necesita el motor de reglas. */
export interface CircuitRuleSpec {
  specId: string;
  category: string;
  /** Present for actuators; "motor" marks a non-polarized two-terminal load. */
  actuatorKind?: string;
  supplyVoltageV?: number;
  maxVoltageV?: number;
  pins: readonly {
    pinName: string;
    pinType: string;
    maxVoltageV?: number;
  }[];
}

export interface RuleViolation {
  ruleId: string;
  instanceId: string;
  pinRef?: string;
  messageKey: string;
}

export interface CircuitRuleResult {
  nets: CircuitNet[];
  statusByInstance: Record<string, string>;
  violations: RuleViolation[];
  netlistIssues: NetlistIssue[];
}

/** Evalúa las reglas educativas sobre una fotografía del circuito. */
export function evaluateCircuitRules(
  circuitGraph: CircuitGraphInput,
  componentSpecs: readonly CircuitRuleSpec[],
  signalOverrides?: Readonly<Record<string, number>>,
): CircuitRuleResult {
  const specById = new Map(
    componentSpecs.map((componentSpec) => [
      componentSpec.specId,
      componentSpec,
    ]),
  );
  const pinNamesBySpecId = Object.fromEntries(
    componentSpecs.map((componentSpec) => [
      componentSpec.specId,
      componentSpec.pins.map((pin) => pin.pinName),
    ]),
  );
  const { nets, issues: netlistIssues } = buildNetlist(
    circuitGraph,
    pinNamesBySpecId,
  );
  const componentByInstanceId = new Map(
    circuitGraph.componentInstances.map((componentInstance) => [
      componentInstance.instanceId,
      componentInstance,
    ]),
  );
  const netIdByPinRef = new Map<string, string>();
  for (const net of nets) {
    for (const pinRef of net.pinRefs) netIdByPinRef.set(pinRef, net.netId);
  }

  const violations: RuleViolation[] = [];
  const reportedViolations = new Set<string>();
  const statusByInstance: Record<string, string> = Object.fromEntries(
    circuitGraph.componentInstances.map((componentInstance) => [
      componentInstance.instanceId,
      "ok",
    ]),
  );

  function reportViolation(
    ruleId: string,
    instanceId: string,
    pinRef?: string,
  ): void {
    const violationKey = `${ruleId}|${instanceId}|${pinRef ?? ""}`;
    if (reportedViolations.has(violationKey)) return;
    reportedViolations.add(violationKey);
    violations.push({
      ruleId,
      instanceId,
      ...(pinRef ? { pinRef } : {}),
      messageKey: `errors.${ruleId}`,
    });

    if (
      ruleId === RULE_IDS.ledWithoutResistor ||
      ruleId === RULE_IDS.reversedPolarity ||
      ruleId === RULE_IDS.overvoltageGpio
    ) {
      statusByInstance[instanceId] = "burned";
    } else if (
      ruleId === RULE_IDS.missingCommonGround &&
      statusByInstance[instanceId] !== "burned"
    ) {
      statusByInstance[instanceId] = "unpowered";
    }
  }

  function getSpec(instanceId: string): CircuitRuleSpec | undefined {
    const componentInstance = componentByInstanceId.get(instanceId);
    return componentInstance
      ? specById.get(componentInstance.specId)
      : undefined;
  }

  function getPinRef(instanceId: string, pinName: string): string {
    return createPinRef(instanceId, pinName);
  }

  function getNetId(instanceId: string, pinName: string): string | undefined {
    return netIdByPinRef.get(getPinRef(instanceId, pinName));
  }

  function findPins(
    componentSpec: CircuitRuleSpec,
    matches: (pinName: string, pinType: string) => boolean,
  ): string[] {
    return componentSpec.pins
      .filter((pin) => matches(pin.pinName, pin.pinType))
      .map((pin) => pin.pinName);
  }

  function isGroundPin(pinName: string, pinType: string): boolean {
    return (
      pinType === "ground" ||
      pinName === "GND" ||
      pinName.startsWith("GND_") ||
      pinName === "NEGATIVE"
    );
  }

  function isPositivePin(pinName: string, pinType: string): boolean {
    return (
      pinType === "power" ||
      ["VCC", "5V", "3V3", "VIN", "POSITIVE"].includes(pinName)
    );
  }

  const allComponentInstances = circuitGraph.componentInstances;
  const boardInstances = allComponentInstances.filter(
    (componentInstance) =>
      getSpec(componentInstance.instanceId)?.category === "board",
  );
  // Static rule analysis: boards and batteries supply nominal operating rails.
  // GPIO direction/value, PWM timing and voltage-divider calculations belong
  // to the future runtime signal evaluator, not this topology-only engine.
  const voltagesByNet = new Map<string, Set<number>>();
  const resistorNeighbors = new Map<string, string[]>();

  function addVoltage(
    netId: string | undefined,
    voltageV: number | undefined,
  ): void {
    if (
      !netId ||
      voltageV === undefined ||
      !Number.isFinite(voltageV) ||
      voltageV < 0
    )
      return;
    const voltages = voltagesByNet.get(netId) ?? new Set<number>();
    voltages.add(voltageV);
    voltagesByNet.set(netId, voltages);
  }

  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec) continue;
    if (componentSpec.specId === "resistor") {
      const firstNetId = getNetId(componentInstance.instanceId, "PIN_A");
      const secondNetId = getNetId(componentInstance.instanceId, "PIN_B");
      if (firstNetId && secondNetId && firstNetId !== secondNetId) {
        for (const [fromNetId, toNetId] of [
          [firstNetId, secondNetId],
          [secondNetId, firstNetId],
        ]) {
          const neighbors = resistorNeighbors.get(fromNetId) ?? [];
          neighbors.push(toNetId);
          resistorNeighbors.set(fromNetId, neighbors);
        }
      }
    }
    if (
      componentSpec.category !== "board" &&
      componentSpec.category !== "power_source"
    )
      continue;
    for (const pin of componentSpec.pins) {
      const netId = getNetId(componentInstance.instanceId, pin.pinName);
      if (isGroundPin(pin.pinName, pin.pinType)) {
        addVoltage(netId, 0);
      } else if (pin.pinType === "power" && pin.pinName !== "VIN") {
        // Labels such as 5V, 3V3 and 5V_1 specify nominal rail voltage.
        // maxVoltageV is a limit, never a voltage source.
        const rail = /^(\d+)V(\d*)(?:_\d+)?$/.exec(pin.pinName);
        const voltageV = rail
          ? Number(`${rail[1]}.${rail[2] || "0"}`)
          : componentSpec.supplyVoltageV;
        addVoltage(netId, voltageV);
      } else if (
        ["digital_out", "analog_out", "pwm_out", "digital_io"].includes(
          pin.pinType,
        )
      ) {
        const voltageV =
          signalOverrides === undefined
            ? pin.pinType === "digital_io"
              ? undefined
              : componentSpec.supplyVoltageV
            : signalOverrides[
                getPinRef(componentInstance.instanceId, pin.pinName)
              ];
        addVoltage(netId, voltageV);
      }
    }
  }

  function reachableVoltages(startNetId: string | undefined): number[] {
    if (!startNetId) return [];
    const visited = new Set<string>();
    const pending = [startNetId];
    const voltages = new Set<number>();
    while (pending.length > 0) {
      const netId = pending.pop()!;
      if (visited.has(netId)) continue;
      visited.add(netId);
      const fixedVoltages = voltagesByNet.get(netId);
      if (fixedVoltages?.size) {
        for (const voltageV of fixedVoltages) voltages.add(voltageV);
        continue; // A fixed reference terminates this path; do not cross ground into another load.
      }
      for (const neighbor of resistorNeighbors.get(netId) ?? []) {
        if (!visited.has(neighbor)) pending.push(neighbor);
      }
    }
    return [...voltages];
  }

  // Una alimentación invertida ocurre si VCC comparte red con GND o viceversa.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (
      !componentSpec ||
      componentSpec.category === "board" ||
      componentSpec.category === "power_source"
    )
      continue;

    const positivePinNames = findPins(componentSpec, isPositivePin);
    const groundPinNames = findPins(componentSpec, isGroundPin);
    const hasReversedSupply = positivePinNames.some((positivePinName) => {
      const positiveNetId = getNetId(
        componentInstance.instanceId,
        positivePinName,
      );
      return groundPinNames.some((groundPinName) => {
        const groundNetId = getNetId(
          componentInstance.instanceId,
          groundPinName,
        );
        if (!positiveNetId || !groundNetId) return false;

        const positiveNet = nets.find((net) => net.netId === positiveNetId);
        const groundNet = nets.find((net) => net.netId === groundNetId);
        const positiveNetHasGroundSource =
          positiveNet?.pinRefs.some((pinRef) =>
            isPowerSourcePin(pinRef, "ground"),
          ) ?? false;
        const groundNetHasPositiveSource =
          groundNet?.pinRefs.some((pinRef) =>
            isPowerSourcePin(pinRef, "power"),
          ) ?? false;
        return positiveNetHasGroundSource || groundNetHasPositiveSource;
      });
    });

    if (hasReversedSupply) {
      const affectedPinName = positivePinNames[0] ?? groundPinNames[0];
      reportViolation(
        RULE_IDS.reversedPolarity,
        componentInstance.instanceId,
        affectedPinName
          ? getPinRef(componentInstance.instanceId, affectedPinName)
          : undefined,
      );
    }
  }

  const supplyVoltageByInstance = new Map<string, number>();
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (
      !componentSpec ||
      !["sensor", "actuator"].includes(componentSpec.category)
    )
      continue;
    if (statusByInstance[componentInstance.instanceId] === "burned") continue;
    if (componentSpec.specId === "led") continue; // LED paths are checked separately below.
    if (componentSpec.actuatorKind === "motor") {
      // A DC motor is non-polarized: it runs (in either direction) whenever its
      // two terminals reach different voltages; reversing them never burns it.
      const [firstVoltages = [], secondVoltages = []] = componentSpec.pins.map(
        (pin) =>
          reachableVoltages(
            getNetId(componentInstance.instanceId, pin.pinName),
          ),
      );
      const driveVoltageV = Math.max(
        0,
        ...firstVoltages.flatMap((firstV) =>
          secondVoltages.map((secondV) => Math.abs(firstV - secondV)),
        ),
      );
      if (driveVoltageV > 0)
        supplyVoltageByInstance.set(componentInstance.instanceId, driveVoltageV);
      else statusByInstance[componentInstance.instanceId] = "unpowered";
      continue;
    }
    const positiveVoltages = findPins(componentSpec, isPositivePin).flatMap(
      (pinName) =>
        reachableVoltages(
          getNetId(componentInstance.instanceId, pinName),
        ).filter((voltageV) => voltageV > 0),
    );
    const hasGround = findPins(componentSpec, isGroundPin).some((pinName) =>
      reachableVoltages(
        getNetId(componentInstance.instanceId, pinName),
      ).includes(0),
    );
    if (positiveVoltages.length === 0 || !hasGround) {
      statusByInstance[componentInstance.instanceId] = "unpowered";
    } else {
      supplyVoltageByInstance.set(
        componentInstance.instanceId,
        Math.max(...positiveVoltages),
      );
    }
  }

  // Si un sensor/actuador entrega señal a la placa, ambas partes deben compartir GND.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (
      !componentSpec ||
      (componentSpec.category !== "sensor" &&
        componentSpec.category !== "actuator")
    )
      continue;

    const componentGroundPins = findPins(componentSpec, isGroundPin);
    if (componentGroundPins.length === 0) continue;
    const signalPins = componentSpec.pins.filter((pin) =>
      [
        "digital_in",
        "digital_out",
        "digital_io",
        "analog_in",
        "analog_out",
        "analog_io",
        "pwm_out",
      ].includes(pin.pinType),
    );

    const signalConnectedBoards = boardInstances.filter((boardInstance) => {
      const boardSpec = getSpec(boardInstance.instanceId);
      return (
        boardSpec?.pins.some(
          (boardPin) =>
            [
              "digital_in",
              "digital_out",
              "digital_io",
              "analog_in",
              "analog_out",
              "pwm_out",
            ].includes(boardPin.pinType) &&
            signalPins.some(
              (signalPin) =>
                getNetId(componentInstance.instanceId, signalPin.pinName) ===
                getNetId(boardInstance.instanceId, boardPin.pinName),
            ),
        ) ?? false
      );
    });
    if (signalConnectedBoards.length === 0) continue;

    // Every signal-connected board must share this component's ground.
    // A different board's power return cannot reference an isolated signal.
    const hasCommonGround = signalConnectedBoards.every((boardInstance) => {
      const boardSpec = getSpec(boardInstance.instanceId)!;
      return componentGroundPins.some((componentGroundPin) => {
        const componentGroundNetId = getNetId(
          componentInstance.instanceId,
          componentGroundPin,
        );
        return (
          componentGroundNetId !== undefined &&
          findPins(boardSpec, isGroundPin).some(
            (boardGroundPin) =>
              getNetId(boardInstance.instanceId, boardGroundPin) ===
              componentGroundNetId,
          )
        );
      });
    });

    if (!hasCommonGround) {
      reportViolation(
        RULE_IDS.missingCommonGround,
        componentInstance.instanceId,
        getPinRef(componentInstance.instanceId, componentGroundPins[0]),
      );
    }
  }

  // Powered component outputs can drive a signal at their operating supply.
  // Unpowered, reversed and missing-ground components never become drivers.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (
      !componentSpec ||
      statusByInstance[componentInstance.instanceId] !== "ok"
    )
      continue;
    const supplyVoltageV = supplyVoltageByInstance.get(
      componentInstance.instanceId,
    );
    if (supplyVoltageV === undefined) continue;
    for (const pin of componentSpec.pins) {
      if (
        ["digital_out", "analog_out", "pwm_out"].includes(pin.pinType) ||
        (pin.pinName === "AOUT" && signalOverrides !== undefined)
      ) {
        const voltageV =
          signalOverrides === undefined
            ? supplyVoltageV
            : signalOverrides[
                getPinRef(componentInstance.instanceId, pin.pinName)
              ];
        addVoltage(
          getNetId(componentInstance.instanceId, pin.pinName),
          voltageV,
        );
      }
    }
  }

  for (const componentInstance of allComponentInstances) {
    if (getSpec(componentInstance.instanceId)?.specId !== "led") continue;
    const anodeNetId = getNetId(componentInstance.instanceId, "ANODE");
    const cathodeNetId = getNetId(componentInstance.instanceId, "CATHODE");
    const anodeVoltages = anodeNetId
      ? [...(voltagesByNet.get(anodeNetId) ?? [])]
      : [];
    const cathodeVoltages = cathodeNetId
      ? [...(voltagesByNet.get(cathodeNetId) ?? [])]
      : [];
    // If the source and return are wired directly to the LED, no extra resistor
    // branch can remove that unsafe path. A parallel resistor is not protection.
    const hasUnprotectedPath =
      anodeNetId !== cathodeNetId &&
      anodeVoltages.some((anodeVoltageV) =>
        cathodeVoltages.some(
          (cathodeVoltageV) => anodeVoltageV > cathodeVoltageV,
        ),
      );
    if (hasUnprotectedPath) {
      reportViolation(
        RULE_IDS.ledWithoutResistor,
        componentInstance.instanceId,
      );
    } else {
      const reachableCathodeVoltages = reachableVoltages(cathodeNetId);
      const hasPoweredPath =
        anodeNetId !== cathodeNetId &&
        reachableVoltages(anodeNetId).some((anodeVoltageV) =>
          reachableCathodeVoltages.some(
            (cathodeVoltageV) => anodeVoltageV > cathodeVoltageV,
          ),
        );
      statusByInstance[componentInstance.instanceId] = hasPoweredPath
        ? "ok"
        : "unpowered";
    }
  }

  for (const boardInstance of boardInstances) {
    const boardSpec = getSpec(boardInstance.instanceId);
    if (!boardSpec?.specId.startsWith("raspberry-pi")) continue;
    for (const boardPin of boardSpec.pins) {
      if (!boardPin.pinName.startsWith("GPIO")) continue;
      const netId = getNetId(boardInstance.instanceId, boardPin.pinName);
      const voltages = netId ? [...(voltagesByNet.get(netId) ?? [])] : [];
      if (
        voltages.some((voltageV) => voltageV > (boardPin.maxVoltageV ?? 3.3))
      ) {
        reportViolation(
          RULE_IDS.overvoltageGpio,
          boardInstance.instanceId,
          getPinRef(boardInstance.instanceId, boardPin.pinName),
        );
      }
    }
  }

  // Connectivity alone is not a signal: input-only nets remain floating.
  // Bidirectional pins are inputs until the future runtime configures a driver.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec) continue;
    for (const pin of componentSpec.pins) {
      if (!["digital_in", "analog_in", "digital_io"].includes(pin.pinType))
        continue;
      const pinRef = getPinRef(componentInstance.instanceId, pin.pinName);
      if (reachableVoltages(netIdByPinRef.get(pinRef)).length === 0) {
        reportViolation(
          RULE_IDS.floatingPin,
          componentInstance.instanceId,
          pinRef,
        );
      }
    }
  }

  return { nets, statusByInstance, violations, netlistIssues };

  function isPowerSourcePin(
    pinRef: string,
    expectedType: "power" | "ground",
  ): boolean {
    const pinAddress = pinRef.split("/");
    const componentInstance = componentByInstanceId.get(pinAddress[0]);
    if (!componentInstance) return false;
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec) return false;

    const pinSpec = componentSpec.pins.find(
      (pin) => pin.pinName === pinAddress[1],
    );
    if (!pinSpec) return false;
    const isPowerSource =
      componentSpec.category === "power_source" ||
      componentSpec.category === "board";
    if (!isPowerSource) return false;
    return expectedType === "ground"
      ? isGroundPin(pinSpec.pinName, pinSpec.pinType)
      : isPositivePin(pinSpec.pinName, pinSpec.pinType);
  }
}
