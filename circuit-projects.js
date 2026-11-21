// Preloaded exercises for the circuit workbench (circuits.html).
// Each one brings a complete circuit; opening programming with it loads the
// matching block program (see src/dev/exercise-programs.ts, same ids).

const POWER = "#F16C75";
const GROUND = "#17243B";
const SIGNAL = "#FFB84D";
const wire = (id, from, to, color) => ({
  id,
  from: { component: from[0], pin: from[1] },
  to: { component: to[0], pin: to[1] },
  color,
});

export const DEFAULT_PROJECT = "avoider";

export const projects = {
  avoider: {
    title: "Evasor de obstáculos",
    summary:
      "Un sensor ultrasónico y dos motores: el robot avanza y esquiva lo que tiene enfrente.",
    challenge:
      "Abre Mundo 3D y pulsa Ejecutar. Cambia la distancia de esquiva en el bloque Avanzar.",
    circuit: {
      components: [
        { id: "uno-1", type: "uno", x: 115, y: 305 },
        { id: "sensor-1", type: "ultrasonic", x: 670, y: 166 },
        { id: "breadboard-1", type: "breadboard", x: 640, y: 444 },
        { id: "motor-1", type: "motor", x: 150, y: 605 },
        { id: "motor-2", type: "motor", x: 330, y: 605 },
      ],
      wires: [
        wire("wire-1", ["uno-1", "5V"], ["sensor-1", "VCC"], POWER),
        wire("wire-2", ["uno-1", "GND1"], ["sensor-1", "GND"], GROUND),
        wire("wire-3", ["uno-1", "D9"], ["sensor-1", "TRIG"], "#20C997"),
        wire("wire-4", ["uno-1", "D10"], ["sensor-1", "ECHO"], "#8B72E8"),
        // Drive motors: motor-1 is the left wheel, motor-2 the right wheel in the 3D world.
        wire("wire-5", ["uno-1", "5V"], ["motor-1", "MOTOR_POSITIVE"], POWER),
        wire(
          "wire-6",
          ["uno-1", "GND2"],
          ["motor-1", "MOTOR_NEGATIVE"],
          GROUND,
        ),
        wire("wire-7", ["uno-1", "5V"], ["motor-2", "MOTOR_POSITIVE"], POWER),
        wire(
          "wire-8",
          ["uno-1", "GND2"],
          ["motor-2", "MOTOR_NEGATIVE"],
          GROUND,
        ),
      ],
    },
  },
  "led-on": {
    title: "Encender un LED",
    summary:
      "El primer circuito: 5V pasa por una resistencia, enciende el LED y vuelve a GND.",
    challenge:
      "Pulsa Iniciar simulación y mira el LED. Luego borra la resistencia y conecta el LED directo a 5V: ¿qué pasa?",
    circuit: {
      components: [
        { id: "uno-1", type: "uno", x: 80, y: 330 },
        { id: "resistor-1", type: "resistor", x: 500, y: 200 },
        { id: "led-1", type: "led", x: 760, y: 150, color: "red" },
      ],
      wires: [
        wire("wire-1", ["uno-1", "5V"], ["resistor-1", "PIN_A"], POWER),
        wire("wire-2", ["resistor-1", "PIN_B"], ["led-1", "ANODE"], SIGNAL),
        wire("wire-3", ["led-1", "CATHODE"], ["uno-1", "GND2"], GROUND),
      ],
    },
  },
  "led-blink": {
    title: "LED parpadeante",
    summary: "El pin D13 enciende y apaga el LED. La resistencia lo protege.",
    challenge:
      "Haz doble clic en la placa para programarla y pulsa Ejecutar. Cambia los tiempos para parpadear más rápido.",
    circuit: {
      components: [
        { id: "uno-1", type: "uno", x: 80, y: 330 },
        { id: "resistor-1", type: "resistor", x: 500, y: 200 },
        { id: "led-1", type: "led", x: 760, y: 150, color: "red" },
      ],
      wires: [
        wire("wire-1", ["uno-1", "D13"], ["resistor-1", "PIN_A"], SIGNAL),
        wire("wire-2", ["resistor-1", "PIN_B"], ["led-1", "ANODE"], SIGNAL),
        wire("wire-3", ["led-1", "CATHODE"], ["uno-1", "GND2"], GROUND),
      ],
    },
  },
  "traffic-light": {
    title: "Semáforo",
    summary:
      "Tres LEDs en D11 (verde), D12 (amarillo) y D13 (rojo), cada uno con su resistencia.",
    challenge:
      "Programa la placa y pulsa Ejecutar. ¿Puedes hacer que el amarillo parpadee antes del rojo?",
    circuit: {
      components: [
        { id: "uno-1", type: "uno", x: 60, y: 420 },
        { id: "resistor-1", type: "resistor", x: 420, y: 70 },
        { id: "resistor-2", type: "resistor", x: 420, y: 180 },
        { id: "resistor-3", type: "resistor", x: 420, y: 290 },
        { id: "led-1", type: "led", x: 660, y: 40, color: "red" },
        { id: "led-2", type: "led", x: 800, y: 40, color: "yellow" },
        { id: "led-3", type: "led", x: 940, y: 40, color: "green" },
      ],
      wires: [
        wire("wire-1", ["uno-1", "D13"], ["resistor-1", "PIN_A"], POWER),
        wire("wire-2", ["uno-1", "D12"], ["resistor-2", "PIN_A"], SIGNAL),
        wire("wire-3", ["uno-1", "D11"], ["resistor-3", "PIN_A"], "#20C997"),
        wire("wire-4", ["resistor-1", "PIN_B"], ["led-1", "ANODE"], POWER),
        wire("wire-5", ["resistor-2", "PIN_B"], ["led-2", "ANODE"], SIGNAL),
        wire("wire-6", ["resistor-3", "PIN_B"], ["led-3", "ANODE"], "#20C997"),
        wire("wire-7", ["led-1", "CATHODE"], ["uno-1", "GND"], GROUND),
        wire("wire-8", ["led-2", "CATHODE"], ["uno-1", "GND1"], GROUND),
        wire("wire-9", ["led-3", "CATHODE"], ["uno-1", "GND2"], GROUND),
      ],
    },
  },
  distance: {
    title: "Medir distancia",
    summary:
      "El sensor ultrasónico mide qué tan lejos está un objeto, como un murciélago.",
    challenge:
      "Programa la placa y pulsa Ejecutar: verás la distancia en Lecturas. Abre Mundo 3D para medir obstáculos reales.",
    circuit: {
      components: [
        { id: "uno-1", type: "uno", x: 115, y: 305 },
        { id: "sensor-1", type: "ultrasonic", x: 670, y: 166 },
      ],
      wires: [
        wire("wire-1", ["uno-1", "5V"], ["sensor-1", "VCC"], POWER),
        wire("wire-2", ["uno-1", "GND1"], ["sensor-1", "GND"], GROUND),
        wire("wire-3", ["uno-1", "D9"], ["sensor-1", "TRIG"], "#20C997"),
        wire("wire-4", ["uno-1", "D10"], ["sensor-1", "ECHO"], "#8B72E8"),
      ],
    },
  },
};
