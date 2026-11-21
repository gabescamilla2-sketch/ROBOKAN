# World map editor, ultrasonic range and workbench reset

Objective: let the user restore the avoider starter on the workbench, tune the ultrasonic range, and design the 3D arena (add, move, stretch obstacles).
Branch: `main` working tree, uncommitted (user said "Not yet" to committing). Delivery: single change. Test runner: `npm test` (node --test + vitest), `npx tsc --noEmit`.

## Specs

- S1 Reset button on the static workbench: "haz el boton de restablecer". It replaces the current circuit with the "Evasor de obstáculos" starter (5 components, 8 wires), after confirmation, as an undoable change, and removes the saved project (`robokan.circuit-editor.v1`) so a reload also shows the starter.
- S2 Ultrasonic range: "permite que se pueda modificar el rango de deteccion del ultrasonico". A control in the 3D world sets the HC-SR04 maximum range (cm). Both the reading (`ultrasonicDistanceCm`) and the visible ray use it. Default keeps the current 450 cm.
- S3 Map design: "diseñar mas cosas en 3D, como el mapa etc, que el usuario pueda agregar obstaculos, estirarlos, etc". In a "Diseñar mapa" mode the user can add obstacles (box, wall, column presets), select one by clicking, move it by dragging on the floor, stretch it (width, depth, height), delete it and clear all. Added obstacles block the robot and are detected by the ultrasonic sensor.
- S4 (assumption) The three scenery obstacles (yellow, purple, turquoise) can be hidden so the user designs the arena from scratch; arena walls, fire and gas stay fixed.
- S5 (assumption) The map (obstacles, scenery toggle, range) persists in `localStorage` (`robokan.world.map.v1`), is validated on load, and stays within the 18 × 18 m arena with a limit of 30 obstacles.

- S6 Avoid distance: "veo que si se modifica la distancia del ultrasonico pero no el range de deteccion, necesito que tambien sea esto para poder configurar a que distancia esquiva". User chose the "avanzar hasta" block: drive both motors until the reading is below X cm (X editable in the block); the preloaded avoider uses it.
- S7 Shape library: "mejor diseño en la interfaz 3d, quiero que se vean las formas para añadirlas tal como hace tinkercad". Picture tiles for box, wall, cylinder, sphere, cone, pyramid; click places in front of the robot, drag drops at the pointer.
- S8 Robot placement: "poder seleccionar el robot tambien y moverlo de lugar". Click selects the robot, drag moves its start pose (never onto an obstacle), heading slider, reset returns there.

## Tasks

| ID | Specs | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 | S1 | inline | done | RED->GREEN tests/workbench-reset.test.ts; browser: 3 -> 5 components, 8 wires, storage cleared |
| T2 | S5, S3 | inline | done | RED->GREEN tests/world-map.test.ts (7) in src/modules/world/map.ts |
| T3 | S2, S3, S4 | inline | done | create-world.ts map API, WorldViewport designer panel; tsc clean |
| T5 | S6 | inline | done | RED->GREEN tests/drive-until.test.ts (6), workbench-avoider runner test; new core instruction drive_until_distance (runner-level) |
| T6 | S7, S8 | inline | done | RED->GREEN world-map tests (shapes, legacy column, robotStart, collidesAt); WorldDesigner + ShapeIcon; browser: drop cone at pointer, robot drag + heading 90°, below-sensor warning |
| T7 | S6 | inline | done | fixes found in browser: arena walls 0.75 m < sensor 0.97 m (raised x2), flat hazard bases blocked but invisible to ray (use flame/tank), fixed ±8 m clamp (now wall face − radius), grazing contact froze robot (slide). Avoider: 4 avoids in 60 s, 0 collisions |
| T4 | S1-S5 | inline | done | browser: add wall/box, drag, stretch 8x2.5 m, scenery hidden, range 100/300 cm, collision at 18.6 cm, map restored after reload |

## Log

- L1 (2026-11-21, user): "haz el boton de restablecer, ademas permite que se pueda modificar el rango de deteccion del ultrasonico, diseñar mas cosas en 3D, como el mapa etc, que el usuario pueda agregar obstaculos, estirarlos, etc"
- L2: Collision uses axis-aligned `ObstacleBounds`, so obstacles are boxes without free rotation. Arena walls at ±9 m. Route: inline (no writer reason: one coupled feature in the world module).
- L3: Verified. npm test 9 + 86 pass, tsc clean. Fixed: new obstacle meshes now compute world matrices immediately (first ray read was stale for one frame). No automated test for the Babylon pointer drag (needs WebGL); covered by browser check only.
- L4: Another concurrent change set (homepage branding, `.taste-skill/world-brand-*`) appeared in the working tree; left untouched. Nothing committed per user.
- L5 (2026-11-21, user): "veo que si se modifica la distancia del ultrasonico pero no el range de deteccion, necesito que tambien sea esto para poder configurar a que distancia esquiva, ademas mejor diseño en la interfaz 3d, quiero que se vean las formas para añadirlas tal como hace tinkercad, poder seleccionar el robot tambien y moverlo de lugar"
- L6: User chose "Bloque 'avanzar hasta' (Recomendado)" over a generic if/then block. Also found: Blockly restore() loads a saved program on open, so "Restablecer evasor" now also clears robokan.blocks.workspace.v1.<boardId>.
- L7: Verified npm test 9 + 98 (107) pass, tsc clean. Not covered by automated tests: Babylon pointer drag, wall scaling, palette drop (browser-checked only). Shapes collide by footprint box; low or pointy parts under the 97 cm sensor are not detected (warning shown). Nothing committed.
