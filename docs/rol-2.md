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
| `src/modules/blocks/index.ts` | Exporta `WaitBlock`, `DEFAULT_WAIT_BLOCK`, `generateCpp`, `generateInstructions` y `BlocksEditor`. |
| `src/dev/dev-blocks.tsx` | Implementado. Pantalla de prueba con C++, instrucciones, estado, tiempo restante y controles de ejecución. |
| `src/modules/runtime/index.ts` | Actualizado. Exporta `ProgramRunner`, `ProgramStatus` y `WaitInstruction`. |
| `src/modules/blocks/BlocksEditor.tsx` | Implementado. Integra Blockly con bloques Esperar conectables y duración editable. |
| `src/modules/blocks/definitions.ts` | Definiciones de los bloques. Conservar `WaitBlock`, `delayMs` y `DEFAULT_WAIT_BLOCK`. |
| `src/modules/blocks/generate-cpp.ts` | Implementado para Esperar. `generateCpp(block)` produce `delay(1000);` para 1000 ms. |
| `src/modules/blocks/generate-instructions.ts` | Implementado para listas de bloques Esperar. `generateInstructions(blocks)` produce instrucciones `wait` en orden. |
| `src/core/instructions.ts` | Creado. Define la unión compartida `Instruction` acordada con Rol 3. |
| `src/core/index.ts` | Actualizado. Exporta el tipo `Instruction`. |
| `src/modules/runtime/program-runner.ts` | Creado. Ejecuta esperas con cursor, temporizador, pausa, reanudación y detención. |
| `src/dev/mock-hardware.ts` | Propuesto. Simular la API de hardware para comprobar las llamadas desde la pantalla de prueba. |
| `src/dev/dev-blocks.css` | Estilos adaptables de la pantalla de prueba. |
| `src/i18n/es.json` | Textos en español para el editor y sus controles. |
| `blocks.html` | Entrada web de la prueba del Rol 2. |
| `package.json` y `package-lock.json` | Dependencias y comandos de desarrollo, compilación y pruebas. |
| `tsconfig.json` y `vite.config.ts` | Configuración TypeScript y Vite. El build genera la página de bloques. |
| `tests/program-runner.test.ts` | Pruebas del runtime con reloj simulado. |

## Cambio en los dos primeros archivos

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

El generador se llama `generate-cpp.ts`, siguiendo la convención de nombres de archivos en kebab-case.

```ts
import type { WaitBlock } from "./definitions";

export function generateCpp(block: WaitBlock): string {
  return `delay(${block.delayMs});`;
}
```

Las exportaciones públicas de bloques ya usan `generateCpp`. El generador produce una instrucción de C++. La pantalla de prueba la incluye dentro de `void loop()` y muestra un `void setup()` vacío.

## Instrucciones compartidas y reparto acordado

`Instruction` incluye las formas acordadas `wait`, `motor_write`, `read_distance`, `digital_write` y `buzzer_write`. Actualmente el generador y el ejecutor implementan `wait`.

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

Después de configurar el proyecto, pasaron la comprobación de tipos, el build Vite y las 17 pruebas: 5 del menú, 8 del circuito y 4 del runtime. La verificación visual en navegador sigue pendiente por un tiempo de espera agotado al acceder al servidor local desde las herramientas.

## Próximos pasos

1. Verificar visualmente `/blocks.html`: conectar bloques, editar duración y probar los cuatro controles.
2. Acordar e implementar la interfaz de resultados de lectura y errores eléctricos con Roles 3 y 4.
3. Agregar mover, leer sensor, LED y buzzer a las definiciones, Blockly y ambos generadores.
4. Integrar las APIs de Roles 3 y 4. Durante una espera, el mundo debe seguir avanzando.
5. Implementar los efectos acordados sobre actuadores. Pausar guarda las últimas órdenes y pone los motores en cero. Reanudar restaura esas órdenes tras validar el circuito. Detener pone motores en cero y apaga LED y buzzer. Evitar que una operación pendiente reactive actuadores después de detener.
6. Coordinar la actualización de las referencias históricas a Python en convenciones y revisar las dependencias reportadas por npm.

## Comunicación al equipo

Roles 3 y 4 ya confirmaron el enfoque y su reparto mediante los mensajes compartidos en el chat. Rol 3 confirmó la restauración de las últimas órdenes de motor al reanudar. Rol 4 solicitó la definición exacta de `Instruction` y el contrato de resultados y errores. Compartirles esta actualización y coordinar el contrato pendiente. Mantener al líder informado del avance.

Se propuso en el chat un resultado con estados `ok`, `reading` y `electrical_error`, y una función asíncrona `ExecuteHardwareInstruction`. Esta propuesta sigue pendiente de confirmación e implementación. Los tipos definitivos deben reutilizar los contratos compartidos de `core`.

## Avance de la prueba visual de Esperar

- Se agregó configuración mínima de React, TypeScript, Vite, Blockly y Vitest en `package.json`, `tsconfig.json` y `vite.config.ts`.
- La página de prueba está en `blocks.html`, con entrada en `src/dev/dev-blocks.tsx`. Se abre en `/blocks.html` después de ejecutar `npm install` y `npm run dev`.
- `BlocksEditor.tsx` permite arrastrar y conectar bloques Esperar y editar segundos. El programa recorre las cadenas independientes de arriba hacia abajo. Los valores internos usan milisegundos.
- La pantalla muestra C++ con `setup()` y `loop()`, instrucciones estructuradas, estado y tiempo restante, y conecta Ejecutar, Pausar, Reanudar y Detener. Durante la ejecución y la pausa el editor queda bloqueado para conservar el programa mostrado.
- `generateInstructions` ahora devuelve el subtipo de instrucciones Esperar, compatible con la firma actual de `ProgramRunner.run`.
- `run(instructions, { repeat: true })` agrega repetición opcional. La pantalla usa esta opción. Cada espera se agenda con temporizador para ceder el control al navegador. Una lista vacía finaliza de inmediato.
- Se agregaron pruebas con reloj simulado para pausa, reanudación, repetición, detención, lista vacía y reemplazo de ejecución.
- Próximo trabajo del Rol 2: integrar las operaciones de hardware con los contratos acordados con Roles 3 y 4 y ampliar los bloques. Sigue pendiente implementar la conservación y restauración de órdenes de motor, y los efectos de Detener sobre actuadores.

La compilación TypeScript/Vite y las 17 pruebas del menú, circuito y runtime pasaron. La comprobación visual quedó bloqueada porque el navegador de herramientas agotó el tiempo de acceso al servidor local. Vite reporta un paquete de Blockly superior a 500 kB. La instalación reportó tres vulnerabilidades de dependencias pendientes de revisar. El build actual se limita a la página de bloques.

README, arquitectura y contrato ya describen C++ e instrucciones TypeScript. El documento de convenciones conserva una sección histórica de Python que requiere coordinación del equipo.

## Guardado en Git

- Commit anterior `2aa8605`: generadores e implementación inicial de `ProgramRunner`.
- Commit `f243ce2`: `Implementa editor Blockly de espera y controles del runtime`, con 17 archivos modificados o creados.
- Al revisar esta actualización, `HEAD` y la referencia local `origin/main` coinciden. Esta comprobación usa las referencias disponibles en el repositorio, sin consultar el servidor remoto.
- Esta actualización del recordatorio requiere un nuevo commit.

## Comandos de uso

```powershell
npm install
npm run dev
npm test
npm run build
```

Abrir `http://127.0.0.1:5173/blocks.html` cuando Vite esté activo. El servidor puede elegir otro puerto si 5173 está ocupado.

Referencias del proyecto: [Arquitectura](arquitectura.md), [Contrato entre módulos](contrato.md) y [Convenciones de nombres](convenciones-nombres.md).
