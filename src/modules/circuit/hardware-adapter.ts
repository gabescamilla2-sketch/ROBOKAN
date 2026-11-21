import type {
  CircuitGraph,
  ComponentSpec,
  ExecuteHardwareInstruction,
  HardwareInstruction,
  InstructionResult,
  PinDrives,
  PinSignal,
  RuleViolation,
} from "../../core";
import { RULE_IDS } from "../../core";
import { createPinRef } from "./netlist";
import { evaluate } from "./api";

import type { WorldActuatorCommand } from "../world";
export type { WorldActuatorCommand } from "../world";

export interface CircuitWorldApi {
  query: {
    ultrasonicDistanceCm(instanceId: string): number | Promise<number>;
    flameIntensityNorm(instanceId: string): number | Promise<number>;
    gasLevelNorm(instanceId: string): number | Promise<number>;
    groundReflectanceNorm(instanceId: string): number | Promise<number>;
    temperatureC?(instanceId: string): number | Promise<number>;
  };
  applyActuator(command: WorldActuatorCommand): void | Promise<void>;
}

export interface ExecuteHardwareDependencies {
  getCircuitGraph(): CircuitGraph;
  getComponentSpecs(): readonly ComponentSpec[];
  getBoardInstanceId(): string;
  world: CircuitWorldApi;
  onDrivesChange?(drives: PinDrives): void;
}

const aborted = (signal: AbortSignal) => {
  if (!signal.aborted) return;
  const error = new Error("Hardware instruction was cancelled");
  error.name = "AbortError";
  throw error;
};

function rule(
  ruleId: RuleViolation["ruleId"],
  instanceId: string,
  pinRef?: string,
): RuleViolation {
  return {
    ruleId,
    instanceId,
    ...(pinRef ? { pinRef } : {}),
    messageKey: `errors.${ruleId}`,
  };
}

/**
 * Builds the circuit-to-world bridge used by ProgramRunner. Graph/catalog/board
 * getters are read for every instruction so edits made before Run are honored.
 */
export function createExecuteHardwareInstruction(
  dependencies: ExecuteHardwareDependencies,
): ExecuteHardwareInstruction {
  const outputDrives: Record<string, PinSignal> = {};

  return async (
    instruction: HardwareInstruction,
    signal: AbortSignal,
  ): Promise<InstructionResult> => {
    aborted(signal);
    const graph = dependencies.getCircuitGraph();
    const specs = dependencies.getComponentSpecs();
    const boardInstanceId = dependencies.getBoardInstanceId();
    const board = graph.componentInstances.find(
      (instance) => instance.instanceId === boardInstanceId,
    );
    const boardSpec =
      board && specs.find((spec) => spec.specId === board.specId);
    if (!board || boardSpec?.category !== "board")
      return {
        kind: "electrical_error",
        violations: [rule(RULE_IDS.missingPower, boardInstanceId || "circuit")],
      };

    const circuitState = evaluate(graph, specs, outputDrives as PinDrives);
    const blockingViolations = circuitState.violations.filter(
      (violation) => violation.ruleId !== RULE_IDS.floatingPin,
    );
    const isShutdown =
      (instruction.op === "motor_write" && instruction.speedPct === 0) ||
      (instruction.op === "buzzer_write" && !instruction.isOn) ||
      (instruction.op === "digital_write" && instruction.digitalValue === 0);
    if (blockingViolations.length && !isShutdown)
      return {
        kind: "electrical_error",
        violations: blockingViolations,
      };

    const componentById = new Map(
      graph.componentInstances.map((instance) => [
        instance.instanceId,
        instance,
      ]),
    );
    const specById = new Map(specs.map((spec) => [spec.specId, spec]));
    const netFor = (pinRef: string) =>
      circuitState.nets.find((net) => net.pinRefs.includes(pinRef));
    const boardPinConnected = (
      pinRef: string,
      accepts: (pinType: string) => boolean,
    ) =>
      netFor(pinRef)?.pinRefs.some((ref) => {
        const slash = ref.lastIndexOf("/");
        if (ref.slice(0, slash) !== boardInstanceId) return false;
        const boardPin = boardSpec.pins.find(
          (pin) => pin.pinName === ref.slice(slash + 1),
        );
        return !!boardPin && accepts(boardPin.pinType);
      }) ?? false;
    const resistorEdges = new Map<string, Set<string>>();
    const joinResistorNets = (a: string | undefined, b: string | undefined) => {
      if (!a || !b || a === b) return;
      resistorEdges.set(a, new Set([...(resistorEdges.get(a) ?? []), b]));
      resistorEdges.set(b, new Set([...(resistorEdges.get(b) ?? []), a]));
    };
    for (const instance of graph.componentInstances) {
      if (
        specs.find((spec) => spec.specId === instance.specId)?.specId !==
        "resistor"
      )
        continue;
      joinResistorNets(
        netFor(createPinRef(instance.instanceId, "PIN_A"))?.netId,
        netFor(createPinRef(instance.instanceId, "PIN_B"))?.netId,
      );
    }
    const reachesThroughResistors = (fromRef: string, toRef: string) => {
      const start = netFor(fromRef)?.netId;
      const target = netFor(toRef)?.netId;
      if (!start || !target) return false;
      const pending = [start],
        visited = new Set<string>();
      while (pending.length) {
        const current = pending.pop()!;
        if (current === target) return true;
        if (visited.has(current)) continue;
        visited.add(current);
        pending.push(...(resistorEdges.get(current) ?? []));
      }
      return false;
    };
    const powered = (instanceId: string) =>
      circuitState.statusByInstance[instanceId] === "ok";
    const rejectUnpowered = (instanceId: string): InstructionResult => {
      const instance = componentById.get(instanceId);
      const spec = instance && specById.get(instance.specId);
      const supplyPin = spec?.pins.find((pin) => pin.pinType === "power");
      return {
        kind: "electrical_error",
        violations: [
          rule(
            RULE_IDS.missingPower,
            instanceId,
            supplyPin ? createPinRef(instanceId, supplyPin.pinName) : undefined,
          ),
        ],
      };
    };

    if (instruction.op === "read_distance") {
      const trigRef = createPinRef(boardInstanceId, instruction.trigPinName);
      const echoRef = createPinRef(boardInstanceId, instruction.echoPinName);
      const trigNet = netFor(trigRef);
      const echoNet = netFor(echoRef);
      const sensor = graph.componentInstances
        .map((instance) => ({ instance, spec: specById.get(instance.specId) }))
        .find(
          ({ instance, spec }) =>
            spec?.sensorKind === "ultrasonic" &&
            trigNet?.pinRefs.includes(
              createPinRef(instance.instanceId, "TRIG"),
            ) &&
            echoNet?.pinRefs.includes(
              createPinRef(instance.instanceId, "ECHO"),
            ),
        );
      if (!sensor?.spec)
        return {
          kind: "electrical_error",
          violations: [
            rule(RULE_IDS.floatingPin, boardInstanceId, trigRef),
            rule(RULE_IDS.floatingPin, boardInstanceId, echoRef),
          ],
        };
      if (!powered(sensor.instance.instanceId))
        return rejectUnpowered(sensor.instance.instanceId);
      aborted(signal);
      const reading = await dependencies.world.query.ultrasonicDistanceCm(
        sensor.instance.instanceId,
      );
      aborted(signal);
      if (!Number.isFinite(reading) || reading < 0)
        throw new Error("World returned an invalid distance in centimeters");
      return { kind: "reading", resultId: instruction.resultId, reading };
    }

    if (instruction.op === "sensor_read") {
      const instance = componentById.get(instruction.instanceId);
      const sensorSpec = instance && specById.get(instance.specId);
      if (!sensorSpec?.sensorKind || sensorSpec.sensorKind === "ultrasonic")
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, instruction.instanceId)],
        };
      if (!powered(instruction.instanceId))
        return rejectUnpowered(instruction.instanceId);
      const output = sensorSpec.pins.find((pin) =>
        ["analog_in", "digital_out"].includes(pin.pinType),
      );
      const outputRef = output && createPinRef(instruction.instanceId, output.pinName);
      if (!outputRef || !boardPinConnected(outputRef, (type) =>
        ["digital_io", "digital_in", "analog_in", "pwm_out"].includes(type),
      ))
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, instruction.instanceId, outputRef)],
        };
      aborted(signal);
      const query = dependencies.world.query;
      const reading = sensorSpec.sensorKind === "flame"
        ? await query.flameIntensityNorm(instruction.instanceId)
        : sensorSpec.sensorKind === "gas"
          ? await query.gasLevelNorm(instruction.instanceId)
          : sensorSpec.sensorKind === "infrared"
            ? await query.groundReflectanceNorm(instruction.instanceId)
            : query.temperatureC
              ? await query.temperatureC(instruction.instanceId)
              : Number.NaN;
      aborted(signal);
      if (!Number.isFinite(reading))
        throw new Error("World returned an invalid sensor reading");
      return { kind: "reading", resultId: instruction.resultId, reading };
    }

    if (instruction.op === "digital_write") {
      const pinRef = createPinRef(boardInstanceId, instruction.pinName);
      const pin = boardSpec.pins.find(
        (candidate) => candidate.pinName === instruction.pinName,
      );
      if (
        !pin ||
        !["digital_io", "pwm_out"].includes(pin.pinType) ||
        (instruction.digitalValue !== 0 && instruction.digitalValue !== 1)
      )
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, boardInstanceId, pinRef)],
        };
      const voltageV =
        instruction.digitalValue === 0
          ? 0
          : (pin.maxVoltageV ?? boardSpec.supplyVoltageV);
      const nextDrive: PinSignal = {
        signalKind: "digital",
        voltageV,
        digitalValue: instruction.digitalValue,
      };
      const candidateDrives = { ...outputDrives, [pinRef]: nextDrive };
      const drivenState = evaluate(graph, specs, candidateDrives);
      const drivenViolations = drivenState.violations.filter(
        (violation) => violation.ruleId !== RULE_IDS.floatingPin,
      );
      if (instruction.digitalValue === 1 && drivenViolations.length)
        return {
          kind: "electrical_error",
          violations: drivenViolations,
        };
      const targets = graph.componentInstances.flatMap((instance) => {
        const spec = specById.get(instance.specId);
        if (spec?.actuatorKind !== "led") return [];
        const anode = createPinRef(instance.instanceId, "ANODE");
        const cathode = createPinRef(instance.instanceId, "CATHODE");
        return reachesThroughResistors(pinRef, anode) ||
          reachesThroughResistors(pinRef, cathode)
          ? [{ instance, spec }]
          : [];
      });
      for (const target of targets) {
        if (
          instruction.digitalValue === 1 &&
          drivenState.statusByInstance[target.instance.instanceId] !== "ok"
        )
          return {
            kind: "electrical_error",
            violations: [
              rule(
                RULE_IDS.missingPower,
                target.instance.instanceId,
                createPinRef(target.instance.instanceId, "VCC"),
              ),
            ],
          };
      }
      for (const target of targets) {
        aborted(signal);
        await dependencies.world.applyActuator({
          instanceId: target.instance.instanceId,
          actuatorKind: "led",
          isOn: instruction.digitalValue === 1,
          brightnessNorm: instruction.digitalValue,
        });
      }
      aborted(signal);
      outputDrives[pinRef] = nextDrive;
      dependencies.onDrivesChange?.({ ...outputDrives });
      return { kind: "completed" };
    }

    if (instruction.op === "motor_write") {
      const motor = componentById.get(instruction.instanceId);
      const motorSpec = motor && specById.get(motor.specId);
      if (motorSpec?.actuatorKind !== "motor")
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, instruction.instanceId)],
        };
      if (instruction.speedPct !== 0 && !powered(instruction.instanceId))
        return rejectUnpowered(instruction.instanceId);
      aborted(signal);
      await dependencies.world.applyActuator({
        instanceId: instruction.instanceId,
        actuatorKind: "motor",
        speedPct: instruction.speedPct,
      });
      return { kind: "completed" };
    }

    if (instruction.op === "buzzer_write") {
      const buzzer = componentById.get(instruction.instanceId);
      const buzzerSpec = buzzer && specById.get(buzzer.specId);
      if (buzzerSpec?.actuatorKind !== "buzzer")
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, instruction.instanceId)],
        };
      if (instruction.isOn && !powered(instruction.instanceId))
        return rejectUnpowered(instruction.instanceId);
      aborted(signal);
      await dependencies.world.applyActuator({
        instanceId: instruction.instanceId,
        actuatorKind: "buzzer",
        isOn: instruction.isOn,
        frequencyHz: instruction.frequencyHz,
      });
      return { kind: "completed" };
    }

    if (instruction.op === "servo_write") {
      const instance = componentById.get(instruction.instanceId);
      if (specById.get(instance?.specId ?? "")?.actuatorKind !== "servo")
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, instruction.instanceId)],
        };
      if (!powered(instruction.instanceId))
        return rejectUnpowered(instruction.instanceId);
      const signalRef = createPinRef(instruction.instanceId, "SIGNAL");
      if (!boardPinConnected(signalRef, (type) =>
        ["digital_io", "pwm_out"].includes(type),
      ))
        return {
          kind: "electrical_error",
          violations: [rule(RULE_IDS.floatingPin, instruction.instanceId, signalRef)],
        };
      aborted(signal);
      await dependencies.world.applyActuator({
        instanceId: instruction.instanceId,
        actuatorKind: "servo",
        angleDeg: Math.max(0, Math.min(180, instruction.angleDeg)),
      });
      return { kind: "completed" };
    }

    return { kind: "completed" };
  };
}
