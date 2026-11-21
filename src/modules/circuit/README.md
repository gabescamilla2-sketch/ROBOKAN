# Circuit editor and runtime boundary

The existing home page remains the entry point. Choose a project, then **Abrir circuito**. The editor is a separate `circuit.html` page; programming, missions and the 3D world are not implemented here.

## Run locally

```sh
npm ci --ignore-scripts
npm run test:circuit
npm run typecheck:circuit
npm run build
npm run dev
```

Vite serves the home page and circuit page at the printed local URL. Production output is `dist/`. Serve that directory over HTTP; do not open the TSX source as a file URL. Existing static assets are copied into the multipage build unchanged. The classic background-script and dynamic-URL build warnings originate from the existing home assets and require browser verification, not a false clean-build claim.

## Public API

Import through `src/modules/circuit/index.ts`; shared types, events and ID allocation come from `src/core/index.ts`.

- `CircuitEditor({ graph, specs, onChange, drives?, onDriveChange?, ghostWires?, events?, onLoad? })` is controlled. The caller owns the one `RobotDefinition`; merge circuit changes into it without replacing the program or chassis. `onLoad` lets the owner clear runtime drives when replacing a circuit.
- `evaluate(graph, specs, drives)` returns `CircuitState`, including every pin's signal. Omitted drives are floating. Digital LOW, HIGH, analog values and PWM remain distinct. A drive must target a declared output/bidirectional pin; invalid signal values are rejected.
- `createCircuitApi({ getGraph, getSpecs, getBoardInstanceId, getDrives })` binds that context without copying robot state. Its `evaluate()` and `resolvePin("D9")` are the runtime-facing methods. `connections("D9")` lists connected PinRefs for the hardware bridge.
- `createExecuteHardwareInstruction({ getCircuitGraph, getComponentSpecs, getBoardInstanceId, world })` is the Role 4 bridge for `ProgramRunner`. It re-reads the current graph/catalog per instruction, validates the circuit before a world call, resolves an ultrasonic sensor by the board's TRIG/ECHO nets, and routes digital LED, buzzer and motor commands through `world.applyActuator`. The structural `CircuitWorldApi` and `WorldActuatorCommand` types are exported here so Role 3 can implement the matching public world API.
- `publishCircuitChanges(previous, next, events)` emits typed circuit/pin/burn transitions. The bus is scoped to its caller and returns unsubscribe functions.
- Legacy `buildNetlist`, `createPinRef`, `parsePinRef` and `evaluateCircuitRules` exports remain. The latter retains its static potential-HIGH defaults unless a signal override map is explicitly supplied. Use `evaluate`, not the legacy static rule adapter, for runtime values.

The development page accepts a production catalog through the same `ComponentSpec[]` boundary. Its own fixtures in `src/dev/circuit-fixtures.ts` are schematic demonstration data, not a replacement for the Role 5 catalog, assets or physically validated component ratings. Supplied `svgPath` assets are rendered without injecting SVG markup; an empty path uses a schematic fallback. The production catalog (`src/modules/components/index.ts`), world API/3D renderer (`src/modules/world/index.ts`), and final Blocks-to-ProgramRunner wiring are still required for end-to-end use; the current Block set has no flame, gas or servo instruction.

## Editor behavior

Drag or tap palette pieces; drag components to move on a 20-unit grid. Click two pins or use the source/destination selects to connect them. Select wires to delete them. Keyboard: arrows move the selected component, R rotates it, Delete removes it, Escape cancels a pending wire. Zoom controls/wheel and background panning operate on the SVG viewport. Pin tooltips and inspector rows show names and volts. Optional ghost wires mark missing expected connections.

**Guardar en este equipo** stores the circuit locally; **Recuperar guardado** replaces it only after validation. JSON download/import uses a version1 envelope. Loading validates collection limits, catalog membership, unique IDs, finite positions, quarter-turn rotations, known pin refs, wire colors and ID allocation watermarks. It never imports C++/program text or executes file content. Browser storage can fail; export remains a separate fallback.

## Electrical limits

Boards/batteries supply nominal rails. Breadboard columns join a-e and f-j separately; numbered columns, positive/negative and top/bottom rails remain isolated. Each declared rail is continuous; physically split rails need a future connectivity profile. Resistor paths stop at fixed references; conflicting drivers are floating and reported. There is no SPICE/current solver, resistor-divider calculation, motor physics or synthetic world sensing. Sensor values must be supplied by the world/runtime through valid pin drives; unpowered/burned outputs do not propagate.

Burned state is recomputed per snapshot; persistent damage/reset semantics belong to the simulation owner. The typed bridge and controlled editor are ready for other roles, but no C++ compiler, mission engine, production component registry or world implementation is claimed.

## Verification status

See `odd/tasks/circuit-editor-integration.md` for observed checks and exact limitations. A previous foundation review is still escalated; passing tests is not a review approval or publishing permission. No site was deployed.
