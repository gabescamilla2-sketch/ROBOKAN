import type {
  CircuitState,
  PinRef,
  PinSignal,
  RobotDefinition,
  RuleId,
} from "./contract";
export interface CircuitEvents {
  "circuit:changed": { circuitState: CircuitState };
  "pin:changed": { pinRef: PinRef; signal: PinSignal };
  "component:burned": { instanceId: string; ruleId: RuleId };
  "robot:changed": { robotDefinition: RobotDefinition };
  "world:reset": undefined;
}
/** Instance-scoped bus; no global robot state or permanent listeners. */
export function createCircuitEventBus() {
  const listeners = new Map<keyof CircuitEvents, Set<(event: never) => void>>();
  return {
    on<K extends keyof CircuitEvents>(
      name: K,
      listener: (event: CircuitEvents[K]) => void,
    ) {
      const handlers = listeners.get(name) ?? new Set();
      handlers.add(listener as (event: never) => void);
      listeners.set(name, handlers);
      return () => {
        handlers.delete(listener as (event: never) => void);
      };
    },
    emit<K extends keyof CircuitEvents>(name: K, event: CircuitEvents[K]) {
      for (const handler of [...(listeners.get(name) ?? [])])
        handler(event as never);
    },
  };
}
export type CircuitEventBus = ReturnType<typeof createCircuitEventBus>;
