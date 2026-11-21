# Contrato entre modulos

Acordar en la primera hora. Los tipos viven en src/core.

## 1. Ficha de componente
id, nombre, voltaje, modelo 3D, svg 2D, pines (nombre, tipo, posicion 2D), puntos de montaje 3D, comportamiento.

## 2. Definicion del robot (fuente unica)
chasis, piezas montadas (y en que punto), placa, cables (pin a pin), programa.

## 3. API de hardware (lo que el codigo Python puede llamar)
digital_read, digital_write, analog_read, pwm_write, sleep, distancia, servo.

## 4. Consultas al mundo
distancia por rayo, intensidad de flama, concentracion de gas, color bajo sensor IR.

## 5. Eventos
pin cambiado, componente quemado, mision completada, error de conexion.

## 6. Circuito: pines, estado y eventos implementados

Las definiciones compartidas de circuito viven en `src/core/contract.ts`, con exportación pública desde `src/core/index.ts`. Incluyen `ComponentSpec`, `PinSpec`, `ComponentInstance`, `Wire`, `CircuitGraph`, `RobotDefinition`, `PinSignal`, `CircuitState` y las enumeraciones acordadas. Los IDs se generan con `createIdAllocator`; el watermark opcional `idSequence` conserva los contadores al guardar, incluso después de eliminar piezas.

`PinRef` conserva el formato `<instanceId>/<pinName>`. El circuito recibe el catálogo por parámetro; no importa archivos internos del módulo de componentes. `createCircuitApi` recibe getters del grafo, catálogo, placa y señales. Su método `resolvePin(pinName)` devuelve `PinSignal`; `connections(pinName)` permite que el puente de hardware identifique sensores y actuadores conectados. El dueño de la simulación aporta las señales y las lecturas del mundo.

`CircuitEditor` es controlado: recibe `graph`, `specs`, `onChange` y señales opcionales. El dueño conserva un único `RobotDefinition` y combina los cambios de piezas/cables sin perder chasis, montaje ni programa. La página de desarrollo demuestra ese patrón; no sustituye el shell final de los otros roles.

El bus creado con `createCircuitEventBus` emite `circuit:changed` (`circuitState`), `pin:changed` (`pinRef`, `signal`) y `component:burned` (`instanceId`, `ruleId`). También tipa `robot:changed` y `world:reset`. Las suscripciones se eliminan mediante la función devuelta por `on`. Los eventos no crean una segunda copia persistente del robot.

Pendiente de los otros roles: catálogo/SVG/modelos de producción, comportamiento de componentes, runtime Python, lecturas del mundo y consumo final de estos eventos. El catálogo en `src/dev/circuit-fixtures.ts` solo sirve para desarrollo.
