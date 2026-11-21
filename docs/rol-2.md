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
