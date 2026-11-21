# Contrato entre modulos

Acordar en la primera hora. Los tipos viven en src/core.

## 1. Ficha de componente
id, nombre, voltaje, modelo 3D, svg 2D, pines (nombre, tipo, posicion 2D), puntos de montaje 3D, comportamiento.

## 2. Definicion del robot (fuente unica)
chasis, piezas montadas (y en que punto), placa, cables (pin a pin), programa.

## 3. Instrucciones del programa
El tipo compartido `Instruction` vive en `src/core/instructions.ts` y se exporta desde `src/core/index.ts`. Sus operaciones son `wait`, `motor_write`, `read_distance`, `digital_write` y `buzzer_write`.

Rol 2 genera C++ visible y ejecuta instrucciones estructuradas desde TypeScript. Rol 4 resuelve conexiones y valida el estado eléctrico antes de lecturas y comandos. Rol 3 implementa las consultas y comandos del mundo.

La interfaz de resultados de lectura y errores eléctricos sigue pendiente de acuerdo e implementación entre los tres roles. El runtime actual ejecuta esperas.

## 4. Consultas al mundo
`world.query.ultrasonicDistanceCm(instanceId)`, `flameIntensityNorm(instanceId)`, `gasLevelNorm(instanceId)` y `groundReflectanceNorm(instanceId)`. Las tres últimas lecturas están normalizadas entre 0 y 1.

`world.applyActuator(command)` recibe órdenes de motor, LED, buzzer o servo según las convenciones. `world.reset()` reinicia el mundo.

## 5. Eventos
pin cambiado, componente quemado, mision completada, error de conexion.
