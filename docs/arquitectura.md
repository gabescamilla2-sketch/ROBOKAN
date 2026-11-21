# Arquitectura

Todo corre en el navegador. Sin backend en el MVP.

## Flujo
Blockly -> instrucciones estructuradas -> runtime TypeScript -> validación del circuito 2D -> mundo 3D.

Blockly también genera C++ equivalente a Arduino para mostrarlo al estudiante. El programa principal se representa dentro de `void loop()`. El runtime ejecuta las instrucciones estructuradas y permite ejecutar, pausar, reanudar y detener. Skulpt se retira del diseño.

## Regla de oro
El robot es UN solo objeto (RobotDefinition en core).
El circuito 2D y el mundo 3D son dos vistas del mismo objeto.
Nadie guarda su propia copia.

## Reglas de modulos
- Cada modulo expone solo lo que sale de su index.ts
- Nadie importa archivos internos de otro modulo
- Los bloques generan C++ y una lista tipada de instrucciones, con una sola fuente de bloques.
- El runtime cede el control al navegador entre instrucciones. El mundo sigue avanzando durante las esperas.
- Al pausar, se conservan cursor, tiempo restante y órdenes de motor. Al reanudar se restauran las órdenes tras validar el circuito. Detener cancela la ejecución y apaga los actuadores.

## Prueba del Rol 2

Ejecutar `npm install` y `npm run dev`, y abrir `/blocks.html`. Incluye Blockly con Esperar, C++ visible, instrucciones y controles de ejecución. `npm run build` compila esta página de prueba a `dist`. La portada existente se sirve durante desarrollo desde `/index.html`.
