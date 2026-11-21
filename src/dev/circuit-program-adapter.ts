import type { CircuitGraph, ComponentSpec, ExecuteHardwareInstruction, PinDrives, RuleViolation } from "../core";
import { evaluate, createPinRef } from "../modules/circuit";

// Development bridge until the integrated circuit/world factory is published.
export function createCircuitProgramAdapter(context: {
  getGraph(): CircuitGraph;
  getSpecs(): readonly ComponentSpec[];
  getBoardInstanceId(): string;
  getDrives(): PinDrives;
  setDrives(drives: PinDrives): void;
  getDistanceCm(): number;
}): ExecuteHardwareInstruction {
  return async (instruction, signal) => {
    signal.throwIfAborted();
    const graph = context.getGraph();
    const specs = context.getSpecs();
    const boardId = context.getBoardInstanceId();
    const board = graph.componentInstances.find((instance) => instance.instanceId === boardId);
    if (!board || specs.find((spec) => spec.specId === board.specId)?.category !== "board") throw new Error("Selecciona una placa en el circuito.");
    const drives = context.getDrives();
    const state = evaluate(graph, specs, drives);
    if (instruction.op === "digital_write") {
      const pinRef = createPinRef(boardId, instruction.pinName);
      const pin = specs.find((spec) => spec.specId === board.specId)?.pins.find((pin) => pin.pinName === instruction.pinName);
      if (!pin || !["digital_out", "digital_io", "pwm_out"].includes(pin.pinType)) throw new Error("El pin seleccionado no permite salida digital.");
      const next: PinDrives = { ...drives, [pinRef]: { signalKind: "digital", voltageV: instruction.digitalValue ? Math.min(pin.maxVoltageV ?? 5, 5) : 0, digitalValue: instruction.digitalValue } };
      const result = evaluate(graph, specs, next);
      signal.throwIfAborted();
      // LOW must remain available to stop a previously driven circuit.
      const blockingViolations = result.violations.filter((violation) => violation.ruleId !== "floating_pin");
      if (instruction.digitalValue === 1 && blockingViolations.length) return { kind: "electrical_error", violations: blockingViolations };
      context.setDrives(next);
      return { kind: "completed" };
    }
    if (instruction.op !== "read_distance") throw new Error("Motor y buzzer requieren el adaptador de circuito y mundo pendiente de integración.");
    const netFor = (pin: string) => state.nets.find((net) => net.pinRefs.includes(createPinRef(boardId, pin)))?.pinRefs ?? [];
    const trig = netFor(instruction.trigPinName);
    const echo = netFor(instruction.echoPinName);
    const sensor = graph.componentInstances.find((instance) => instance.specId === "hc-sr04" && trig.includes(`${instance.instanceId}/TRIG`) && echo.includes(`${instance.instanceId}/ECHO`));
    if (!sensor) throw new Error("Conecta TRIG y ECHO de un mismo HC-SR04 a los pines del bloque.");
    // Wiring and supply are checked here. Pulse timing comes from the future
    // world adapter; undriven digital pins are informational in this 2D bridge.
    const violations: RuleViolation[] = state.violations.filter((violation) => violation.ruleId !== "floating_pin" && [sensor.instanceId, boardId].includes(violation.instanceId));
    if (state.statusByInstance[sensor.instanceId] !== "ok" && violations.length === 0) violations.push({ ruleId: "missing_power", instanceId: sensor.instanceId, messageKey: "errors.missing_power" });
    if (violations.length) return { kind: "electrical_error", violations };
    signal.throwIfAborted();
    const reading = context.getDistanceCm();
    if (!Number.isFinite(reading) || reading < 0) throw new Error("La distancia de prueba debe ser positiva o cero.");
    return { kind: "reading", resultId: instruction.resultId, reading };
  };
}
