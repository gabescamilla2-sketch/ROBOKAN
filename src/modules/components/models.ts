/** Models supplied by Rol 5, origin/modelos-3d at 2f1aa5f8ccc795705276239ed55af046eb3bbe65. */
export const COMPONENT_MODELS = {
  "chassis-2wd": {
    url: new URL("./chasis.glb", import.meta.url).href,
    label: "Chasis 2WD",
    size: 1.45,
    rotation: [0, Math.PI, 0],
  },
  wheel: {
    url: new URL("./wheel.glb", import.meta.url).href,
    label: "Rueda",
    size: 0.72,
    rotation: [0, 0, 0],
  },
  "arduino-uno": {
    url: new URL("./arduino_uno.glb", import.meta.url).href,
    label: "Arduino Uno",
    size: 0.8,
    rotation: [Math.PI / 2, 0, 0],
  },
  "raspberry-pi-4": {
    url: new URL("./raspberry.glb", import.meta.url).href,
    label: "Raspberry Pi",
    size: 0.8,
    rotation: [0, 0, 0],
  },
  "hc-sr04": {
    url: new URL("./ultrasonico.glb", import.meta.url).href,
    label: "Ultrasónico HC-SR04",
    size: 0.58,
    rotation: [0, 0, 0],
  },
  led: {
    url: new URL("./led.glb", import.meta.url).href,
    label: "LED",
    size: 0.32,
    rotation: [0, 0, 0],
  },
  "dc-motor": {
    url: new URL("./motor.glb", import.meta.url).href,
    label: "Motor DC",
    size: 0.62,
    rotation: [0, 0, 0],
  },
  "motor-driver-l298n": {
    url: new URL("./l298n.glb", import.meta.url).href,
    label: "Controlador L298N",
    size: 0.48,
    rotation: [0, 0, 0],
  },
  "battery-9v": {
    url: new URL("./bateria.glb", import.meta.url).href,
    label: "Batería (modelo de referencia)",
    size: 0.58,
    rotation: [Math.PI / 2, 0, 0],
  },
  breadboard: {
    url: new URL("./protoboard.glb", import.meta.url).href,
    label: "Protoboard",
    size: 0.85,
    rotation: [0, 0, 0],
  },
  lm35: {
    url: new URL("./sensor_temperatura_lm35.glb", import.meta.url).href,
    label: "Sensor LM35 (visual)",
    size: 0.28,
    rotation: [0, 0, 0],
  },
} as const;

export type ComponentModelId = keyof typeof COMPONENT_MODELS;
export function getComponentModel(specId: string) {
  return Object.hasOwn(COMPONENT_MODELS, specId)
    ? COMPONENT_MODELS[specId as ComponentModelId]
    : undefined;
}
