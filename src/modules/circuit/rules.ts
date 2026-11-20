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

const RULE_IDS = {
  ledWithoutResistor: "led_without_resistor",
  reversedPolarity: "reversed_polarity",
  missingCommonGround: "missing_common_ground",
  overvoltageGpio: "overvoltage_gpio",
  floatingPin: "floating_pin",
} as const;

/** Evalúa las reglas educativas sobre una fotografía del circuito. */
export function evaluateCircuitRules(
  circuitGraph: CircuitGraphInput,
  componentSpecs: readonly CircuitRuleSpec[],
): CircuitRuleResult {
  const specById = new Map(componentSpecs.map((componentSpec) => [componentSpec.specId, componentSpec]));
  const pinNamesBySpecId = Object.fromEntries(
    componentSpecs.map((componentSpec) => [
      componentSpec.specId,
      componentSpec.pins.map((pin) => pin.pinName),
    ]),
  );
  const { nets, issues: netlistIssues } = buildNetlist(circuitGraph, pinNamesBySpecId);
  const componentByInstanceId = new Map(
    circuitGraph.componentInstances.map((componentInstance) => [componentInstance.instanceId, componentInstance]),
  );
  const netIdByPinRef = new Map<string, string>();
  for (const net of nets) {
    for (const pinRef of net.pinRefs) netIdByPinRef.set(pinRef, net.netId);
  }

  const violations: RuleViolation[] = [];
  const reportedViolations = new Set<string>();
  const statusByInstance: Record<string, string> = Object.fromEntries(
    circuitGraph.componentInstances.map((componentInstance) => [componentInstance.instanceId, "ok"]),
  );

  function reportViolation(ruleId: string, instanceId: string, pinRef?: string): void {
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
      ruleId === RULE_IDS.ledWithoutResistor
      || ruleId === RULE_IDS.reversedPolarity
      || ruleId === RULE_IDS.overvoltageGpio
    ) {
      statusByInstance[instanceId] = "burned";
    } else if (ruleId === RULE_IDS.missingCommonGround && statusByInstance[instanceId] !== "burned") {
      statusByInstance[instanceId] = "unpowered";
    }
  }

  function getSpec(instanceId: string): CircuitRuleSpec | undefined {
    const componentInstance = componentByInstanceId.get(instanceId);
    return componentInstance ? specById.get(componentInstance.specId) : undefined;
  }

  function getPinRef(instanceId: string, pinName: string): string {
    return createPinRef(instanceId, pinName);
  }

  function getNetId(instanceId: string, pinName: string): string | undefined {
    return netIdByPinRef.get(getPinRef(instanceId, pinName));
  }

  function findPins(componentSpec: CircuitRuleSpec, matches: (pinName: string, pinType: string) => boolean): string[] {
    return componentSpec.pins
      .filter((pin) => matches(pin.pinName, pin.pinType))
      .map((pin) => pin.pinName);
  }

  function isGroundPin(pinName: string, pinType: string): boolean {
    return pinType === "ground" || pinName === "GND" || pinName.startsWith("GND_") || pinName === "NEGATIVE";
  }

  function isPositivePin(pinName: string, pinType: string): boolean {
    return pinType === "power" || ["VCC", "5V", "3V3", "VIN", "POSITIVE"].includes(pinName);
  }

  const allComponentInstances = circuitGraph.componentInstances;
  const boardInstances = allComponentInstances.filter((componentInstance) =>
    getSpec(componentInstance.instanceId)?.category === "board",
  );
  // Un pin de entrada aislado no recibe una señal útil.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec) continue;

    for (const pin of componentSpec.pins) {
      if (pin.pinType !== "digital_in" && pin.pinType !== "analog_in") continue;
      const pinRef = getPinRef(componentInstance.instanceId, pin.pinName);
      const net = nets.find((candidateNet) => candidateNet.netId === netIdByPinRef.get(pinRef));
      if (net?.pinRefs.length === 1) {
        reportViolation(RULE_IDS.floatingPin, componentInstance.instanceId, pinRef);
      }
    }
  }

  // Una alimentación invertida ocurre si VCC comparte red con GND o viceversa.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec || componentSpec.category === "board" || componentSpec.category === "power_source") continue;

    const positivePinNames = findPins(componentSpec, isPositivePin);
    const groundPinNames = findPins(componentSpec, isGroundPin);
    const hasReversedSupply = positivePinNames.some((positivePinName) => {
      const positiveNetId = getNetId(componentInstance.instanceId, positivePinName);
      return groundPinNames.some((groundPinName) => {
        const groundNetId = getNetId(componentInstance.instanceId, groundPinName);
        if (!positiveNetId || !groundNetId) return false;

        const positiveNet = nets.find((net) => net.netId === positiveNetId);
        const groundNet = nets.find((net) => net.netId === groundNetId);
        const positiveNetHasGroundSource = positiveNet?.pinRefs.some((pinRef) =>
          isPowerSourcePin(pinRef, "ground"),
        ) ?? false;
        const groundNetHasPositiveSource = groundNet?.pinRefs.some((pinRef) =>
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
        affectedPinName ? getPinRef(componentInstance.instanceId, affectedPinName) : undefined,
      );
    }
  }

  // Si un sensor/actuador entrega señal a la placa, ambas partes deben compartir GND.
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec || (componentSpec.category !== "sensor" && componentSpec.category !== "actuator")) continue;

    const componentGroundPins = findPins(componentSpec, isGroundPin);
    if (componentGroundPins.length === 0) continue;
    const signalPins = componentSpec.pins.filter((pin) =>
      ["digital_out", "digital_io", "analog_in", "analog_out", "analog_io", "pwm_out"].includes(pin.pinType),
    );

    const hasSignalConnectedToBoard = signalPins.some((signalPin) => {
      const signalNetId = getNetId(componentInstance.instanceId, signalPin.pinName);
      return signalNetId !== undefined && boardInstances.some((boardInstance) => {
        const boardSpec = getSpec(boardInstance.instanceId);
        return boardSpec?.pins.some((boardPin) =>
          ["digital_in", "digital_out", "digital_io", "analog_in", "analog_out", "pwm_out"].includes(boardPin.pinType)
          && getNetId(boardInstance.instanceId, boardPin.pinName) === signalNetId,
        ) ?? false;
      });
    });

    if (!hasSignalConnectedToBoard) continue;

    const hasCommonGround = componentGroundPins.some((componentGroundPin) => {
      const componentGroundNetId = getNetId(componentInstance.instanceId, componentGroundPin);
      return componentGroundNetId !== undefined && boardInstances.some((boardInstance) => {
        const boardSpec = getSpec(boardInstance.instanceId);
        return boardSpec ? findPins(boardSpec, isGroundPin).some((boardGroundPin) =>
          getNetId(boardInstance.instanceId, boardGroundPin) === componentGroundNetId,
        ) : false;
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

  // El LED requiere una resistencia que esté eléctricamente en serie entre
  // uno de sus terminales y una salida/fuente. Compartir la misma red no basta.
  const sourceNetIds = new Set<string>();
  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec || (componentSpec.category !== "board" && componentSpec.category !== "power_source")) continue;

    for (const pinName of findPins(componentSpec, (_pinName, pinType) =>
      ["power", "digital_out", "digital_io", "pwm_out"].includes(pinType),
    )) {
      const netId = getNetId(componentInstance.instanceId, pinName);
      if (netId) sourceNetIds.add(netId);
    }

    for (const groundPinName of findPins(componentSpec, isGroundPin)) {
      const groundNetId = getNetId(componentInstance.instanceId, groundPinName);
      if (groundNetId) sourceNetIds.add(groundNetId);
    }
  }

  const resistorInstances = allComponentInstances.filter((componentInstance) =>
    getSpec(componentInstance.instanceId)?.specId === "resistor",
  );

  for (const componentInstance of allComponentInstances) {
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec || componentSpec.specId !== "led") continue;

    const anodeNetId = getNetId(componentInstance.instanceId, "ANODE");
    const cathodeNetId = getNetId(componentInstance.instanceId, "CATHODE");
    const isConnectedAcrossSourceAndGround = !!anodeNetId
      && !!cathodeNetId
      && anodeNetId !== cathodeNetId
      && sourceNetIds.has(anodeNetId)
      && sourceNetIds.has(cathodeNetId);

    // Un LED sin alimentación no se quema; la regla solo se activa si queda
    // conectado entre una salida/fuente y GND.
    if (!isConnectedAcrossSourceAndGround) continue;

    const hasSeriesResistor = resistorInstances.some((resistorInstance) => {
      const pinANetId = getNetId(resistorInstance.instanceId, "PIN_A");
      const pinBNetId = getNetId(resistorInstance.instanceId, "PIN_B");
      return (
        (pinANetId === anodeNetId && !!pinBNetId && pinBNetId !== anodeNetId && sourceNetIds.has(pinBNetId))
        || (pinBNetId === anodeNetId && !!pinANetId && pinANetId !== anodeNetId && sourceNetIds.has(pinANetId))
        || (pinANetId === cathodeNetId && !!pinBNetId && pinBNetId !== cathodeNetId && sourceNetIds.has(pinBNetId))
        || (pinBNetId === cathodeNetId && !!pinANetId && pinANetId !== cathodeNetId && sourceNetIds.has(pinANetId))
      );
    });

    if (!hasSeriesResistor) {
      reportViolation(RULE_IDS.ledWithoutResistor, componentInstance.instanceId);
    }
  }

  // HC-SR04 ECHO entrega 5 V. Una conexión directa a un GPIO de Pi de 3.3 V
  // comparte red sin ningún divisor intermedio.
  for (const sensorInstance of allComponentInstances) {
    const sensorSpec = getSpec(sensorInstance.instanceId);
    if (sensorSpec?.specId !== "hc-sr04") continue;

    const echoNetId = getNetId(sensorInstance.instanceId, "ECHO");
    if (!echoNetId) continue;
    const echoPin = sensorSpec.pins.find((pin) => pin.pinName === "ECHO");
    const echoVoltageV = echoPin?.maxVoltageV ?? sensorSpec.maxVoltageV ?? sensorSpec.supplyVoltageV ?? 5;

    for (const boardInstance of boardInstances) {
      const boardSpec = getSpec(boardInstance.instanceId);
      if (!boardSpec?.specId.startsWith("raspberry-pi")) continue;

      for (const boardPin of boardSpec.pins) {
        if (!boardPin.pinName.startsWith("GPIO")) continue;
        const boardPinNetId = getNetId(boardInstance.instanceId, boardPin.pinName);
        const boardPinMaxVoltageV = boardPin.maxVoltageV ?? 3.3;
        if (boardPinNetId === echoNetId && echoVoltageV > boardPinMaxVoltageV) {
          reportViolation(
            RULE_IDS.overvoltageGpio,
            boardInstance.instanceId,
            getPinRef(boardInstance.instanceId, boardPin.pinName),
          );
        }
      }
    }
  }

  return { nets, statusByInstance, violations, netlistIssues };

  function isPowerSourcePin(pinRef: string, expectedType: "power" | "ground"): boolean {
    const pinAddress = pinRef.split("/");
    const componentInstance = componentByInstanceId.get(pinAddress[0]);
    if (!componentInstance) return false;
    const componentSpec = getSpec(componentInstance.instanceId);
    if (!componentSpec) return false;

    const pinSpec = componentSpec.pins.find((pin) => pin.pinName === pinAddress[1]);
    if (!pinSpec) return false;
    const isPowerSource = componentSpec.category === "power_source" || componentSpec.category === "board";
    if (!isPowerSource) return false;
    return expectedType === "ground"
      ? isGroundPin(pinSpec.pinName, pinSpec.pinType)
      : isPositivePin(pinSpec.pinName, pinSpec.pinType);
  }
}
