import type { ComponentSpec, PinType, RobotDefinition, Wire } from "../core";
import { getComponentModel } from "../modules/components";
function makeSpec(
  specId: string,
  category: ComponentSpec["category"],
  names: [string, PinType][],
  width = 160,
  height = 110,
  supplyVoltageV = 5,
): ComponentSpec {
  const sensorKinds: Record<string, ComponentSpec["sensorKind"]> = {
    "hc-sr04": "ultrasonic",
    "flame-sensor": "flame",
    "mq2-gas-sensor": "gas",
    "ir-line-sensor": "infrared",
    lm35: "temperature",
  };
  const actuatorKinds: Record<string, ComponentSpec["actuatorKind"]> = {
    "dc-motor": "motor",
    "servo-sg90": "servo",
    led: "led",
    buzzer: "buzzer",
  };
  return {
    specId,
    category,
    nameKey: `components.${specId}.name`,
    supplyVoltageV,
    maxVoltageV: supplyVoltageV || 50,
    svgPath: "",
    modelPath: getComponentModel(specId)?.url ?? "",
    behaviorKind: specId,
    sensorKind: sensorKinds[specId],
    actuatorKind: actuatorKinds[specId],
    svgSize: { width, height },
    pins: names.map(([pinName, pinType], index) => ({
      pinName,
      pinType,
      labelKey: `components.${specId}.pins.${pinName}`,
      svgPosition: {
        x: 16 + (index * (width - 32)) / Math.max(names.length - 1, 1),
        y: height - 6,
      },
      ...(pinName.startsWith("GPIO") ? { maxVoltageV: 3.3 } : {}),
    })),
  };
}
const arduino = makeSpec("arduino-uno", "board", [], 420, 200);
arduino.pins = [
  ...Array.from({ length: 14 }, (_, i) => ({
    pinName: `D${i}`,
    pinType: ([3, 5, 6, 9, 10, 11].includes(i)
      ? "pwm_out"
      : "digital_io") as PinType,
    svgPosition: { x: 20 + i * 28, y: 8 },
    labelKey: `D${i}`,
  })),
  ...Array.from({ length: 6 }, (_, i) => ({
    pinName: `A${i}`,
    pinType: "analog_in" as const,
    svgPosition: { x: 20 + i * 28, y: 192 },
    labelKey: `A${i}`,
  })),
  ...["5V", "3V3", "VIN", "GND_1", "GND_2", "GND_3"].map((pinName, i) => ({
    pinName,
    pinType: pinName.startsWith("GND")
      ? ("ground" as const)
      : ("power" as const),
    svgPosition: { x: 190 + i * 42, y: 192 },
    labelKey: pinName,
  })),
];
const pi = makeSpec("raspberry-pi-4", "board", [], 340, 190, 3.3);
pi.pins = [
  ...[17, 22, 23, 24, 27].map((gpio, i) => ({
    pinName: `GPIO${gpio}`,
    pinType: "digital_io" as const,
    maxVoltageV: 3.3,
    svgPosition: { x: 14 + i * 26, y: 8 },
    labelKey: `GPIO${gpio}`,
  })),
  ...[
    "5V_1",
    "5V_2",
    "3V3_1",
    "3V3_2",
    ...Array.from({ length: 8 }, (_, i) => `GND_${i + 1}`),
  ].map((pinName, i) => ({
    pinName,
    pinType: pinName.startsWith("GND")
      ? ("ground" as const)
      : ("power" as const),
    svgPosition: { x: 14 + i * 27, y: 148 },
    labelKey: pinName,
  })),
];
const sensor = (id: string, outputs: [string, PinType][]) =>
  makeSpec(id, "sensor", [["VCC", "power"], ["GND", "ground"], ...outputs]);
const breadboard = makeSpec("breadboard", "breadboard", [], 660, 300, 0);
breadboard.pins = [
  ...Array.from({ length: 300 }, (_, i) => {
    const row = Math.floor(i / 30),
      column = i % 30;
    const pinName = `${"abcdefghij"[row]}${column + 1}`;
    return {
      pinName,
      pinType: "passive" as const,
      labelKey: pinName,
      svgPosition: {
        x: 28 + column * 20,
        y: 78 + row * 14 + (row >= 5 ? 18 : 0),
      },
    };
  }),
  ...[
    "rail_top_pos",
    "rail_top_neg",
    "rail_bottom_pos",
    "rail_bottom_neg",
  ].flatMap((rail, index) =>
    Array.from({ length: 30 }, (_, i) => ({
      pinName: `${rail}_${i + 1}`,
      pinType: "passive" as const,
      labelKey: `${rail}_${i + 1}`,
      svgPosition: { x: 28 + i * 20, y: [18, 38, 260, 280][index] },
    })),
  ),
];
/** Development-only catalog; production supplies ComponentSpec[] from the components module. */
export const circuitSpecs: readonly ComponentSpec[] = [
  arduino,
  pi,
  sensor("hc-sr04", [
    ["TRIG", "digital_in"],
    ["ECHO", "digital_out"],
  ]),
  sensor("flame-sensor", [
    ["AOUT", "analog_in"],
    ["DOUT", "digital_out"],
  ]),
  sensor("mq2-gas-sensor", [
    ["AOUT", "analog_in"],
    ["DOUT", "digital_out"],
  ]),
  sensor("ir-line-sensor", [["OUT", "digital_out"]]),
  sensor("lm35", [["OUT", "analog_in"]]),
  makeSpec(
    "led",
    "actuator",
    [
      ["ANODE", "passive"],
      ["CATHODE", "passive"],
    ],
    80,
    90,
  ),
  makeSpec(
    "resistor",
    "passive",
    [
      ["PIN_A", "passive"],
      ["PIN_B", "passive"],
    ],
    120,
    60,
    0,
  ),
  makeSpec(
    "buzzer",
    "actuator",
    [
      ["POSITIVE", "power"],
      ["NEGATIVE", "ground"],
    ],
    110,
    100,
  ),
  makeSpec("servo-sg90", "actuator", [
    ["SIGNAL", "digital_in"],
    ["VCC", "power"],
    ["GND", "ground"],
  ]),
  makeSpec("dc-motor", "actuator", [
    ["MOTOR_POSITIVE", "passive"],
    ["MOTOR_NEGATIVE", "passive"],
  ]),
  makeSpec(
    "motor-driver-l298n",
    "actuator",
    [
      ["IN1", "digital_in"],
      ["IN2", "digital_in"],
      ["IN3", "digital_in"],
      ["IN4", "digital_in"],
      ["ENA", "digital_in"],
      ["ENB", "digital_in"],
      ["OUT1", "digital_out"],
      ["OUT2", "digital_out"],
      ["OUT3", "digital_out"],
      ["OUT4", "digital_out"],
      ["VCC_MOTOR", "power"],
      ["GND", "ground"],
      ["5V", "power"],
    ],
    320,
    140,
  ),
  makeSpec(
    "battery-9v",
    "power_source",
    [
      ["POSITIVE", "power"],
      ["NEGATIVE", "ground"],
    ],
    120,
    120,
    9,
  ),
  breadboard,
];
export type CircuitProject = "avoider" | "line-follower" | "blank";
export function createExample(
  project: CircuitProject,
  complete = true,
): { robot: RobotDefinition; expected: Wire[] } {
  const sensorId = project === "line-follower" ? "ir-line-sensor" : "hc-sr04";
  const componentInstances =
    project === "blank"
      ? []
      : [
          { specId: "arduino-uno", x: 80, y: 240 },
          { specId: sensorId, x: 620, y: 120 },
          { specId: "resistor", x: 500, y: 440 },
          { specId: "led", x: 740, y: 440 },
        ].map(({ specId, x, y }) => ({
          instanceId: `${specId}:1`,
          specId,
          circuitPosition: { x, y },
          rotationDeg: 0,
        }));
  const pairs: [string, string][] =
    project === "blank"
      ? []
      : [
          ["arduino-uno:1/5V", `${sensorId}:1/VCC`],
          ["arduino-uno:1/GND_1", `${sensorId}:1/GND`],
          ...(project === "line-follower"
            ? [["arduino-uno:1/D2", `${sensorId}:1/OUT`] as [string, string]]
            : ([
                ["arduino-uno:1/D9", `${sensorId}:1/TRIG`],
                ["arduino-uno:1/D10", `${sensorId}:1/ECHO`],
              ] as [string, string][])),
          ["arduino-uno:1/D13", "resistor:1/PIN_A"],
          ["resistor:1/PIN_B", "led:1/ANODE"],
          ["led:1/CATHODE", "arduino-uno:1/GND_1"],
        ];
  const expected = pairs.map(([fromPin, toPin], i) => ({
    wireId: `wire:${i + 1}`,
    fromPin,
    toPin,
    colorHex:
      i === 0
        ? "#dc2626"
        : i === 1 || i === pairs.length - 1
          ? "#334155"
          : "#006edb",
  }));
  return {
    robot: {
      chassisId: "chassis-2wd",
      boardInstanceId: project === "blank" ? "" : "arduino-uno:1",
      programSource: "",
      componentInstances,
      wires: complete ? expected : [],
      idSequence: { component: 2, wire: expected.length + 1 },
    },
    expected,
  };
}
