# Nombres de pines del editor de circuitos

Este archivo resume los identificadores que deben usar los módulos al referirse a los pines. Los nombres se tomaron de `convenciones-nombres.md`; ese documento compartido sigue siendo la referencia principal.

## Cómo identificar una pieza y un pin

- `specId`: identifica el tipo de componente y se escribe en `kebab-case`, por ejemplo `hc-sr04` o `raspberry-pi-4`.
- `instanceId`: identifica una pieza colocada. Formato: `<specId>:<número>`, por ejemplo `hc-sr04:1`. Lo genera el mecanismo acordado en `core`; no se inventa a mano ni se reutiliza.
- `pinName`: nombre del pin impreso en la pieza. Respeta mayúsculas, guiones bajos y, en protoboard, minúsculas.
- `PinRef`: referencia al pin específico con formato `<instanceId>/<pinName>`, por ejemplo `hc-sr04:1/TRIG` o `arduino-uno:1/D9`.

Un cable (`Wire`) apunta a dos referencias de pin: `fromPin` y `toPin`.

## Placas

| `specId` | Nombres de pin |
|---|---|
| `arduino-uno` | `D0`–`D13`, `A0`–`A5`, `5V`, `3V3`, `VIN`, `GND_1`, `GND_2`, `GND_3` |
| `raspberry-pi-4` | `GPIO2`–`GPIO27`, `5V_1`, `5V_2`, `3V3_1`, `3V3_2`, `GND_1`–`GND_8` |

En Raspberry Pi, cada pin incluye también `physicalPin` con el número que ocupa en el conector físico.

## Sensores

| `specId` | Nombres de pin |
|---|---|
| `hc-sr04` | `VCC`, `TRIG`, `ECHO`, `GND` |
| `flame-sensor` | `VCC`, `GND`, `AOUT`, `DOUT` |
| `mq2-gas-sensor` | `VCC`, `GND`, `AOUT`, `DOUT` |
| `ir-line-sensor` | `VCC`, `GND`, `OUT` |

## Salidas y actuadores

| `specId` | Nombres de pin |
|---|---|
| `led` | `ANODE`, `CATHODE` |
| `buzzer` | `POSITIVE`, `NEGATIVE` |
| `servo-sg90` | `SIGNAL`, `VCC`, `GND` |
| `dc-motor` | `MOTOR_POSITIVE`, `MOTOR_NEGATIVE` |
| `motor-driver-l298n` | `IN1`, `IN2`, `IN3`, `IN4`, `ENA`, `ENB`, `OUT1`, `OUT2`, `OUT3`, `OUT4`, `VCC_MOTOR`, `GND`, `5V` |

## Componentes auxiliares

| `specId` | Nombres de pin |
|---|---|
| `resistor` | `PIN_A`, `PIN_B` |
| `battery-9v` | `POSITIVE`, `NEGATIVE` |
| `breadboard` | Agujeros `a1`–`j30`; rieles `rail_top_pos_<n>`, `rail_top_neg_<n>`, `rail_bottom_pos_<n>`, `rail_bottom_neg_<n>` |

Los agujeros del protoboard van en minúscula para distinguirlos de pines Arduino como `A1`.

## Tipos compartidos de pin (`PinType`)

Usar estos valores exactos; están en minúsculas y `snake_case`:

- `power`
- `ground`
- `digital_in`
- `digital_out`
- `digital_io`
- `analog_in`
- `pwm_out`
- `passive`

## Ejemplos de referencias

```text
arduino-uno:1/D9
hc-sr04:1/TRIG
hc-sr04:1/ECHO
led:1/ANODE
led:1/CATHODE
breadboard:1/a1
breadboard:1/rail_top_pos_1
```

No cambiar mayúsculas/minúsculas ni crear alias como `GND`, `ground` o `echo` si el nombre establecido es, por ejemplo, `GND_1` o `ECHO`.

## Geometría de la cuadrícula de la protoboard

Para alinear los pines virtuales con el modelo 3D, el módulo necesita estos datos del modelo de la protoboard. Las coordenadas deben ser del espacio **local del modelo**, medidas en metros desde el origen del modelo, no desde el origen de la escena de Blender.

| Dato | Valor |
|---|---|
| Centro del primer agujero (`a1`, columna 1, fila A), `{ x, y, z }` en metros | **Pendiente: requiere el modelo Blender** |
| Dirección de avance de columnas (`a1` hacia `a2`), vector local unitario | **Pendiente: requiere el modelo Blender** |
| Dirección de avance de filas (`a1` hacia `b1`), vector local unitario | **Pendiente: requiere el modelo Blender** |
| Separación entre agujeros (`holePitchM`) | `0.00254` m |

### Convención de índices

- La fila `A` tiene índice `0`, `B` índice `1`, hasta `J` índice `9`.
- La columna `1` tiene índice `0` y la columna `30` índice `29`.
- `a1` es el centro del agujero de origen; de ahí se avanza por el vector de columnas y el vector de filas.

Con `originM` como posición local de `a1`, `columnDirection` y `rowDirection` como vectores unitarios locales:

```text
holePositionM(rowIndex, columnIndex) =
  originM
  + columnDirection * columnIndex * holePitchM
  + rowDirection * rowIndex * holePitchM
```

No asumir que columnas coinciden con X ni que filas coinciden con Y: hay que medir el modelo y anotar también el sentido del eje (por ejemplo, `+X` o `-Y`).

### Datos que Rol 4 debe solicitar

El repositorio actual no contiene un archivo `.blend`, `.glb` ni otro modelo de protoboard, así que Rol 4 no puede calcular aquí `originM` ni las direcciones. Hay que pedirle a la persona responsable del modelo que mida el centro de `a1` y confirme los sentidos de columnas y filas en Blender. Al recibir esos datos, se reemplazan los valores pendientes de arriba.

Mensaje para el responsable del modelo:

> Para alinear el editor 2D con tus modelos 3D, ¿me puedes pasar: (1) de la protoboard, la coordenada local en metros del centro de `a1`, el eje y sentido de `a1` hacia `a2` y de `a1` hacia `b1`, y una captura desde arriba; (2) del Arduino Uno, el SVG/ficha con `svgPosition` de cada pin y, si el modelo 3D lo permite, el centro local en metros de cada pin de cabecera o una referencia clara para obtenerlos? La separación de la protoboard es `0.00254 m`; no asumiré que todos los pines o cabeceras del Arduino siguen esa misma cuadrícula sin verificar el modelo.

## Correspondencia entre la vista 2D y modelos 3D

El circuito mantiene una sola conectividad por `PinRef`; las posiciones 2D y 3D son representaciones de esa misma conexión. Para que un cable termine sobre el mismo pin visual en ambas vistas, el equipo necesita las coordenadas de anclaje de cada pieza.

### Protoboard (`breadboard`)

- La separación física entre centros de agujeros es `holePitchM = 0.00254` m.
- El centro de `a1`, junto con los vectores locales de columnas y filas medidos en el modelo, define las coordenadas de todos los agujeros mediante la fórmula anterior.
- El arte 2D de la protoboard debe exponer cada agujero con su `pinName` exacto (`a1`–`j30`). El editor toma el centro del agujero como punto donde se ajusta el extremo del cable.
- La distancia visual entre centros en SVG (`holePitchSvg`) se mide en unidades del `viewBox`. Su escala debe ser uniforme: `metersPerSvgUnit = 0.00254 / holePitchSvg`.
- No asignar coordenadas 3D hasta recibir del modelador el origen y los sentidos de los ejes.

### Arduino Uno (`arduino-uno`)

- Los pines conservan los nombres acordados: `D0`–`D13`, `A0`–`A5`, `5V`, `3V3`, `VIN`, `GND_1`, `GND_2` y `GND_3`.
- En el editor 2D, el centro gráfico de cada pad/cabecera se registra como `svgPosition: { x, y }` dentro del `viewBox` del SVG. El inicio del cable debe ajustarse a ese centro, no a la caja general del dibujo.
- Para la vista 3D, se requieren centros locales en metros de los pines de cabecera o una referencia de modelo que permita obtenerlos. Si el componente 3D no marca cada pin, el modelador debe entregar una tabla por `pinName` o los orígenes/direcciones/espaciados por grupo de cabeceras.
- No aplicar automáticamente el paso `0.00254 m` de la protoboard a todas las cabeceras del Arduino. Puede usarse donde el modelo confirme ese paso; la separación entre grupos y la ubicación relativa de las cabeceras deben medirse en el modelo elegido.
- La posición del Arduino en el robot no cambia los `PinRef`: la transformación del componente (posición/rotación/montaje) se aplica a sus anclajes locales al representar el robot en 3D.

### Datos de modelos que faltan

El repositorio no contiene los SVG/GLB/Blend de la protoboard ni del Arduino, por lo que todavía no se pueden rellenar coordenadas reales. Para cerrar la integración, pedir al responsable de modelos:

| Componente | Datos necesarios para Rol 4 | Estado |
|---|---|---|
| `breadboard` | `a1` local en metros, dirección y sentido de columnas (`a1`→`a2`), dirección y sentido de filas (`a1`→`b1`), captura superior | Pendiente de modelo |
| `arduino-uno` | SVG con `svgPosition` para cada pin; centros locales 3D por `pinName` o referencias y espaciados por grupo; captura superior | Pendiente de modelo |

Cuando se reciban, registrar las coordenadas medidas en la ficha/modelo correspondiente; este documento fija la convención y los nombres, no sustituye las coordenadas reales de los assets.
