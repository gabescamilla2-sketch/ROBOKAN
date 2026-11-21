# Circuit editor and runtime integration
Objective: implement the remaining Role 4 capability while preserving the existing home page. Branch: `role4-circuit`; delivery: ask-on-risk, local commits only; no publishing.
Checks: Vitest circuit suite, strict TypeScript, Vite multipage build and browser QA. Forecast: 1800-2600 authored lines; generated lockfile excluded.

## Specs
- S1. User: "bien entonces procede con lo faltante". Complete the Role 4 scope below, with a working circuit editor, electrical state/API, persistence, help and isolated dev page. Use naming conventions from the supplied naming document over older labels.
- S2. User authorization: "adelante, por cierto considera que hay una \"pagina principal\" por si te sirve de algo a la hora de hacer la integracion". Define shared core contracts and React/Vite configuration; preserve the existing home page and connect it to the editor. Local work-unit commits authorized; no push or publication. Other roles' modules remain untouched.
- S3. Role 4 requirements supplied as context (not agent instructions), quoted verbatim:

### Rol 4: Electrónica y circuitos

**Carpetas:** `src/modules/circuit/`, `tests/circuit-rules.test.ts`, `src/dev/dev-circuit.tsx`, secciones de pines y eventos de `docs/contrato.md`.

| # | Tarea | Archivos |
|---|---|---|
| 4.1 | Lienzo SVG con zoom, desplazamiento y cuadrícula | `circuit/CircuitEditor.tsx`, `circuit/Canvas.tsx` |
| 4.2 | Paleta de componentes (lista desde `components`) y arrastrar y soltar al lienzo | `circuit/Palette.tsx` |
| 4.3 | Detección de pines (hit-testing), resaltado al pasar el cursor, tooltip con nombre y voltaje | `circuit/pins.ts` |
| 4.4 | Dibujar y borrar **cables** entre pines, con colores y esquinas ortogonales | `circuit/Wire.tsx`, `circuit/wiring.ts` |
| 4.5 | Mover, rotar y eliminar componentes | `circuit/interactions.ts` |
| 4.6 | **Protoboard:** conectividad interna (filas, columnas, rieles de alimentación) | `circuit/breadboard.ts` |
| 4.7 | Construir la lista de nodos eléctricos (nets) a partir del grafo con **union-find** | `circuit/netlist.ts` |
| 4.8 | Propagar voltajes por nodo desde batería y placa | `circuit/voltage.ts` |
| 4.9 | **Motor de reglas:** LED sin resistencia, VCC/GND invertidos, sin GND común, 5V en GPIO de Raspberry, pin sin conectar | `circuit/rules/*.ts` |
| 4.10 | Estados por componente (`ok`, `sin_energia`, `quemado`) con indicador visual y mensaje | `circuit/state.ts` |
| 4.11 | `resolvePin(pinId)`: qué hay conectado a un pin y qué señal entrega (lo usa el runtime) | `circuit/api.ts` |
| 4.12 | **Modo ayuda:** cables fantasma con la conexión correcta de la misión | `circuit/ghost-wires.ts` |
| 4.13 | Serializar y cargar `CircuitGraph` | `circuit/serialize.ts` |
| 4.14 | Pruebas Vitest de cada regla con circuitos correctos e incorrectos | `tests/circuit-rules.test.ts` |
| 4.15 | Página de prueba que muestra el resultado de las reglas | `dev/dev-circuit.tsx` |

**Terminado cuando:** se arma un circuito completo, el motor detecta los 5 errores educativos con su mensaje, y `resolvePin` devuelve la señal correcta al runtime.


- S4. Preserve the existing public netlist/rule exports and their tests. Actual runtime drives must distinguish LOW/HIGH/floating; unpowered/burned components must not drive outputs. Circuit API is bound to caller-owned graph/catalog providers rather than storing a second robot definition. Provide a development catalog only because the Role 5 registry is still empty; production editor accepts its catalog as a prop.
- S5. Shared types live in core. UI text follows the existing Spanish site and uses i18n keys. No 3D/Python/mission implementation or rewriting other roles. Future world/runtime/catalog integration must be explicitly documented, not claimed implemented.

## Tasks
- T1 [S2,S4,S5] inline; complete, commit pending; shared contracts/events/IDs and React/Vite multipage harness. Risk: item5 dependencies; independent final verifier required.
- T2 [S1,S3,S4] inline; pending; breadboard nets, actual voltage/signal evaluation and bound runtime API. Risk: item3 existing netlist/rule consumers; preserve default legacy behavior and add regressions.
- T3 [S1,S3,S4] inline; pending; graph interactions, pin geometry, wires, safe serialization and ghost connections with focused tests. Risk: item3 shared graph behavior.
- T4 [S1,S3,S5] inline; pending; controlled React SVG editor and development catalog/page, responsive interactions. Risk: item5 browser build/runtime.
- T5 [S2,S5] inline; pending; connect existing project chooser to circuit page without redesigning home; document shared contracts and model limits. Risk: item3 home navigation; verify old chooser behavior.
- T6 [S1-S5] inline verification plus independent verifier; pending; focused/suite/typecheck/build/browser checks, resolve observed blockers and record remaining external integrations honestly.

## Log
- L1. User: "bien entonces procede con lo faltante". Clarification explained shared types, React/Vite and commits; user then authorized: "adelante, por cierto considera que hay una \"pagina principal\" por si te sirve de algo a la hora de hacer la integracion".
- L2. Home `index.html` is a static Spanish marketing page with an existing project chooser; `app.js` currently only changes selected state. Preserve these behaviors and add an explicit editor launch action. Use a separate `circuit.html` entry, not a homepage rewrite. Existing visual system: blue/white, Urbanist; no continuous animation requested. Working roles 2/3/5 modules are stubs and are not owned by this unit.
- L3. Route: parent works inline because electrical/editor integration is coupled; no independent writer units launched. Independent verifier at the end covers named risk items3/5. CodeGraph unavailable (no index); use known file map. Engram writes blocked by an unregistered host session; mirror pending, local document authoritative. No fabricated session identity.
- L4. Prior native lineage review-4e7496cfe712597e remains escalated/native_stop_required; no automatic reviewer/correction restart or receipt claim. REG-001 did not reproduce in3 valid public-API cases;31 baseline tests pass. Existing candidate consent does not approve later candidates.

- L5. T1 RED2 shared-function tests before implementation, GREEN33/33 and strict typecheck/build PASS. React19.3.1 and Vite8.3.8 installed with scripts disabled. Multipage build preserves index.html and copies existing static assets; existing classic-script and dynamic-URL warnings retained for browser verification. Core contracts add canonical pin/state/graph types, scoped events and persisted ID watermarks.
