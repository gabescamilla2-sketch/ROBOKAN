# ROBOKAN · Recordatorio del Rol 2

## Objetivo

Que los alumnos aprendan programación por bloques y se familiaricen con C++ orientado a Arduino. El simulador puede usar acciones sencillas para mover el robot, leer un sensor o activar un LED o buzzer. No hace falta reproducir el comportamiento de Arduino con precisión.

## Alcance

- **Bloques (Rol 2).** Crear el editor con cinco bloques de inicio: mover, esperar, leer sensor, LED y buzzer. El alumno debe poder ver cómo se traduce su programa a C++.
- **Runtime (Rol 2 + Rol 3).** Acordar cómo ejecutar las acciones del programa en el simulador y llamar a su API de hardware. La integración debe permitir ejecutar, pausar y detener un programa.
- **Lenguajes.** Usar TypeScript (`.ts`) para la lógica y TSX (`.tsx`) para la interfaz. El editor genera C++ como texto.
- **Acuerdo con Rol 3.** Blockly genera C++ equivalente para Arduino y una lista de instrucciones estructuradas. El runtime de TypeScript ejecuta esa lista contra el simulador. README, arquitectura y contrato ya reflejan este enfoque. La integración actual cubre Esperar.

## Archivos del Rol 2

| Archivo | Estado y propósito |
| --- | --- |
| `src/modules/blocks/index.ts` | Exporta tipos de bloques, `DEFAULT_WAIT_BLOCK`, `generateCpp`, `generateCppProgram`, `generateInstructions`, `validateProgram` y `BlocksEditor`. |
| `src/dev/dev-blocks.tsx` | Implementado. Pantalla de prueba con C++, instrucciones, estado, tiempo restante y controles de ejecución. |
| `src/modules/runtime/index.ts` | Actualizado. Exporta `ProgramRunner`, `ProgramStatus` y `WaitInstruction`. |
| `src/modules/blocks/BlocksEditor.tsx` | Integra los cinco bloques, sus campos, serialización y recuperación desde almacenamiento local. |
| `src/modules/blocks/definitions.ts` | Define `WaitBlock`, `MotorBlock`, `DistanceBlock`, `LedBlock`, `BuzzerBlock`, la unión `ProgramBlock` y `DEFAULT_WAIT_BLOCK`. |
| `src/modules/blocks/generate-cpp.ts` | Genera las cinco operaciones y el programa con declaraciones, configuración de pines, `setup()` y `loop()`. |
| `src/modules/blocks/generate-instructions.ts` | Traduce los cinco tipos de bloques a `Instruction[]`, conservando el orden. Mantiene una sobrecarga para listas de Esperar. |
| `src/modules/blocks/validate-program.ts` | Valida los campos y devuelve claves de mensajes para los problemas detectados. |
| `src/core/instructions.ts` | Creado. Define la unión compartida `Instruction` acordada con Rol 3. |
| `src/core/index.ts` | Actualizado. Exporta el tipo `Instruction`. |
| `src/modules/runtime/program-runner.ts` | Creado. Ejecuta esperas con cursor, temporizador, pausa, reanudación y detención. |
| `src/dev/mock-hardware.ts` | Propuesto. Simular la API de hardware para comprobar las llamadas desde la pantalla de prueba. |
| `src/dev/dev-blocks.css` | Estilos adaptables de la pantalla de prueba. |
| `src/i18n/es.json` | Textos en español para el editor y sus controles. |
| `blocks.html` | Entrada web de la prueba del Rol 2. |
| `package.json` y `package-lock.json` | Dependencias y comandos de desarrollo, compilación y pruebas. |
| `tsconfig.json` y `vite.config.mts` | Configuración TypeScript y Vite. El build incluye bloques, circuito y portada estática. |
| `tests/program-runner.test.ts` | Pruebas del runtime con reloj simulado. |
| `tests/block-generators.test.ts` | Pruebas de generación de código, orden de instrucciones y validación de campos. |
| `src/vite-env.d.ts` | Tipos de Vite para recursos como CSS. |
| `vitest.config.mts` | Incluye todas las pruebas TypeScript del proyecto. |

## Representación del bloque Esperar

En `definitions.ts`, el bloque Esperar conserva su representación en milisegundos.

```ts
export type WaitBlock = {
  type: "wait";
  delayMs: number;
};

export const DEFAULT_WAIT_BLOCK: WaitBlock = {
  type: "wait",
  delayMs: 1000,
};
```

El archivo `generate-cpp.ts` sigue la convención kebab-case. `generateCpp(block)` traduce un bloque y `generateCppProgram(blocks)` arma el programa completo visible. Para Esperar con `delayMs: 1000`, se genera `delay(1000);` dentro de `loop()`.

## Salidas de los cinco bloques

| Bloque | Instrucción | C++ equivalente |
| --- | --- | --- |
| Esperar | `wait`, `delayMs` | `delay(1000);` |
| Mover motor | `motor_write`, `instanceId`, `speedPct` | `robokan_motor_write("dc-motor:1", 50);` |
| Leer distancia | `read_distance`, `trigPinName`, `echoPinName`, `resultId` | `distance_cm = robokan_distance_cm(9, 10);` |
| LED | `digital_write`, `pinName`, `digitalValue` | `digitalWrite(3, HIGH);` |
| Buzzer | `buzzer_write`, `instanceId`, `isOn`, `frequencyHz` | `robokan_buzzer_write("buzzer:1", true, 440);` |

La vista actualiza ambas salidas al cambiar los bloques. El programa C++ incluye las declaraciones de resultados y funciones necesarias y configura los pines de LED y distancia en `setup()`.

Las funciones `robokan_*` son auxiliares educativas propuestas. Su implementación para hardware depende del acuerdo de componentes y pines. La pantalla muestra ese pendiente.

## Instrucciones compartidas y reparto acordado

`Instruction` incluye las formas acordadas `wait`, `motor_write`, `read_distance`, `digital_write` y `buzzer_write`. Los generadores cubren las cinco operaciones. `ProgramRunner` ejecuta actualmente `wait`.

- **Rol 2.** Editor Blockly, generación de C++, instrucciones estructuradas e intérprete con controles de ejecución.
- **Rol 3.** `world.query`, `world.applyActuator`, movimiento, colisiones, lecturas del entorno y `world.reset()`.
- **Rol 4.** Resolución de pines y cables, comprobación del estado eléctrico y validación de lecturas y comandos.
- **Integración conjunta.** Conectar el runtime a estas APIs y probar un programa completo.

## Runtime implementado

```ts
const runner = new ProgramRunner();
runner.run([{ op: "wait", delayMs: 5000 }]);
runner.pause();
runner.resume();
runner.stop();
```

- `run(instructions)` copia y valida las esperas, reinicia la ejecución anterior y recorre la lista una vez.
- `run(instructions, { repeat: true })` repite el programa. La pantalla usa esta opción para coincidir con `loop()`. Cada espera usa un temporizador y una lista vacía finaliza inmediatamente.
- `pause()` conserva el cursor y el tiempo restante, usando un reloj monotónico.
- `resume()` continúa la espera pendiente.
- `stop()` cancela el temporizador, vacía el programa y reinicia el cursor.
- `status` devuelve `idle`, `running`, `paused` o `completed`.
- `instructionIndex` permite consultar el cursor y `remainingWaitMs` el tiempo restante.
- Las duraciones deben ser finitas y mayores o iguales a cero. Las esperas largas se dividen según el límite del temporizador del navegador.

## Verificación realizada

Se hicieron comprobaciones con Node y eliminación de tipos TypeScript en memoria. Se verificaron listas vacías, generación de dos esperas en orden, pausa y conservación del tiempo restante, reanudación hasta completar, detención, reemplazo de una ejecución y rechazo de duración negativa. La comprobación temporal usó intervalos cortos para verificar el comportamiento.

La última ejecución pasó el build TypeScript/Vite y 59 pruebas en total: 5 del menú y 54 de Vitest, repartidas entre circuito, generadores, validación y runtime. También se verificaron el chequeo de tipos de circuito y el formato antes del último avance del editor.

La verificación visual completa sigue pendiente. Los intentos de acceso local tuvieron errores de conexión y el último intento terminó porque la herramienta no pudo determinar la URL del navegador con suficiente confianza. El guardado y recuperación requieren todavía comprobación manual de punta a punta en el navegador.

## Próximos pasos

1. Verificar visualmente `/blocks.html`: conectar bloques, editar duración y probar los cuatro controles.
2. Acordar e implementar la interfaz de resultados de lectura y errores eléctricos con Roles 3 y 4.
3. Ampliar `ProgramRunner` con las cuatro instrucciones de hardware y almacenar lecturas por `resultId` después del acuerdo de integración.
4. Integrar las APIs de Roles 3 y 4. Durante una espera, el mundo debe seguir avanzando.
5. Implementar los efectos acordados sobre actuadores. Pausar guarda las últimas órdenes y pone los motores en cero. Reanudar restaura esas órdenes tras validar el circuito. Detener pone motores en cero y apaga LED y buzzer. Evitar que una operación pendiente reactive actuadores después de detener.
6. Coordinar los contratos de integración del runtime y revisar el tamaño del paquete de Blockly y las dependencias.

## Comunicación al equipo

Roles 3 y 4 ya confirmaron el enfoque y su reparto mediante los mensajes compartidos en el chat. Rol 3 confirmó la restauración de las últimas órdenes de motor al reanudar. Rol 4 solicitó la definición exacta de `Instruction` y el contrato de resultados y errores. Compartirles esta actualización y coordinar el contrato pendiente. Mantener al líder informado del avance.

Se propuso en el chat un resultado con estados `ok`, `reading` y `electrical_error`, y una función asíncrona `ExecuteHardwareInstruction`. Esta propuesta sigue pendiente de confirmación e implementación. Los tipos definitivos deben reutilizar los contratos compartidos de `core`.

## Avance de la prueba visual de Esperar

- Se agregó configuración de React, TypeScript, Vite, Blockly y Vitest en `package.json`, `tsconfig.json` y `vite.config.mts`.
- La página de prueba está en `blocks.html`, con entrada en `src/dev/dev-blocks.tsx`. Se abre en `/blocks.html` después de ejecutar `npm install` y `npm run dev`.
- `BlocksEditor.tsx` permite arrastrar y conectar los cinco tipos de bloques. El programa recorre las cadenas independientes de arriba hacia abajo. Esperar muestra segundos y usa milisegundos internamente.
- La pantalla muestra C++ con `setup()` y `loop()`, instrucciones estructuradas, estado y tiempo restante, y conecta Ejecutar, Pausar, Reanudar y Detener. Durante la ejecución y la pausa el editor queda bloqueado para conservar el programa mostrado.
- La pantalla permite ejecutar programas válidos compuestos por Esperar. Al incluir hardware muestra el aviso de integración pendiente y deshabilita Ejecutar.
- `run(instructions, { repeat: true })` agrega repetición opcional. La pantalla usa esta opción. Cada espera se agenda con temporizador para ceder el control al navegador. Una lista vacía finaliza de inmediato.
- Se agregaron pruebas con reloj simulado para pausa, reanudación, repetición, detención, lista vacía y reemplazo de ejecución.
- Próximo trabajo del Rol 2: integrar las operaciones de hardware con Roles 3 y 4. Sigue pendiente implementar la conservación y restauración de órdenes de motor, y los efectos de Detener sobre actuadores.

Vite reporta un paquete de Blockly superior a 500 kB, de aproximadamente 648 kB en el último build. El build incluye bloques, circuito y la portada con recursos estáticos. Una instalación anterior reportó tres vulnerabilidades, y el estado actual tras las actualizaciones requiere una auditoría nueva para confirmarlo.

README, arquitectura y contrato ya describen C++ e instrucciones TypeScript. El documento de convenciones describe C++ e instrucciones TypeScript.

## Guardado en Git

- Commit anterior `2aa8605`: generadores e implementación inicial de `ProgramRunner`.
- Commit `f243ce2`: `Implementa editor Blockly de espera y controles del runtime`, con 17 archivos modificados o creados.
- Posteriormente se integraron cambios de circuito en la rama `prueba-circuitos` y se corrigieron problemas de traducciones, configuración y compilación.
- Los últimos cambios del editor, validación y documentación requieren revisar el estado de Git y crear el siguiente commit. El estado del remoto debe consultarse al publicar.

## Comandos de uso

```powershell
npm install
npm run dev
npm test
npm run build
```

Abrir `http://127.0.0.1:5173/blocks.html` cuando Vite esté activo. El servidor puede elegir otro puerto si 5173 está ocupado.

Referencias del proyecto: [Arquitectura](arquitectura.md), [Contrato entre módulos](contrato.md) y [Convenciones de nombres](convenciones-nombres.md).

## Correcciones de integración posteriores al merge de circuitos

- Traducciones de bloques y circuito ubicadas en claves independientes. Los estados del programa conservan sus cuatro etiquetas.
- Tipos de Vite disponibles para importaciones CSS mediante `src/vite-env.d.ts`.
- Configuración unificada en `vite.config.mts`: compila bloques y circuito y conserva la portada y sus recursos estáticos en `dist`.
- Vitest incluye todas las pruebas TypeScript. `test:circuit` conserva el filtro específico de circuitos.
- Convenciones, textos de interfaz y documentación describen C++ visible e instrucciones ejecutadas por TypeScript.
- Pasaron 57 pruebas en total, incluidas las de generadores y runtime.

## Guardado y validación del editor

- Botones Guardar programa y Recuperar guardado mediante serialización de Blockly y almacenamiento local, con un sobre de versión 1.
- Al abrir el editor se intenta recuperar el guardado. Los cambios posteriores requieren pulsar Guardar programa.
- Un fallo de carga conserva el programa anterior. Los fallos de almacenamiento se muestran en pantalla.
- Se validan duración, velocidad, frecuencia, identificadores de actuadores, pines y resultados de distancia. TRIG y ECHO deben ser distintos.
- Un programa inválido muestra los problemas y bloquea la generación y ejecución hasta corregirlos.
- La integración real de hardware sigue pendiente del acuerdo con Roles 3 y 4.

## Interfaz con paleta oficial

- Aplicados azul noche `#17243B`, azul `#2878F0`, turquesa `#20C997`, amarillo `#FFB84D`, fondo `#F3F6FB`, blanco `#FFFFFF`, morado `#8B72E8` y coral `#F16C75`.
- Barra de ejecución con estado y tiempo restante. Pausar cambia a Reanudar cuando el programa está pausado.
- Panel de bloques con Guardar, Recuperar, Deshacer, Rehacer, zoom y Ajustar vista, y lienzo con cuadrícula.
- Panel de código con selector de C++ o instrucciones y botón Copiar con mensaje de resultado.
- Distribución adaptable a pantallas pequeñas, indicadores de foco y avisos para campos inválidos e integración pendiente.

## Exportar e importar programas JSON

- Exportar JSON descarga `robokan-programa.json` con versión 1 y el estado serializado de Blockly, incluidos campos, posiciones y conexiones.
- Importar JSON permite elegir un archivo y reemplaza el programa al completar la carga. Para conservarlo en almacenamiento local se pulsa Guardar programa.
- Se comprueban versión, estructura, tamaño máximo de 1 MB y tipos de bloques admitidos. Una carga previa en un workspace temporal comprueba la compatibilidad con Blockly.
- Si falla la carga se conserva el programa anterior. Los controles de archivo se deshabilitan durante ejecución y pausa. Una lectura asíncrona que termina mientras se ejecuta el programa se descarta.
- Se agregaron pruebas del formato y del rechazo de archivos incompatibles.

## Cambios sin guardar

- El editor compara el estado serializado actual con el estado de referencia inicial, guardado o recuperado.
- Agregar, eliminar, mover, conectar o editar bloques actualiza el indicador Cambios sin guardar. Deshacer hasta el estado de referencia elimina ese indicador.
- Guardar con éxito o recuperar el guardado actualiza la referencia. Importar conserva la referencia anterior y detecta si el resultado tiene cambios pendientes.
- Recuperar o importar solicita confirmación si hay cambios sin guardar. Cancelar conserva el programa actual.
- Se solicita el aviso nativo del navegador al salir o recargar con cambios pendientes. Su presentación depende del navegador.
- Los bloqueos de edición durante ejecución se excluyen de la comparación para evitar cambios pendientes falsos. Exportar JSON conserva el indicador pendiente de guardado local.

## Validación entre bloques y seguimiento de ejecución

- Se detectan conflictos cuando un pin se comparte entre LED y sensor, se intercambian funciones TRIG/ECHO o se asignan pares incompatibles de pines de distancia. Repetir la lectura del mismo sensor y alternar el mismo LED son usos permitidos.
- `BlocksEditor` recibe `activeInstructionIndex` y relaciona el cursor con los IDs reales de los bloques. El bloque Esperar activo se resalta durante ejecución y pausa, y el resaltado se elimina al detener.
- Pruebas de integración del componente React con Blockly headless cubren guardar, confirmar/cancelar recuperación, cambios pendientes, conexiones conservadas, Deshacer, generación tras editar y la llamada de resaltado.
- Estas pruebas usan serialización y conexiones reales de Blockly. El renderizado SVG y los diálogos nativos siguen requiriendo revisión visual en navegador.

## Estado de cierre del último avance

- Implementados los tres puntos solicitados: conflictos de pines entre bloques, resaltado del bloque Esperar activo y pruebas de integración del editor.
- `npm run build` pasó después de estos cambios.
- `npm test` pasó con 66 pruebas: 5 del menú y 61 de Vitest en 10 archivos.
- Se agregó `tests/blocks-editor.test.ts`, que monta el componente React y usa un workspace Blockly headless con conexiones y serialización reales. Comprueba la recuperación con confirmación y cancelación, edición, Deshacer y llamadas de resaltado.
- `tests/block-generators.test.ts` incluye conflictos entre LED y sensor, pares de distancia incompatibles y usos válidos repetidos.
- La advertencia de tamaño del paquete de Blockly sigue presente, de aproximadamente 653 kB en el último build.
- Pendiente verificar visualmente resaltado, zoom, diálogos, descarga e importación en un navegador real.
- Próximo trabajo funcional: acordar el contrato de resultados y errores con Roles 3 y 4, ejecutar instrucciones de hardware y aplicar las acciones de pausa, reanudación y detención sobre actuadores.
- Revisar y guardar estos cambios en el siguiente commit.

## Integración del contrato confirmado de hardware

Roles 3 y 4 confirmaron `HardwareInstruction`, `InstructionResult` y `ExecuteHardwareInstruction` con `AbortSignal`. Las cancelaciones rechazan con `AbortError`. Los tipos están implementados y exportados desde core.

```ts
const runner = new ProgramRunner(executeHardwareInstruction);
runner.run(instructions, { repeat: true });
// runner.readings, runner.violations, runner.error y runner.status
```

- El runtime admite las cinco instrucciones. Los programas de hardware requieren proporcionar el adaptador.
- Lecturas válidas y finitas se guardan por `resultId`; los errores eléctricos se exponen a la interfaz y detienen la ejecución con estado `error`.
- Pausar aborta la operación pendiente, conserva cursor y tiempo restante y pone los motores registrados en cero. Reanudar vuelve a enviar sus últimas órdenes mediante el adaptador para validación y continúa. Una instrucción de hardware interrumpida se reintenta.
- Detener aborta la operación, cancela temporizadores, reinicia cursor y solicita velocidad cero, LED apagado y buzzer apagado. Las acciones de apagado se encadenan antes de iniciar otra ejecución o restaurar motores.
- Un resultado tardío de una ejecución cancelada se descarta. El adaptador tiene la responsabilidad de comprobar la cancelación antes de aplicar efectos al mundo.
- Las órdenes de apagado pasan por el adaptador. Los rechazos eléctricos o fallos de apagado quedan disponibles como diagnóstico.
- Se agregó `missing_power` a `RuleId`, traducciones y convenciones. Rol 4 todavía debe implementar su detección.
- La página muestra errores del runtime y conserva el aviso de hardware pendiente hasta conectar el adaptador real. La escena de Rol 3 y el circuito de Rol 4 requieren integración de punta a punta.
- `tests/runtime-hardware.test.ts` verifica lecturas, secuencias de hardware, pausa/reanudación de motores, apagado, cancelación y resultados tardíos. Pasaron 70 pruebas en total (5 de menú y 65 de Vitest).

Los apartados anteriores documentan etapas previas. Este contrato confirmado sustituye la propuesta de resultados y la limitación inicial del runtime a Esperar.

## Panel de lecturas y prueba independiente

- `ReadingsPanel.tsx` muestra los últimos valores de `runner.readings` por `resultId` en centímetros y un estado vacío antes de recibir lecturas.
- La pantalla incluye Probar lecturas de distancia y un campo de valor manual, inicialmente 23.5 cm. Permite ejecutar Leer distancia combinado con Esperar y distingue los valores de prueba.
- `src/dev/test-distance-adapter.ts` devuelve el valor ingresado, respeta AbortSignal y valida que la distancia sea finita y positiva o cero. La integración real con circuito y mundo sigue pendiente.
- Para comprobarlo, activar la prueba, agregar Leer distancia con TRIG D9 y ECHO D10, ejecutar y revisar `distance_cm` en el panel. Detener conserva el último resultado y una ejecución nueva limpia las lecturas anteriores.
- El panel de prueba mantiene bloqueados los actuadores hasta integrar el adaptador real.

## Conexión de desarrollo al circuito 2D

- `blocks.html` incluye ahora `CircuitEditor` y conserva el robot y las señales en un estado compartido con el programa. El circuito se bloquea durante ejecución y pausa.
- La vista estática `circuits.html` ofrece Programar este circuito en su barra lateral. Transfiere componentes y cables mediante sessionStorage y abre `blocks.html?circuit=1`. La transferencia es una copia al abrir, y los cambios siguientes se hacen en la vista integrada.
- `src/dev/import-circuit-workbench.ts` adapta los identificadores y nombres de pines de esa vista al contrato canónico y valida el resultado con el deserializador de circuito. Una transferencia incompatible muestra un aviso y abre un circuito vacío.
- `src/dev/circuit-program-adapter.ts` es un puente de desarrollo. LED escribe señales digitales en los pines de la placa seleccionada y vuelve a evaluar el circuito. Leer distancia busca TRIG y ECHO del mismo HC-SR04 y valida alimentación y errores eléctricos antes de devolver el valor manual de prueba.
- Los avisos de pines flotantes son informativos en este puente, que valida conexiones y alimentación. La simulación de pulsos y la distancia del entorno requieren el adaptador oficial y el mundo 3D.
- El ejemplo inicial conecta HC-SR04 a D9/D10 y LED con resistencia a D13. Se puede probar encender LED D13, esperar y apagarlo, o leer el sensor conectado.
- Motor, buzzer y sensores adicionales siguen pendientes del adaptador de Roles 3 y 4. La casilla Probar lecturas permite la prueba aislada anterior y se identifica en pantalla.
- Pruebas nuevas cubren lectura con alimentación, rechazo al quitar VCC, escritura LED y transferencia de identificadores de la vista estática.

## Cambio de interacción solicitado por el usuario

La interfaz combinada descrita en el apartado anterior fue retirada. Circuito y programación permanecen en vistas separadas.

- En `circuits.html`, doble clic sobre el cuerpo de un Arduino abre su editor de programación dentro de un panel modal con deslizamiento desde la derecha. Alt+Enter sobre la placa ofrece acceso con teclado.
- El panel usa `blocks.html` embebido y recibe el circuito y la placa seleccionada. La pantalla de programación muestra bloques, código y lecturas. El circuito permanece en la pantalla principal.
- Cada Arduino usa una clave propia para Guardar y Recuperar programa.
- Cerrar o Escape solicita confirmación si hay cambios sin guardar. Al aceptar se detiene el runtime, se anima el cierre y se devuelve el foco a la placa.
- La animación respeta la preferencia de movimiento reducido. Los mensajes entre panel y pantalla principal comprueban origen y ventana emisora.
- El botón de navegación que transfería a una pantalla combinada fue eliminado. El nuevo punto de entrada es el Arduino.
- La conexión eléctrica de desarrollo sigue disponible internamente. Distancia manual y adaptador oficial de mundo conservan los pendientes ya documentados.

## Correcciones posteriores a la revisión del proyecto

- La apertura por doble clic detecta las dos pulsaciones sobre la misma placa aunque el lienzo regenere sus elementos. Arrastrar una pieza cancela esa secuencia.
- El panel comunica estados eléctricos al circuito visible mediante mensajes que comprueban origen y ventana emisora. Los componentes muestran su estado y el LED activo tiene un indicador luminoso.
- Los identificadores canónicos se derivan del sufijo estable de las piezas y cables de la vista 2D. Eliminar o reordenar otras piezas conserva sus identidades.
- La portada y sus estilos usan C++, incluido el ejemplo de código y las pestañas de la muestra.
- Se ampliaron las pruebas del panel para cubrir pulsaciones reales y recepción de estados, y las pruebas de transferencia para conservar identidades.
- La comprobación del mundo 3D y el adaptador oficial siguen pendientes de sus implementaciones publicadas por Roles 3 y 4.
- Verificación posterior: 74 pruebas aprobadas (5 del menú y 69 de Vitest), build, comprobación de tipos de circuito y chequeo de formato correctos. Permanece el aviso de tamaño del paquete Blockly y la revisión visual manual de la animación.

## Implementación del mundo 3D solicitada por el usuario

- Se creó el commit `14d2a8d` para el aviso de hardware y se integró main. El merge `4cb2d0c`, que contiene ese commit, fue publicado en GitHub antes de comenzar el 3D.
- El pull incorporó el adaptador de Rol 4 y `public/models/scenery/scene.glb`. La implementación usa esa escena local como base e instala Babylon.js y sus cargadores GLTF.
- `src/modules/world/types.ts` define `WorldApi`, `WorldActuatorCommand` y `RobotWorld`. El módulo público exporta los tipos, `createRobotWorld` y `WorldViewport`.
- Movimiento diferencial con dos motores, colisiones simplificadas contra obstáculos y límites de arena, cámara orbital y limpieza de recursos al cerrar. Los motores sin montaje explícito alternan izquierda y derecha por orden de componentes.
- El ultrasónico consulta un rayo frontal de hasta 450 cm sobre los obstáculos de la escena. Las consultas de flama y gas devuelven niveles normalizados según distancia a las fuentes. El infrarrojo lee una franja central del suelo.
- LED tiene emisión visual, buzzer usa audio del navegador y servo mueve un brazo de representación. Las instancias se validan contra el robot recibido.
- `WorldViewport` se carga bajo demanda. El mundo sigue actualizándose durante Esperar y responde a los comandos del adaptador oficial del circuito.
- Se corrigió el adaptador para permitir GPIO flotantes sin uso, órdenes de apagado con componentes sin alimentación y actualización de señales después de comandos aceptados. Los comandos de actuadores usan el tipo exportado por world.
- El catálogo educativo incluye categorías de sensor y actuador. Los motores de ejemplo usan alimentación positiva y tierra y se incorporaron motor y buzzer a la paleta 2D.
- Desde Circuitos, Mundo 3D abre la placa seleccionada o la primera disponible. El doble clic sobre Arduino conserva el editor de programación deslizable.
- `/blocks.html?example=motors&world=1` carga dos motores conectados y un programa inicial de avance, espera, lectura y parada. Los guardados del ejemplo usan su propia clave.
- Se comprobó la escena en Brave: carga, ejecución, pausa, detención y lectura `distance_cm` desde el entorno 3D. Se observaron 426.31 cm durante la prueba.
- Las pruebas nuevas comprueban movimiento, giros, colisiones, límites temporales y ejecución del ejemplo mediante la validación eléctrica.
- El escenario usa la geometría del prototipo compartido. Las colisiones y alimentación de motores son educativas y el montaje automático usa posiciones definidas para ese modelo. El mapeo completo de modelos de producción del Rol 5 sigue pendiente.
- Los cambios 3D siguen locales y requieren su propio commit después de revisión.
- Verificación final de esta implementación: 78 pruebas aprobadas (5 de menú y 73 de Vitest), build, chequeo de tipos de circuito y formato correctos. La instalación de dependencias reportó cero vulnerabilidades.
- Babylon.js se carga bajo demanda con importaciones específicas. Quedan avisos de tamaño para los paquetes de Blockly y mundo 3D, de aproximadamente 675 kB y 1.78 MB respectivamente antes de compresión.

## Cierre funcional del mundo 3D y vínculo con bloques

- El editor y el mundo se muestran en columnas, con pestañas Mundo 3D, C++ e Instrucciones. Cambiar la salida visible conserva el mundo y la ejecución. La barra Ejecutar/Pausar/Reanudar/Detener permanece visible al desplazarse.
- La caja de herramientas tiene categorías Movimiento, Tiempo, Sensores y Salidas para dejar espacio al programa. El bloque activo y el número de instrucción permiten seguir la ejecución.
- El robot aplica velocidades independientes por lado; los identificadores se ordenan de forma numérica y estable para el montaje automático. El montaje explícito izquierda/derecha tiene prioridad. Se muestra la asignación en el visor.
- El movimiento se divide en pasos cortos para comprobar colisiones incluso a pocos cuadros por segundo. Las ruedas se animan con la velocidad de su lado, incluidos giros y reversa. Las paredes y obstáculos impiden atravesar la geometría.
- Cámaras Orbital, Superior y Seguir robot; trayectoria azul limitada a 500 puntos y rayo ultrasónico amarillo con marcador de extremo. Son ayudas visuales que se pueden desactivar.
- Telemetría en vivo: velocidad izquierda, velocidad derecha, distancia al obstáculo y orientación. Una colisión muestra un aviso; un giro o una reversa pueden sacar al robot del bloqueo.
- Reiniciar robot limpia trayectoria, motores, sonidos y LED y devuelve la posición inicial. Se puede elegir reiniciar al pulsar Ejecutar o continuar desde la posición actual.
- Repetir programa mantiene el comportamiento de `loop()`. Si se desactiva, se ejecuta una sola vez y el runtime apaga los actuadores al terminar. El generador C++ refleja la ejecución única en `setup()` y deja `loop()` vacío, con las mismas órdenes de apagado.
- Al ocultar la pestaña del navegador se pausa el programa para evitar avances imprevistos por temporizadores de una pestaña inactiva. Reanudar conserva el tiempo restante y restaura los motores después de validar el circuito.
- El ejemplo de motores incluye avance, lectura ultrasónica, giro con velocidades opuestas, reversa y parada. Los programas guardados se conservan y tienen prioridad sobre el ejemplo inicial.
- `tests/world-program.test.ts` verifica bloques → instrucciones → ProgramRunner → adaptador eléctrico → movimiento: avance, pausa sin desplazamiento, reanudación, giro, reversa, lectura y apagado al finalizar. También comprueba el C++ de ejecución única.
- Verificación: 80 pruebas aprobadas (5 de portada y 75 de Vitest), comprobación de tipos y formato del circuito correctos, y compilación de producción correcta. Se verificaron visualmente la trayectoria, la orientación y la lectura del entorno en Brave.
- Alcance final de esta entrega: simulación educativa con cinemática y colisiones simplificadas. El C++ se muestra como equivalente; se ejecutan instrucciones TypeScript. El catálogo y las posiciones de montaje están adaptados a la escena disponible; los modelos definitivos siguen siendo trabajo de integración del Rol 5.
- Los cambios de esta entrega permanecen locales, sin un nuevo commit ni push.

## Integración de los modelos GLB compartidos por Rol 5

- Se descargó `origin/modelos-3d` y se incorporaron los once GLB de `src/modules/components` del commit `2f1aa5f8ccc795705276239ed55af046eb3bbe65`, sin mezclar cambios ajenos de esa rama ni cambiar los binarios respecto a su origen.
- `components/models.ts` registra las URL y ajustes de presentación; el catálogo público y `ComponentSpec.modelPath` quedan vinculados a los archivos reales. Vite incluye los once archivos en la compilación, con sus URL de recursos.
- El robot del GLB de escenario queda oculto. `world/robot-model.ts` construye el robot con `chasis.glb`, dos ruedas y las piezas que efectivamente existen en el circuito. El escenario sigue suministrando arena y obstáculos.
- Se usan los marcadores del chasis para placa, batería, controlador, motores y ultrasónico. Las escalas y orientaciones se normalizan conservando los nodos de pines originales. Las ruedas tienen su pivote en el eje y se apoyan en el suelo; el radio de colisión se ajusta al ancho montado.
- Las piezas conservan su `instanceId`, se desplazan y giran con el robot. Los bloques siguen pasando por ProgramRunner y el adaptador eléctrico. El ultrasónico mide desde `sensor.origin` del modelo montado; el LED modifica la emisión de `led_body`, con materiales independientes para cada instancia.
- La biblioteca descarga cada tipo de modelo una vez por escena y reutiliza geometría. Libera clones y materiales al reconstruir y los recursos cargados al cerrar. La cancelación de carga respeta AbortSignal.
- `RobotWorld.configureRobot` ahora devuelve `Promise<void>` porque puede necesitar cargar modelos nuevos. Debe esperarse antes de enviar comandos al robot reconfigurado.
- El visor muestra **Componentes 3D del circuito** con nombres e identificadores y permite acercarse más con la cámara. Se verificó visualmente el robot armado ejecutando avance, giro y reversa con los modelos nuevos y el rayo del sensor.
- La batería y Raspberry suministradas son referencias geométricas de los contratos existentes; no cambian sus características eléctricas. LM35 queda disponible como modelo visual, sin añadir una lectura de temperatura al contrato de instrucciones. Buzzer y servo conservan representaciones simplificadas al no haber un GLB correspondiente en la entrega.
- Detalles y correspondencias en `src/modules/components/README.md`. `tests/component-models.test.ts` carga los once GLB reales, comprueba montaje, piezas opcionales, materiales LED independientes y cancelación.
- Verificación final: 85 pruebas aprobadas (5 de portada y 80 de Vitest), compilación, tipos y formato correctos. El aviso previo de tamaño de los paquetes permanece. Esta integración queda local, pendiente de commit y publicación.
