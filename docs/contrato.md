# Contrato entre modulos

Acordar en la primera hora. Los tipos viven en src/core.

## 1. Ficha de componente
id, nombre, voltaje, modelo 3D, svg 2D, pines (nombre, tipo, posicion 2D), puntos de montaje 3D, comportamiento.

## 2. Definicion del robot (fuente unica)
chasis, piezas montadas (y en que punto), placa, cables (pin a pin), programa.

## 3. Instrucciones del programa
El tipo compartido `Instruction` vive en `src/core/instructions.ts` y se exporta desde `src/core/index.ts`. Sus operaciones son `wait`, `motor_write`, `read_distance`, `digital_write` y `buzzer_write`.

Rol 2 genera C++ visible y ejecuta instrucciones estructuradas desde TypeScript. Rol 4 resuelve conexiones y valida el estado eléctrico antes de lecturas y comandos. Rol 3 implementa las consultas y comandos del mundo.

El contrato confirmado vive en `src/core/instructions.ts`: `HardwareInstruction` excluye `wait`; `ExecuteHardwareInstruction(instruction, signal)` devuelve una promesa de `InstructionResult`. Los resultados usan `kind` con `completed`, `reading` (resultId y reading) o `electrical_error` (RuleViolation[]). Las lecturas de distancia son centímetros. Las operaciones canceladas rechazan con `AbortError` y comprueban la señal antes de cualquier efecto.

`ProgramRunner` recibe el adaptador en su constructor, ejecuta las cinco instrucciones, conserva lecturas por resultId y expone violaciones y errores. El adaptador real entre circuito y mundo queda pendiente de integración. El contrato incluye `missing_power`; Rol 4 implementa su emisión.

## 4. Consultas al mundo
`world.query.ultrasonicDistanceCm(instanceId)`, `flameIntensityNorm(instanceId)`, `gasLevelNorm(instanceId)` y `groundReflectanceNorm(instanceId)`. Las tres últimas lecturas están normalizadas entre 0 y 1.

`world.applyActuator(command)` recibe órdenes de motor, LED, buzzer o servo según las convenciones. `world.reset()` reinicia el mundo.

## 5. Eventos
pin cambiado, componente quemado, mision completada, error de conexion.

## 6. Circuito: pines, estado y eventos implementados

Las definiciones compartidas de circuito viven en `src/core/contract.ts`, con exportación pública desde `src/core/index.ts`. Incluyen `ComponentSpec`, `PinSpec`, `ComponentInstance`, `Wire`, `CircuitGraph`, `RobotDefinition`, `PinSignal`, `CircuitState` y las enumeraciones acordadas. Los IDs se generan con `createIdAllocator`; el watermark opcional `idSequence` conserva los contadores al guardar, incluso después de eliminar piezas.

`PinRef` conserva el formato `<instanceId>/<pinName>`. El circuito recibe el catálogo por parámetro; no importa archivos internos del módulo de componentes. `createCircuitApi` recibe getters del grafo, catálogo, placa y señales. Su método `resolvePin(pinName)` devuelve `PinSignal`; `connections(pinName)` permite que el puente de hardware identifique sensores y actuadores conectados. El dueño de la simulación aporta las señales y las lecturas del mundo.

`CircuitEditor` es controlado: recibe `graph`, `specs`, `onChange` y señales opcionales. El dueño conserva un único `RobotDefinition` y combina los cambios de piezas/cables sin perder chasis, montaje ni programa. La página de desarrollo demuestra ese patrón; no sustituye el shell final de los otros roles.

El bus creado con `createCircuitEventBus` emite `circuit:changed` (`circuitState`), `pin:changed` (`pinRef`, `signal`) y `component:burned` (`instanceId`, `ruleId`). También tipa `robot:changed` y `world:reset`. Las suscripciones se eliminan mediante la función devuelta por `on`. Los eventos no crean una segunda copia persistente del robot.

Pendiente de los otros roles: catálogo/SVG/modelos de producción, comportamiento de componentes, runtime TypeScript de instrucciones, lecturas del mundo y consumo final de estos eventos. El catálogo en `src/dev/circuit-fixtures.ts` solo sirve para desarrollo.
