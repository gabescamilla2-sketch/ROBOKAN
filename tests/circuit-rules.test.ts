import { describe, expect, it } from "vitest";
import {
  buildNetlist,
  createPinRef,
  evaluateCircuitRules,
  parsePinRef,
  type CircuitGraphInput,
  type CircuitRuleSpec,
} from "../src/modules/circuit";

const arduinoUnoSpec: CircuitRuleSpec = {
  specId: "arduino-uno",
  category: "board",
  pins: [
    { pinName: "D9", pinType: "digital_out", maxVoltageV: 5 },
    { pinName: "D10", pinType: "digital_in", maxVoltageV: 5 },
    { pinName: "D2", pinType: "digital_in", maxVoltageV: 5 },
    { pinName: "GND_1", pinType: "ground" },
    { pinName: "5V", pinType: "power", maxVoltageV: 5 },
  ],
};

const raspberryPiSpec: CircuitRuleSpec = {
  specId: "raspberry-pi-4",
  category: "board",
  pins: [
    { pinName: "GPIO17", pinType: "digital_io", maxVoltageV: 3.3 },
    { pinName: "GND_1", pinType: "ground" },
  ],
};

const hcSr04Spec: CircuitRuleSpec = {
  specId: "hc-sr04",
  category: "sensor",
  supplyVoltageV: 5,
  maxVoltageV: 5,
  pins: [
    { pinName: "VCC", pinType: "power", maxVoltageV: 5 },
    { pinName: "TRIG", pinType: "digital_in" },
    { pinName: "ECHO", pinType: "digital_out", maxVoltageV: 5 },
    { pinName: "GND", pinType: "ground" },
  ],
};

const batterySpec: CircuitRuleSpec = {
  specId: "battery-9v",
  category: "power_source",
  supplyVoltageV: 9,
  pins: [
    { pinName: "POSITIVE", pinType: "power", maxVoltageV: 9 },
    { pinName: "NEGATIVE", pinType: "ground" },
  ],
};

const ledSpec: CircuitRuleSpec = {
  specId: "led",
  category: "actuator",
  pins: [
    { pinName: "ANODE", pinType: "passive" },
    { pinName: "CATHODE", pinType: "passive" },
  ],
};

const resistorSpec: CircuitRuleSpec = {
  specId: "resistor",
  category: "passive",
  pins: [
    { pinName: "PIN_A", pinType: "passive" },
    { pinName: "PIN_B", pinType: "passive" },
  ],
};

const componentSpecs = [arduinoUnoSpec, raspberryPiSpec, hcSr04Spec, batterySpec, ledSpec, resistorSpec];

function makeWire(wireId: string, fromPin: string, toPin: string): CircuitGraphInput["wires"][number] {
  return { wireId, fromPin, toPin, colorHex: "#0080ff" };
}

function getViolations(circuitGraph: CircuitGraphInput) {
  return evaluateCircuitRules(circuitGraph, componentSpecs).violations;
}

describe("circuit pin references and netlist", () => {
  it("creates and parses a shared PinRef", () => {
    const pinRef = createPinRef("hc-sr04:1", "TRIG");
    expect(pinRef).toBe("hc-sr04:1/TRIG");
    expect(parsePinRef(pinRef)).toEqual({ instanceId: "hc-sr04:1", pinName: "TRIG" });
  });

  it("groups wired pins into one net", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "arduino-uno:1", specId: "arduino-uno" },
        { instanceId: "hc-sr04:1", specId: "hc-sr04" },
      ],
      wires: [makeWire("wire:1", "arduino-uno:1/D9", "hc-sr04:1/TRIG")],
    };

    const result = buildNetlist(circuitGraph, {
      "arduino-uno": arduinoUnoSpec.pins.map((pin) => pin.pinName),
      "hc-sr04": hcSr04Spec.pins.map((pin) => pin.pinName),
    });

    expect(result.issues).toEqual([]);
    expect(result.nets).toContainEqual({
      netId: expect.any(String),
      pinRefs: ["arduino-uno:1/D9", "hc-sr04:1/TRIG"],
    });
  });
});

describe("educational circuit rules", () => {
  it("flags an LED connected between an output and GND without a series resistor", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "arduino-uno:1", specId: "arduino-uno" },
        { instanceId: "led:1", specId: "led" },
      ],
      wires: [
        makeWire("wire:1", "arduino-uno:1/D9", "led:1/ANODE"),
        makeWire("wire:2", "led:1/CATHODE", "arduino-uno:1/GND_1"),
      ],
    };

    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "led_without_resistor",
      instanceId: "led:1",
      messageKey: "errors.led_without_resistor",
    }));
    expect(result.statusByInstance["led:1"]).toBe("burned");
  });

  it("accepts a resistor in series with the LED", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "arduino-uno:1", specId: "arduino-uno" },
        { instanceId: "led:1", specId: "led" },
        { instanceId: "resistor:1", specId: "resistor" },
      ],
      wires: [
        makeWire("wire:1", "arduino-uno:1/D9", "resistor:1/PIN_A"),
        makeWire("wire:2", "resistor:1/PIN_B", "led:1/ANODE"),
        makeWire("wire:3", "led:1/CATHODE", "arduino-uno:1/GND_1"),
      ],
    };

    expect(getViolations(circuitGraph).some((violation) => violation.ruleId === "led_without_resistor")).toBe(false);
  });

  it("flags a sensor with VCC and GND reversed", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "hc-sr04:1", specId: "hc-sr04" },
        { instanceId: "battery-9v:1", specId: "battery-9v" },
      ],
      wires: [
        makeWire("wire:1", "battery-9v:1/NEGATIVE", "hc-sr04:1/VCC"),
        makeWire("wire:2", "battery-9v:1/POSITIVE", "hc-sr04:1/GND"),
      ],
    };

    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "reversed_polarity",
      instanceId: "hc-sr04:1",
    }));
    expect(result.statusByInstance["hc-sr04:1"]).toBe("burned");
  });

  it("flags a sensor signal connected to Arduino without common GND", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "arduino-uno:1", specId: "arduino-uno" },
        { instanceId: "hc-sr04:1", specId: "hc-sr04" },
      ],
      wires: [makeWire("wire:1", "arduino-uno:1/D10", "hc-sr04:1/ECHO")],
    };

    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "missing_common_ground",
      instanceId: "hc-sr04:1",
    }));
    expect(result.statusByInstance["hc-sr04:1"]).toBe("unpowered");
  });

  it("flags HC-SR04 ECHO connected directly to a 3.3 V Raspberry Pi GPIO", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "raspberry-pi-4:1", specId: "raspberry-pi-4" },
        { instanceId: "hc-sr04:1", specId: "hc-sr04" },
      ],
      wires: [makeWire("wire:1", "hc-sr04:1/ECHO", "raspberry-pi-4:1/GPIO17")],
    };

    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "overvoltage_gpio",
      instanceId: "raspberry-pi-4:1",
      pinRef: "raspberry-pi-4:1/GPIO17",
    }));
    expect(result.statusByInstance["raspberry-pi-4:1"]).toBe("burned");
  });

  it("flags an unconnected digital input as floating", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [{ instanceId: "arduino-uno:1", specId: "arduino-uno" }],
      wires: [],
    };

    expect(getViolations(circuitGraph)).toContainEqual(expect.objectContaining({
      ruleId: "floating_pin",
      instanceId: "arduino-uno:1",
      pinRef: "arduino-uno:1/D2",
    }));
  });
});
