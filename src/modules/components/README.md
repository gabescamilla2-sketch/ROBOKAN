# Modelos 3D de componentes

Fuente: rama [modelos-3d](https://github.com/gabescamilla2-sketch/ROBOKAN/tree/2f1aa5f8ccc795705276239ed55af046eb3bbe65/src/modules/components), commit `2f1aa5f8ccc795705276239ed55af046eb3bbe65`.

Los once GLB se conservan sin editar respecto a esa versión. `models.ts` define las URL, orientación inicial y tamaño de presentación; `index.ts` es la entrada pública del catálogo visual. Vite genera las URL de producción y copia los binarios a `dist/assets`.

| ID del catálogo | Archivo | Uso en el mundo |
| --- | --- | --- |
| `chassis-2wd` | `chasis.glb` | Base del robot y puntos de montaje |
| `wheel` | `wheel.glb` | Ruedas animadas por lado |
| `arduino-uno` | `arduino_uno.glb` | Placa del circuito |
| `raspberry-pi-4` | `raspberry.glb` | Representación visual de placa Raspberry Pi |
| `hc-sr04` | `ultrasonico.glb` | Sensor frontal con lectura de obstáculos |
| `led` | `led.glb` | Emisión del cuerpo del LED según `digital_write` |
| `dc-motor` | `motor.glb` | Motor vinculado por `instanceId` al movimiento |
| `motor-driver-l298n` | `l298n.glb` | Controlador del circuito, montado en la base |
| `battery-9v` | `bateria.glb` | Representación visual de alimentación |
| `breadboard` | `protoboard.glb` | Protoboard del circuito |
| `lm35` | `sensor_temperatura_lm35.glb` | Modelo visual disponible; sin lectura de temperatura implementada |

`battery-9v` y `raspberry-pi-4` conservan los contratos eléctricos existentes. La geometría suministrada es una referencia visual: no modifica voltajes, pines ni versiones de hardware del contrato.

El montaje usa `mount_arduino`, `mount_battery`, `mount_driver`, `mount_motor_left`, `mount_motor_right` y `mount_ultrasonic` del chasis. Conserva los nodos de pines dentro de cada modelo y crea `sensor.origin:<instanceId>` al frente del HC-SR04. Escala y orientación se aplican mediante nodos contenedores, sin modificar los binarios.

Solo se cargan los modelos necesarios para el circuito actual y los de la base. Dos instancias de un mismo componente comparten la geometría cargada y tienen materiales independientes. Servo, buzzer y sensores sin un GLB suministrado conservan su representación o comportamiento anterior.

Verificación: `npx vitest run tests/component-models.test.ts`. Estas pruebas cargan los GLB reales con Babylon NullEngine, comprueban dimensiones, montaje, orientación del sensor, independencia de LED y cancelación.
