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
- S5. Shared types live in core. UI text follows the existing Spanish site and uses i18n keys. No 3D/runtime/mission implementation or rewriting other roles. Future world/runtime/catalog integration must be explicitly documented, not claimed implemented.

## Tasks
- T1 [S2,S4,S5] inline; complete; commit `d4f4a84`; shared contracts/events/IDs and React/Vite multipage harness. Risk: item5 dependencies; independent final verifier required.
- T2 [S1,S3,S4] inline; complete; commit `b5ec96d`; breadboard nets, actual voltage/signal evaluation and bound runtime API. Risk: item3 existing netlist/rule consumers; preserve default legacy behavior and add regressions.
- T3 [S1,S3,S4] inline; complete; commit `bd7a71b`; graph interactions, pin geometry, wires, safe serialization and ghost connections with focused tests. Risk: item3 shared graph behavior.
- T4 [S1,S3,S5] inline; implemented and browser-checked; commit `a637db8`; controlled React SVG editor and development catalog/page, responsive interactions. Risk: item5 browser build/runtime.
- T5 [S2,S5] inline; complete; commit `c94c625`; connect existing project chooser to circuit page without redesigning home; document shared contracts and model limits. Risk: item3 home navigation; verify old chooser behavior.
- T6 [S1-S5] inline verification plus independent verifier; partial (download artifact E2E unverified; native assessment medium/under_budget); focused/suite/typecheck/build/browser checks, resolve observed blockers and record remaining external integrations honestly.

## Log
- L1. User: "bien entonces procede con lo faltante". Clarification explained shared types, React/Vite and commits; user then authorized: "adelante, por cierto considera que hay una \"pagina principal\" por si te sirve de algo a la hora de hacer la integracion".
- L2. Home `index.html` is a static Spanish marketing page with an existing project chooser; `app.js` currently only changes selected state. Preserve these behaviors and add an explicit editor launch action. Use a separate `circuit.html` entry, not a homepage rewrite. Existing visual system: blue/white, Urbanist; no continuous animation requested. Working roles 2/3/5 modules are stubs and are not owned by this unit.
- L3. Route: parent works inline because electrical/editor integration is coupled; no independent writer units launched. Independent verifier at the end covers named risk items3/5. CodeGraph unavailable (no index); use known file map. Engram writes blocked by an unregistered host session; mirror pending, local document authoritative. No fabricated session identity.
- L4. Prior native lineage review-4e7496cfe712597e remains escalated/native_stop_required; no automatic reviewer/correction restart or receipt claim. REG-001 did not reproduce in3 valid public-API cases;31 baseline tests pass. Existing candidate consent does not approve later candidates.

- L5. T1 RED2 shared-function tests before implementation, GREEN33/33 and strict typecheck/build PASS. React19.3.1 and Vite8.3.8 installed with scripts disabled. Multipage build preserves index.html and copies existing static assets; existing classic-script and dynamic-URL warnings retained for browser verification. Core contracts add canonical pin/state/graph types, scoped events and persisted ID watermarks.

- L6. T2 RED4 API/breadboard tests, GREEN37/37 and strict typecheck PASS. Runtime evaluate uses explicit drivers (absent output floating; LOW0/HIGH1 preserved); legacy evaluateCircuitRules keeps static behavior when its optional override is omitted. Board rails propagate through breadboard banks/rails; sensor outputs require powered state. API reads caller-owned graph/catalog providers, with no stored robot clone. Existing native escalation remains bound; no new review lifecycle initiated.

- L7. T3 RED3 model tests, GREEN40/40 and typecheck PASS. Immutable graph editing retains ID watermarks; version1 serialization validates catalog membership, pin refs, IDs, positions, rotations, colors, duplicates and bounded file size before replacement. Rotated pin geometry, orthogonal paths and symmetric ghost-wire matching covered. No world/runtime/catalog-owner module modified.

- L8. T4/T5: controlled editor, palette drag/tap, SVG pins/tooltips/selection, orthogonal/color wires, drag/quarter-turn/keyboard editing, ghost help, inspector, scoped events, local save/restore and JSON controls implemented. Home chooser selection remains unchanged and adds an explicit open-circuit link; navigation RED3/GREEN3. Runtime validation and safe ID import added with RED2/GREEN2. Suite45/45, typecheck/build/format PASS. Prettier3.10.1 is development-only; normalization intentionally precedes final verification. The coherent editor unit exceeds the400-line heuristic; readability is preserved rather than compressing code.
- L9. Observed browser QA on dev server: home chooser -> matching circuit, HIGH/LOW LED signal, rotation, arrow movement, wire deletion/reconnection, missing ghost wire, add/remove component, local save/restore, cleared drives on restore, deleting a driven board without crash, unsafe LED bypass with educational burned message, no console errors. Desktop1440 and mobile390 inspected; mobile document width equals viewport (no horizontal overflow); palette made collapsible. A getByLabel exact locator had no match; inspected DOM and used the actual combobox role successfully.
- L10. JSON download/import browser attempt returned no verifiable outcome after a tool timeout; not counted as PASS. Browser binding recovered without repeating the uncertain download. Unit JSON validation/roundtrip and browser localStorage restore are verified. Pending final production-page/browser checks and independent functional verifier. Prior native lineage remains escalated; no new reviewer or correction cycle is started automatically.

- L11. Independent verifier:7/8 own probes PASS, strict typecheck PASS; found a new API inconsistency when a burned Pi output was suppressed from signals but its downstream LED status remained ok. Parent reproduced RED1 and corrected the API to recompute states with monotonically filtered effective drivers, latching burned state/reasons only within one evaluation. Added regression includes healthy next-snapshot recovery and graph immutability. This is the single bounded independent-verifier correction batch for this feature, not a restart of the older native lineage. Targeted recheck pending.

- L12. Independent targeted recheck closed the only feature blocker:3/3 own probes and retained regression1/1 PASS. Parent spot-check typecheck PASS and full suite46/46 PASS after clean npmci --ignore-scripts (46 packages), format check PASS and production build PASS. Sources normalized before these checks; no later functional edits. Refinements committed as865d140; editor a637db8; home integration c94c625. Source deltas exceed the initial advisory forecast, partly from mechanical formatting; no PR/push requested, so ask-on-risk publication strategy is not activated.
- L13. Final browser proof: imported generated empty version1 JSON and observed Circuito cargado +0 pieces/0 wires; production HTTP5174 home chooser -> line-follower circuit rendered IR sensor, no console errors. Actual pointer drag moved the LED, background drag changed viewBox, zoom changed width1000->800; reset succeeded. Desktop1440, intermediate1024 and mobile390 inspected, no document horizontal overflow; temporary viewport reset. Browser workflow complete. JSON download artifact remains unknown after earlier wait timeout; not repeated blindly or claimed passed.
- L14. Preserved home assets still produce classic-script/dynamic-URL build warnings; both dev and production entry flow were tested with no console errors. Both owned preview servers were intentionally stopped. No deployment, remote push, external account, or edits to runtime/world/components/mission owners. Remaining production catalog/assets and runtime TypeScript/3D wiring belong to those owners and are documented at the module boundary.

- L15. Final new-feature native assessment over committed range7727f93..17f49dc succeeded: medium, review_due=false, under_budget (41 paths/4849 total changed lines). No new review was due or launched; this is not approval and does not resolve the earlier escalated foundation lineage. Running authored delta4721 lines excluding generated package-lock; publication strategy remains ask-on-risk and inactive because no push/PR requested. All runnable authorized implementation completed; remaining proof limitation is the unconfirmed downloaded JSON artifact.
