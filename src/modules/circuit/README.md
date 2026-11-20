# Circuit rule checks

Run the educational electrical rules independently of the static website:

```sh
npm ci --ignore-scripts
npm run test:circuit
npm run typecheck:circuit
```

`npm test` runs all `tests/circuit-*.test.ts` files. Other modules are intentionally excluded until their own runners and contracts are defined. Development dependencies are locked; no production dependency or website bundler is added. Node must match the `engines` range in the root package manifest. Vitest setup reference: https://vitest.dev/guide/ .

## Public boundary

Import from this module's `index.ts`. Existing `buildNetlist`, `createPinRef`, `parsePinRef`, `evaluateCircuitRules` and result types remain available. `evaluateCircuitRules(graph, specs)` is a pure snapshot evaluation: it does not mutate the graph or retain burned state between calls.

`CircuitRuleSpec` is still a temporary structural adapter, not a replacement for the future shared `core` contract. Supply a component's nominal operating `supplyVoltageV`; `maxVoltageV` is a limit, not an emitted signal. Named board rails such as `5V`, `3V3` and `5V_1` carry their labeled nominal voltages. `VIN` is an input, not a board voltage source.

## Simplified electrical model

- Boards and batteries are assumed available as power sources. Explicit board `digital_out`/`pwm_out` pins represent potential HIGH at the board's operating supply. They do not simulate a running program, LOW, or PWM timing. `digital_io` is treated as an input until runtime direction is implemented.
- Sensors and actuators with supply pins require a positive supply path and ground. Missing common ground is checked for both signal inputs and outputs against every signal-connected board, not an unrelated board. Unpowered or reversed components do not drive signal outputs.
- Direct powered output potentials are used for GPIO overvoltage checks, including supplies and sensor outputs. A component's maximum rating never supplies a voltage.
- A direct forward voltage difference across an LED without a series resistance is unsafe. Parallel or bypassed resistors do not protect it. Series resistor paths on either side are recognized; resistor values, current and voltage drops are not calculated.
- The temporary adapter also recognizes legacy `analog_out` specs as driven outputs, preserving their distinction from input-only nets. This does not add a shared `PinType` or simulate an analog reading.
- Resistor-path traversal stops at a fixed source or ground reference. It cannot cross ground and discover a positive supply through an unrelated load.
- Inputs need a driving source or a ground/pull-resistor reference. Connecting inputs only to each other does not supply a signal.

This is not a voltage solver. General voltage propagation, resistor dividers, competing-source/short-circuit behavior, analog sensor readings and actual GPIO direction/value require the next runtime signal layer. These checks must not be presented as a complete electrical simulation.

## Remaining Role 4 work

The editor, breadboard internal connections, runtime `CircuitState.signalByPin`, public `evaluate`/`resolvePin`, help wires, serialization, event integration and working dev page are not implemented by this foundation. Shared types/events and component specs/assets require coordination with roles 3 and 5; none of their modules is changed here.
