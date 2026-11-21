# Convenciones de nombres compartidos: Roles 3, 4 y 5

> Los Roles **3** (mundo 3D y robots), **4** (circuito) y **5** (componentes y arte) se pasan datos constantemente: lo que define uno lo consumen los otros dos. Este documento fija **un solo nombre para cada cosa** para que no haya variables con significados distintos.
>
> **Precedencia:** si hay conflicto, los tipos de `src/core/` mandan. Si hay conflicto de *nombres* entre este documento y `CLAUDE.md`, **este documento prevalece** (ver sección 13).
> **Cambiar un nombre compartido** exige actualizar este archivo y `src/core/` en el mismo momento y avisar a los otros dos roles.

---

## 1. Convenciones generales

| Qué | Formato | Ejemplo |
|---|---|---|
| Identificadores en código (variables, funciones, tipos) | **Inglés** | `circuitState`, `resolvePin` |
| Variables y funciones | `camelCase` | `mountPointId`, `readDistance` |
| Tipos, interfaces y componentes React | `PascalCase` | `ComponentSpec`, `PinSignal`, `<CircuitEditor>` |
| Constantes | `UPPER_SNAKE_CASE` | `MAX_ULTRASONIC_RANGE_CM` |
| Valores de enums y uniones de strings | `snake_case` en minúsculas | `'digital_in'`, `'burned'` |
| Booleanos | Prefijo `is`, `has`, `can` | `isPowered`, `hasResistor` |
| Archivos y carpetas de código | `kebab-case` | `robot-builder.ts`, `netlist.ts` |
| Archivos de componentes React | `PascalCase` | `CircuitEditor.tsx` |
| Ids de componentes, plantillas, arenas, misiones | `kebab-case` | `hc-sr04`, `arena-line-track` |
| Nombres visibles al usuario | **Nunca en código**: claves de i18n | `t('components.hc-sr04.name')` |
| Funciones del C++ mostrado | API Arduino o auxiliares `robokan_*` | `digitalWrite`, `robokan_distance_cm` |

**Prohibido:** abreviar sin necesidad (`cmp`, `cfg`, `pwr`), mezclar español e inglés en un identificador, y usar nombres genéricos (`data`, `item`, `obj`, `val`, `temp`).

---

## 2. Glosario: una palabra, un significado

| Usa | Significa | **No uses** |
|---|---|---|
| `component` / `ComponentSpec` | La **definición** de un tipo de pieza (ficha del Arduino, del LED...) | `part`, `piece`, `element`, `device` |
| `componentInstance` | Una pieza **colocada** en el robot o el circuito | `component` (para una instancia), `item` |
| `board` | La placa: Arduino o Raspberry Pi | `controller`, `mcu`, `microcontroller` |
| `sensor` | Componente que **lee el mundo** (ultrasonic, flame, gas, infrared) | `detector`, `probe` |
| `actuator` | Componente que **actúa sobre el mundo** (motor, servo, LED, buzzer) | `output device`, `driver` (el driver es otro componente) |
| `pin` | Punto de conexión de un componente | `port`, `terminal`, `lead`, `connector` |
| `wire` | Cable dibujado entre dos pines | `cable`, `link`, `connection`, `edge` |
| `net` | Conjunto de pines conectados eléctricamente (mismo nodo) | `node`, `circuit` (para esto) |
| `circuitGraph` | El conjunto de instancias y cables del panel 2D | `schematic`, `diagram` |
| `chassis` | Cuerpo base del robot sobre el que se montan piezas | `body`, `frame`, `base` |
| `mountPoint` | Posición predefinida del chasis donde va una pieza | `slot`, `socket`, `anchor`, `attachment` |
| `robotDefinition` | **Única** fuente de verdad del robot | `robotConfig`, `robotData`, `robotState` |
| `arena` | Escenario 3D donde corre el robot | `map`, `level`, `scene` (la escena es de Babylon) |
| `world` | Mundo 3D completo: arena + física + robot | `simulation` (para el módulo) |
| `signal` | Valor eléctrico presente en un pin | `value` (a secas) |
| `reading` | Valor que un sensor obtiene del mundo | `measurement`, `sample` |
| `violation` | Una regla eléctrica incumplida | `error` (se reserva para fallos del programa) |
| `status` | Estado de una instancia: `ok`, `unpowered`, `burned` | `state` (se reserva para estructuras grandes como `CircuitState`) |

---

## 3. Formato de identificadores

| Identificador | Formato | Ejemplos |
|---|---|---|
| `specId` (id de `ComponentSpec`) | `kebab-case` | `arduino-uno`, `raspberry-pi-4`, `hc-sr04`, `flame-sensor`, `mq2-gas-sensor`, `ir-line-sensor`, `led`, `resistor`, `buzzer`, `servo-sg90`, `dc-motor`, `motor-driver-l298n`, `breadboard`, `battery-9v` |
| `instanceId` | `<specId>:<número>` | `led:1`, `hc-sr04:2`, `arduino-uno:1` |
| `pinName` | Texto **tal como está impreso** en la pieza, en `MAYÚSCULAS` | `VCC`, `GND`, `TRIG`, `D9`, `A0`, `GPIO17` |
| `PinRef` (referencia a un pin concreto) | `<instanceId>/<pinName>` | `hc-sr04:1/TRIG`, `arduino-uno:1/D9` |
| `wireId` | `wire:<número>` | `wire:7` |
| `netId` | `net:<número>` | `net:3` |
| `mountPointId` | `<posición>-<lado>` en `kebab-case` | `front-center`, `front-left`, `front-right`, `rear-center`, `bottom-front`, `bottom-center`, `top-center` |
| `chassisId` | `chassis-<tipo>` | `chassis-2wd` |
| `arenaId` | `arena-<nombre>` | `arena-line-track`, `arena-obstacle-room`, `arena-gas-kitchen` |
| `templateId` | `template-<nombre>` | `template-line-follower`, `template-obstacle-avoider` |
| `missionId` | `mission-<nombre>` | `mission-gas-detector` |

**Reglas:**
- Los `instanceId` los genera **un solo** lugar (el módulo que crea la instancia, vía una función en `core`); nadie los inventa a mano.
- Un `instanceId` **no se reutiliza** aunque se borre la pieza.
- Cada `PinRef` debe poder resolverse a una instancia existente; si no, es un error de datos, no del usuario.

### Nombres de pines por componente (vinculantes)

| `specId` | `pinName` |
|---|---|
| `arduino-uno` | `D0`...`D13`, `A0`...`A5`, `5V`, `3V3`, `VIN`, `GND` (hay varios `GND`: `GND_1`, `GND_2`, `GND_3`) |
| `raspberry-pi-4` | `GPIO2`...`GPIO27`, `5V_1`, `5V_2`, `3V3_1`, `3V3_2`, `GND_1`...`GND_8` (+ campo `physicalPin` con el número del conector) |
| `hc-sr04` | `VCC`, `TRIG`, `ECHO`, `GND` |
| `flame-sensor` | `VCC`, `GND`, `AOUT`, `DOUT` |
| `mq2-gas-sensor` | `VCC`, `GND`, `AOUT`, `DOUT` |
| `ir-line-sensor` | `VCC`, `GND`, `OUT` |
| `led` | `ANODE`, `CATHODE` |
| `resistor` | `PIN_A`, `PIN_B` |
| `buzzer` | `POSITIVE`, `NEGATIVE` |
| `servo-sg90` | `SIGNAL`, `VCC`, `GND` |
| `dc-motor` | `MOTOR_POSITIVE`, `MOTOR_NEGATIVE` |
| `motor-driver-l298n` | `IN1`, `IN2`, `IN3`, `IN4`, `ENA`, `ENB`, `OUT1`, `OUT2`, `OUT3`, `OUT4`, `VCC_MOTOR`, `GND`, `5V` |
| `battery-9v` | `POSITIVE`, `NEGATIVE` |
| `breadboard` | Agujeros en **minúscula**: `a1`...`j30`. Rieles: `rail_top_pos_<n>`, `rail_top_neg_<n>`, `rail_bottom_pos_<n>`, `rail_bottom_neg_<n>` |

Excepción intencional: los agujeros del protoboard van en minúscula para no confundirse con `A1` del Arduino.

---

## 4. Enumeraciones compartidas

Una sola definición en `src/core/`, importada por los tres roles. Nadie redeclara estas listas.

| Enum | Valores |
|---|---|
| `PinType` | `power`, `ground`, `digital_in`, `digital_out`, `digital_io`, `analog_in`, `pwm_out`, `passive` |
| `ComponentStatus` | `ok`, `unpowered`, `burned` |
| `SensorKind` | `ultrasonic`, `flame`, `gas`, `infrared` |
| `ActuatorKind` | `motor`, `servo`, `led`, `buzzer` |
| `ComponentCategory` | `board`, `sensor`, `actuator`, `passive`, `power_source`, `breadboard` |
| `SignalKind` | `floating`, `digital`, `analog`, `pwm` |
| `RuleId` | `led_without_resistor`, `reversed_polarity`, `missing_common_ground`, `overvoltage_gpio`, `floating_pin` |

`SensorKind` es la **misma lista** en `components` (Rol 5), `circuit` (Rol 4) y `world` (Rol 3). Si se agrega un sensor, se agrega ahí primero.

---

## 5. Unidades: el sufijo siempre dice la unidad

Toda variable numérica con unidad física lleva sufijo. Nunca un número sin unidad en el nombre.

| Magnitud | Sufijo | Ejemplo |
|---|---|---|
| Voltaje (voltios) | `V` | `supplyVoltageV`, `maxVoltageV` |
| Corriente (miliamperios) | `Ma` | `forwardCurrentMa` |
| Resistencia (ohmios) | `Ohm` | `resistanceOhm` |
| Distancia en el mundo (metros) | `M` | `positionM`, `wheelRadiusM` |
| Distancia del ultrasónico (centímetros) | `Cm` | `distanceCm` |
| Ángulo (grados) | `Deg` | `angleDeg`, `rotationDeg` |
| Frecuencia (hertz) | `Hz` | `frequencyHz` |
| Tiempo (milisegundos) | `Ms` | `warmupMs`, `delayMs` |
| Valor normalizado 0 a 1 | `Norm` | `flameIntensityNorm`, `gasLevelNorm`, `groundReflectanceNorm` |
| Porcentaje de -100 a 100 | `Pct` | `speedPct` |

### Rangos y valores de señales

| Nombre | Tipo | Rango |
|---|---|---|
| `digitalValue` | `0 \| 1` | 0 = LOW, 1 = HIGH |
| `analogValue` | número entero | 0 a 1023 (10 bits, como Arduino) |
| `pwmDuty` | número entero | 0 a 255 |
| `speedPct` | número | -100 (reversa total) a 100 (adelante total) |
| `angleDeg` (servo) | número | 0 a 180 |
| `groundReflectanceNorm` | número | 0 = superficie oscura (línea), 1 = clara |

---

## 6. Sistemas de coordenadas

| Espacio | Dónde se usa | Convención |
|---|---|---|
| **2D (panel de circuito)** | Rol 4 y Rol 5 (SVG, pines) | Unidades del `viewBox` del SVG. Origen arriba a la izquierda, **Y crece hacia abajo**. Nombres: `x`, `y`. Posición de instancia: `circuitPosition: { x, y }` y `rotationDeg` (0, 90, 180, 270). |
| **3D (mundo y robot)** | Rol 3 y Rol 5 (GLB, montaje) | **Metros**, **Y hacia arriba**. El **frente del robot es +Z** (convención de Babylon.js). Posición: `positionM: { x, y, z }`. |

**Reglas para modelos GLB (Rol 5):**
- Cada GLB se exporta a **escala real en metros** con el origen en el centro de su base.
- El **frente de un sensor** (hacia donde "mira") es **+Z** en el espacio local del modelo.
- Los puntos de montaje y la dirección del sensor se marcan con **nodos vacíos** con estos nombres exactos:

| Nodo en el GLB | Significado |
|---|---|
| `mount.<mountPointId>` | Punto de montaje en un chasis (ej. `mount.front-center`) |
| `sensor.origin` | Punto desde el que el sensor emite o mide (ej. el "ojo" del ultrasónico) |

El Rol 3 lee `sensor.origin` y la orientación +Z de ese nodo para lanzar rayos y cálculos; **nunca los calcula a ojo**.

---

## 7. Quién produce y quién consume

### 7.1 Rol 5 produce `ComponentSpec` → Roles 3 y 4 lo consumen

| Campo | Tipo | Descripción | Lo usa |
|---|---|---|---|
| `specId` | `string` | Id en `kebab-case` | todos |
| `category` | `ComponentCategory` | Categoría | 3, 4 |
| `nameKey` | `string` | Clave i18n: `components.<specId>.name` | 4 (paleta) |
| `supplyVoltageV` | `number` | Voltaje nominal de alimentación | 4 |
| `maxVoltageV` | `number` | Voltaje máximo antes de quemarse | 4 |
| `svgPath` | `string` | Ruta del SVG 2D | 4 |
| `modelPath` | `string` | Ruta del GLB 3D | 3 |
| `pins` | `PinSpec[]` | Lista de pines | 4 |
| `sensorKind` | `SensorKind?` | Solo si es sensor | 3, 4 |
| `actuatorKind` | `ActuatorKind?` | Solo si es actuador | 3, 4 |
| `behaviorKind` | `string` | Tipo de comportamiento eléctrico | 4 |

`PinSpec`:

| Campo | Tipo | Descripción |
|---|---|---|
| `pinName` | `string` | Nombre impreso (sección 3) |
| `pinType` | `PinType` | Tipo de pin |
| `svgPosition` | `{ x, y }` | Posición en el SVG (2D) |
| `labelKey` | `string` | Clave i18n: `components.<specId>.pins.<pinName>` |
| `maxVoltageV` | `number?` | Si difiere del componente (ej. GPIO de Raspberry = 3.3) |

### 7.2 Rol 4 produce `CircuitState` → Roles 3 y 5 lo consumen

| Campo | Tipo | Descripción | Lo usa |
|---|---|---|---|
| `statusByInstance` | `Record<instanceId, ComponentStatus>` | Estado de cada pieza | 3 (apariencia 3D), 5 (avisos) |
| `signalByPin` | `Record<PinRef, PinSignal>` | Señal presente en cada pin | 3 (runtime) |
| `nets` | `Net[]` | Nodos eléctricos | solo 4 |
| `violations` | `RuleViolation[]` | Reglas incumplidas | 5 (avisos), 1 (textos) |

`PinSignal`:

| Campo | Tipo |
|---|---|
| `signalKind` | `SignalKind` |
| `voltageV` | `number` |
| `digitalValue` | `0 \| 1` (si aplica) |
| `analogValue` | `number` (si aplica) |

`RuleViolation`:

| Campo | Tipo | Descripción |
|---|---|---|
| `ruleId` | `RuleId` | Regla incumplida |
| `instanceId` | `string` | Pieza afectada |
| `pinRef` | `PinRef?` | Pin afectado, si aplica |
| `messageKey` | `string` | Clave i18n `errors.<ruleId>` |

### 7.3 Rol 3 produce lecturas y recibe comandos

**Lecturas del mundo** (`world.query`). Se nombra por la magnitud y se consulta por `instanceId` del sensor:

| Función | Devuelve | Sensor |
|---|---|---|
| `ultrasonicDistanceCm(instanceId)` | `number` (cm) | `ultrasonic` |
| `flameIntensityNorm(instanceId)` | `number` (0 a 1) | `flame` |
| `gasLevelNorm(instanceId)` | `number` (0 a 1) | `gas` |
| `groundReflectanceNorm(instanceId)` | `number` (0 a 1) | `infrared` |

**Comandos a actuadores** (`world.applyActuator(command)`). `ActuatorCommand` siempre lleva `instanceId` y `actuatorKind`:

| `actuatorKind` | Campos adicionales |
|---|---|
| `motor` | `speedPct` |
| `servo` | `angleDeg` |
| `led` | `isOn`, `brightnessNorm` |
| `buzzer` | `isOn`, `frequencyHz` |

### 7.4 `RobotDefinition` (compartido por 3, 4 y 5)

| Campo | Tipo | Descripción |
|---|---|---|
| `chassisId` | `string` | Chasis |
| `boardInstanceId` | `string` | Placa principal |
| `componentInstances` | `ComponentInstance[]` | Piezas colocadas |
| `wires` | `Wire[]` | Cables del circuito |
| `programSource` | `string` | Código C++ equivalente actual |

`ComponentInstance`:

| Campo | Tipo | Descripción |
|---|---|---|
| `instanceId` | `string` | Id de instancia |
| `specId` | `string` | A qué ficha corresponde |
| `circuitPosition` | `{ x, y }` | Posición en el panel 2D |
| `rotationDeg` | `number` | Rotación en el panel 2D |
| `mountPointId` | `string?` | Punto de montaje en el chasis, si va en el robot 3D |

`Wire`:

| Campo | Tipo |
|---|---|
| `wireId` | `string` |
| `fromPin` | `PinRef` |
| `toPin` | `PinRef` |
| `colorHex` | `string` |

---

## 8. Eventos

Formato: **`<dominio>:<verbo en pasado>`**, en minúsculas.

| Evento | Quién lo emite | Datos mínimos |
|---|---|---|
| `circuit:changed` | Rol 4 | `circuitState` nuevo |
| `pin:changed` | Rol 4 | `pinRef`, `signal` |
| `component:burned` | Rol 4 | `instanceId`, `ruleId` |
| `robot:changed` | Rol 3 (al armar) | `robotDefinition` |
| `world:reset` | Rol 3 | — |
| `mission:completed` | Rol 1 | `missionId` |

Los tipos de payload se llaman `<Evento>Event` en `PascalCase`: `PinChangedEvent`, `ComponentBurnedEvent`.

---

## 9. C++ visible e instrucciones TypeScript

Blockly produce C++ equivalente y una lista tipada de instrucciones. El runtime ejecuta esa lista contra el circuito y el mundo. El C++ mostrado usa setup() y loop().

| C++ mostrado | Instruction | Unidades |
|---|---|---|
| delay(1000); | wait, delayMs | Milisegundos |
| digitalWrite(3, HIGH); | digital_write, pinName, digitalValue | D3 se muestra como 3, valores 0 o 1 |
| robokan_motor_write(instanceId, speedPct); | motor_write, instanceId, speedPct | -100 a 100 |
| robokan_distance_cm(trig, echo); | read_distance, trigPinName, echoPinName, resultId | Centímetros |
| robokan_buzzer_write(instanceId, isOn, frequencyHz); | buzzer_write, instanceId, isOn, frequencyHz | Hertz |

Las funciones robokan_* son auxiliares educativas cuya implementación física requiere acordar componentes y pines. Las instrucciones usan pinName de la placa e instanceId según el contrato de core. Rol 4 valida el circuito y expone connections() para localizar pines conectados. resolvePin() devuelve la señal eléctrica. Rol 3 aplica comandos al mundo y devuelve lecturas.

---

## 10. Archivos y recursos

| Recurso | Ruta |
|---|---|
| Modelo 3D | `public/models/<categoría>/<specId>.glb` (ej. `public/models/sensors/hc-sr04.glb`) |
| Vista 2D | `public/svg/components/<specId>.svg` |
| Ficha del componente | `src/modules/components/specs/<specId>.ts` |
| Comportamiento | `src/modules/components/behaviors/<behaviorKind>.ts` |

Carpetas de modelos: `boards`, `sensors`, `actuators`, `robots`, `scenery`.

**Dentro del SVG (Rol 5):** cada pin es un elemento con `id="pin-<pinName>"` y el atributo `data-pin="<pinName>"`. Así el editor (Rol 4) encuentra los pines sin depender de coordenadas escritas a mano. El `svgPosition` de la ficha debe coincidir con el centro de ese elemento.

### Claves de i18n

| Contenido | Clave |
|---|---|
| Nombre de componente | `components.<specId>.name` |
| Descripción de componente | `components.<specId>.description` |
| Etiqueta de pin | `components.<specId>.pins.<pinName>` |
| Mensaje de violación | `errors.<ruleId>` |
| Estado de componente | `status.<status>` (`status.ok`, `status.unpowered`, `status.burned`) |

---

## 11. Ejemplo completo: sensor ultrasónico de principio a fin

1. **Rol 5** define la ficha `specId: 'hc-sr04'`, `category: 'sensor'`, `sensorKind: 'ultrasonic'`, `supplyVoltageV: 5`, pines `VCC`, `TRIG`, `ECHO`, `GND`, `modelPath: 'models/sensors/hc-sr04.glb'` y `svgPath: 'svg/components/hc-sr04.svg'`.
2. El niño arrastra la pieza. Se crea la instancia `instanceId: 'hc-sr04:1'` con `circuitPosition` y `mountPointId: 'front-center'`.
3. El niño conecta `hc-sr04:1/TRIG` con `arduino-uno:1/D9` y `hc-sr04:1/ECHO` con `arduino-uno:1/D10`, creando `wire:1` y `wire:2`.
4. **Rol 4** ejecuta `evaluate(...)`: revisa que `VCC` y `GND` estén bien conectados. Si están invertidos, marca `statusByInstance['hc-sr04:1'] = 'burned'` y una violación `ruleId: 'reversed_polarity'`.
5. Blockly genera una instrucción `read_distance` con `trigPinName: "D9"`, `echoPinName: "D10"` y un `resultId`.
6. **Rol 4** consulta las conexiones del circuito y valida que `D9` y `D10` llegan a `hc-sr04:1/TRIG` y `hc-sr04:1/ECHO`, y devuelve que el sensor es `hc-sr04:1`.
7. **Rol 3** ejecuta `world.query.ultrasonicDistanceCm('hc-sr04:1')`: lanza un rayo desde el nodo `sensor.origin` del GLB, en dirección +Z, y devuelve por ejemplo `23.5` (cm).
8. El runtime guarda `23.5` bajo el `resultId` de la instrucción.

Si el sensor está quemado o sin energía, el paso 7 **no se ejecuta**: el adaptador de lectura devuelve el valor de "sin lectura" según el estado del paso 4.

---

## 12. Lista de verificación antes de usar o crear un nombre

1. ¿Ya existe en este documento o en `src/core/`? Úsalo tal cual.
2. ¿Tiene unidad física? Ponle el sufijo (sección 5).
3. ¿Es un id? Respeta el formato de la sección 3.
4. ¿Es un valor de enum? Impórtalo de `core`, no lo escribas como texto suelto.
5. ¿Lo usan otros dos roles? Agrégalo aquí y avísales.
6. ¿Es un texto que verá el niño? Va en i18n, no en el código.

---

## 13. Cambios respecto a `CLAUDE.md`

Para mantener la regla de "identificadores en inglés", este documento fija:

| En `CLAUDE.md` | Aquí se usa |
|---|---|
| Estado `sin_energia` | `unpowered` |
| Estado `quemado` | `burned` |
| Tipos de pin en español (alimentación, tierra, entrada digital...) | `power`, `ground`, `digital_in`, `digital_out`, `analog_in`, `pwm_out` (más `digital_io` y `passive`) |
| Lectura de distancia | `read_distance` en instrucciones y `robokan_distance_cm` en C++ visible |

Cuando se implemente `src/core/`, usar estos nombres. El texto en español de esos estados se muestra solo al usuario, desde i18n.
