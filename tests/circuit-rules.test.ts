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
  supplyVoltageV: 5,
  pins: [
    { pinName: "D9", pinType: "digital_out", maxVoltageV: 5 },
    { pinName: "D10", pinType: "digital_in", maxVoltageV: 5 },
    { pinName: "D2", pinType: "digital_in", maxVoltageV: 5 },
    { pinName: "GND_1", pinType: "ground" },
    { pinName: "5V", pinType: "power", maxVoltageV: 5 },
    { pinName: "3V3", pinType: "power", maxVoltageV: 3.3 },
  ],
};

const raspberryPiSpec: CircuitRuleSpec = {
  specId: "raspberry-pi-4",
  category: "board",
  supplyVoltageV: 3.3,
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

  it("flags powered HC-SR04 ECHO connected directly to a 3.3 V Raspberry Pi GPIO", () => {
    const circuitGraph: CircuitGraphInput = {
      componentInstances: [
        { instanceId: "raspberry-pi-4:1", specId: "raspberry-pi-4" },
        { instanceId: "hc-sr04:1", specId: "hc-sr04" },
        { instanceId: "arduino-uno:1", specId: "arduino-uno" },
      ],
      wires: [
        makeWire("wire:1", "hc-sr04:1/ECHO", "raspberry-pi-4:1/GPIO17"),
        makeWire("wire:2", "arduino-uno:1/5V", "hc-sr04:1/VCC"),
        makeWire("wire:3", "arduino-uno:1/GND_1", "hc-sr04:1/GND"),
        makeWire("wire:4", "arduino-uno:1/GND_1", "raspberry-pi-4:1/GND_1"),
      ],
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


function testCircuit(specIds: string[], pinPairs: [string, string][]): CircuitGraphInput {
  return {
    componentInstances: specIds.map((specId) => ({ instanceId: `${specId}:1`, specId })),
    wires: pinPairs.map(([fromPin, toPin], index) => makeWire(`wire:${index + 1}`, fromPin, toPin)),
  };
}

const poweredSensorWires: [string, string][] = [
  ["arduino-uno:1/5V", "hc-sr04:1/VCC"],
  ["arduino-uno:1/GND_1", "hc-sr04:1/GND"],
];

describe("circuit rule regressions", () => {
  it("requires common ground for an actuator digital input", () => {
    const servoSpec: CircuitRuleSpec = {
      specId: "servo-sg90", category: "actuator", supplyVoltageV: 5,
      pins: [
        { pinName: "SIGNAL", pinType: "digital_in" },
        { pinName: "VCC", pinType: "power" },
        { pinName: "GND", pinType: "ground" },
      ],
    };
    const circuitGraph = testCircuit(["arduino-uno", "servo-sg90"], [
      ["arduino-uno:1/D9", "servo-sg90:1/SIGNAL"],
      ["arduino-uno:1/5V", "servo-sg90:1/VCC"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, [...componentSpecs, servoSpec]);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "missing_common_ground", instanceId: "servo-sg90:1",
      messageKey: "errors.missing_common_ground",
    }));
    expect(result.statusByInstance["servo-sg90:1"]).toBe("unpowered");
  });

  it("accepts a powered sensor with common ground and driven inputs", () => {
    const circuitGraph = testCircuit(["arduino-uno", "hc-sr04"], [
      ...poweredSensorWires,
      ["arduino-uno:1/D9", "hc-sr04:1/TRIG"],
      ["arduino-uno:1/D10", "hc-sr04:1/ECHO"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.statusByInstance["hc-sr04:1"]).toBe("ok");
    expect(result.violations.filter((violation) => violation.instanceId === "hc-sr04:1")).toEqual([]);
    expect(result.violations).not.toContainEqual(expect.objectContaining({
      ruleId: "floating_pin", pinRef: "arduino-uno:1/D10",
    }));
  });

  it.each([
    ["arduino-uno", "arduino-uno:1/5V"],
    ["battery-9v", "battery-9v:1/POSITIVE"],
  ])("detects direct GPIO overvoltage from %s", (sourceSpecId, sourcePinRef) => {
    const circuitGraph = testCircuit([sourceSpecId, "raspberry-pi-4"], [
      [sourcePinRef, "raspberry-pi-4:1/GPIO17"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "overvoltage_gpio", instanceId: "raspberry-pi-4:1",
      pinRef: "raspberry-pi-4:1/GPIO17", messageKey: "errors.overvoltage_gpio",
    }));
    expect(result.statusByInstance["raspberry-pi-4:1"]).toBe("burned");
  });

  it("does not burn GPIO from an unpowered sensor output", () => {
    const circuitGraph = testCircuit(["hc-sr04", "raspberry-pi-4"], [
      ["hc-sr04:1/ECHO", "raspberry-pi-4:1/GPIO17"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations.some((violation) => violation.ruleId === "overvoltage_gpio")).toBe(false);
    expect(result.statusByInstance["raspberry-pi-4:1"]).toBe("ok");
    expect(result.statusByInstance["hc-sr04:1"]).toBe("unpowered");
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "floating_pin", pinRef: "raspberry-pi-4:1/GPIO17",
    }));
  });

  it("accepts a direct 3.3 V supply at a 3.3 V GPIO", () => {
    const circuitGraph = testCircuit(["arduino-uno", "raspberry-pi-4"], [
      ["arduino-uno:1/3V3", "raspberry-pi-4:1/GPIO17"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations.some((violation) => violation.ruleId === "overvoltage_gpio")).toBe(false);
    expect(result.statusByInstance["raspberry-pi-4:1"]).toBe("ok");
  });

  it("uses operating supply voltage rather than a sensor maximum rating", () => {
    const circuitGraph = testCircuit(["arduino-uno", "hc-sr04", "raspberry-pi-4"], [
      ...poweredSensorWires,
      ["hc-sr04:1/ECHO", "raspberry-pi-4:1/GPIO17"],
      ["arduino-uno:1/GND_1", "raspberry-pi-4:1/GND_1"],
    ]);
    const tolerantGpioSpec = {
      ...raspberryPiSpec,
      pins: raspberryPiSpec.pins.map((pin) => ({ ...pin, maxVoltageV: 5 })),
    };
    const higherRatedSensor = {
      ...hcSr04Spec, maxVoltageV: 5.5,
      pins: hcSr04Spec.pins.map((pin) => ({ ...pin, maxVoltageV: 5.5 })),
    };
    const result = evaluateCircuitRules(circuitGraph, [arduinoUnoSpec, higherRatedSensor, tolerantGpioSpec]);
    expect(result.violations.some((violation) => violation.ruleId === "overvoltage_gpio")).toBe(false);
  });

  it("does not accept a parallel resistor as LED protection", () => {
    const circuitGraph = testCircuit(["arduino-uno", "led", "resistor"], [
      ["arduino-uno:1/5V", "led:1/ANODE"],
      ["arduino-uno:1/GND_1", "led:1/CATHODE"],
      ["led:1/ANODE", "resistor:1/PIN_A"],
      ["resistor:1/PIN_B", "arduino-uno:1/GND_1"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({ ruleId: "led_without_resistor" }));
    expect(result.statusByInstance["led:1"]).toBe("burned");
  });

  it("does not burn an LED between two equal-voltage supply nets", () => {
    const circuitGraph = testCircuit(["arduino-uno", "led"], [
      ["arduino-uno:1/5V", "led:1/ANODE"],
      ["arduino-uno:1/D9", "led:1/CATHODE"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations.some((violation) => violation.ruleId === "led_without_resistor")).toBe(false);
    expect(result.statusByInstance["led:1"]).toBe("unpowered");
  });

  it("marks a completely disconnected sensor unpowered", () => {
    const result = evaluateCircuitRules(testCircuit(["hc-sr04"], []), componentSpecs);
    expect(result.statusByInstance["hc-sr04:1"]).toBe("unpowered");
    expect(result.violations.some((violation) => violation.ruleId === "overvoltage_gpio")).toBe(false);
  });

  it("marks a completely disconnected LED unpowered", () => {
    const result = evaluateCircuitRules(testCircuit(["led"], []), componentSpecs);
    expect(result.statusByInstance["led:1"]).toBe("unpowered");
    expect(result.violations).toEqual([]);
  });

  it.each(["ANODE", "CATHODE"])("accepts an actual resistor in series at the LED %s", (ledPinName) => {
    const isAnode = ledPinName === "ANODE";
    const circuitGraph = testCircuit(["arduino-uno", "led", "resistor"], [
      [isAnode ? "arduino-uno:1/5V" : "arduino-uno:1/GND_1", "resistor:1/PIN_A"],
      ["resistor:1/PIN_B", `led:1/${ledPinName}`],
      [isAnode ? "led:1/CATHODE" : "led:1/ANODE", isAnode ? "arduino-uno:1/GND_1" : "arduino-uno:1/5V"],
    ]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.violations.filter((violation) => violation.instanceId === "led:1")).toEqual([]);
    expect(result.statusByInstance["led:1"]).toBe("ok");
  });

  it("keeps two inputs connected only to each other floating", () => {
    const circuitGraph = testCircuit(["arduino-uno"], [["arduino-uno:1/D2", "arduino-uno:1/D10"]]);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    for (const pinRef of ["arduino-uno:1/D2", "arduino-uno:1/D10"]) {
      expect(result.violations).toContainEqual(expect.objectContaining({ ruleId: "floating_pin", pinRef }));
    }
  });

  it("treats an undriven digital_io GPIO as floating", () => {
    const result = evaluateCircuitRules(testCircuit(["raspberry-pi-4"], []), componentSpecs);
    expect(result.violations).toContainEqual(expect.objectContaining({
      ruleId: "floating_pin", pinRef: "raspberry-pi-4:1/GPIO17",
    }));
  });

  it("accepts an input connected to a ground reference", () => {
    const circuitGraph = testCircuit(["arduino-uno"], [["arduino-uno:1/D2", "arduino-uno:1/GND_1"]]);
    expect(getViolations(circuitGraph)).not.toContainEqual(expect.objectContaining({
      ruleId: "floating_pin", pinRef: "arduino-uno:1/D2",
    }));
  });
});


it("does not treat a powered analog output as an input-only net", () => {
  // Preserve legacy structural pin specs until the shared core contract exists.
  const analogSensor: CircuitRuleSpec = {
    specId: "mq2-gas-sensor", category: "sensor",
    pins: [
      { pinName: "VCC", pinType: "power" },
      { pinName: "GND", pinType: "ground" },
      { pinName: "AOUT", pinType: "analog_out" },
    ],
  };
  const circuitGraph = testCircuit(["arduino-uno", "mq2-gas-sensor"], [
    ["arduino-uno:1/5V", "mq2-gas-sensor:1/VCC"],
    ["arduino-uno:1/GND_1", "mq2-gas-sensor:1/GND"],
    ["mq2-gas-sensor:1/AOUT", "arduino-uno:1/D10"],
  ]);
  const result = evaluateCircuitRules(circuitGraph, [arduinoUnoSpec, analogSensor]);
  expect(result.statusByInstance["mq2-gas-sensor:1"]).toBe("ok");
  expect(result.violations).not.toContainEqual(expect.objectContaining({
    ruleId: "floating_pin", instanceId: "arduino-uno:1", pinRef: "arduino-uno:1/D10",
  }));
});


it("requires ground from the board driving a servo, not another board", () => {
  const servoSpec: CircuitRuleSpec = {
    specId: "servo-sg90", category: "actuator", supplyVoltageV: 5,
    pins: [
      { pinName: "SIGNAL", pinType: "digital_in" },
      { pinName: "VCC", pinType: "power" },
      { pinName: "GND", pinType: "ground" },
    ],
  };
  const circuitGraph = testCircuit(["arduino-uno", "servo-sg90"], [
    ["arduino-uno:1/5V", "servo-sg90:1/VCC"],
    ["arduino-uno:1/GND_1", "servo-sg90:1/GND"],
    ["arduino-uno:2/D9", "servo-sg90:1/SIGNAL"],
  ]);
  circuitGraph.componentInstances = [...circuitGraph.componentInstances,
    { instanceId: "arduino-uno:2", specId: "arduino-uno" }];
  const result = evaluateCircuitRules(circuitGraph, [...componentSpecs, servoSpec]);
  expect(result.violations).toContainEqual(expect.objectContaining({
    ruleId: "missing_common_ground", instanceId: "servo-sg90:1",
  }));
  expect(result.statusByInstance["servo-sg90:1"]).toBe("unpowered");
  circuitGraph.wires = [...circuitGraph.wires,
    makeWire("wire:4", "arduino-uno:2/GND_1", "arduino-uno:1/GND_1")];
  const grounded = evaluateCircuitRules(circuitGraph, [...componentSpecs, servoSpec]);
  expect(grounded.statusByInstance["servo-sg90:1"]).toBe("ok");
  expect(grounded.violations.filter((violation) => violation.instanceId === "servo-sg90:1")).toEqual([]);
});

it("requires ground for every board connected to a sensor signal", () => {
  const circuitGraph = testCircuit(["arduino-uno", "hc-sr04", "raspberry-pi-4"], [
    ...poweredSensorWires,
    ["arduino-uno:1/D9", "hc-sr04:1/TRIG"],
    ["hc-sr04:1/ECHO", "raspberry-pi-4:1/GPIO17"],
  ]);
  const result = evaluateCircuitRules(circuitGraph, componentSpecs);
  expect(result.violations).toContainEqual(expect.objectContaining({
    ruleId: "missing_common_ground", instanceId: "hc-sr04:1",
  }));
  expect(result.statusByInstance["hc-sr04:1"]).toBe("unpowered");
  expect(result.statusByInstance["raspberry-pi-4:1"]).toBe("ok");
  expect(result.violations.some((violation) => violation.ruleId === "overvoltage_gpio")).toBe(false);
});

it("does not traverse a ground reference to find power through an unrelated load", () => {
  const circuitGraph = testCircuit(["arduino-uno", "hc-sr04", "raspberry-pi-4", "resistor"], [
    ["arduino-uno:1/GND_1", "hc-sr04:1/GND"],
    ["arduino-uno:1/GND_1", "raspberry-pi-4:1/GND_1"],
    ["hc-sr04:1/VCC", "resistor:1/PIN_A"],
    ["resistor:1/PIN_B", "arduino-uno:1/GND_1"],
    ["arduino-uno:1/GND_1", "resistor:2/PIN_A"],
    ["resistor:2/PIN_B", "arduino-uno:1/5V"],
    ["hc-sr04:1/ECHO", "raspberry-pi-4:1/GPIO17"],
  ]);
  circuitGraph.componentInstances = [...circuitGraph.componentInstances,
    { instanceId: "resistor:2", specId: "resistor" }];
  const result = evaluateCircuitRules(circuitGraph, componentSpecs);
  expect(result.statusByInstance["hc-sr04:1"]).toBe("unpowered");
  expect(result.statusByInstance["raspberry-pi-4:1"]).toBe("ok");
  expect(result.violations.some((violation) => violation.ruleId === "overvoltage_gpio")).toBe(false);
});


it.each(["unwired", "referenced_board", "isolated_board"])(
  "keeps declared pins in defined nets across boards: %s", (mode) => {
    const pinPairs: [string, string][] = [...poweredSensorWires];
    if (mode !== "unwired") pinPairs.push([
      mode === "referenced_board" ? "arduino-uno:1/D9" : "raspberry-pi-4:1/GPIO17",
      "hc-sr04:1/TRIG",
    ]);
    const circuitGraph = testCircuit(["arduino-uno", "hc-sr04", "raspberry-pi-4"], pinPairs);
    const result = evaluateCircuitRules(circuitGraph, componentSpecs);
    expect(result.netlistIssues).toEqual([]);
    for (const componentInstance of circuitGraph.componentInstances) {
      const componentSpec = componentSpecs.find((spec) => spec.specId === componentInstance.specId)!;
      for (const pin of componentSpec.pins) {
        const pinRef = createPinRef(componentInstance.instanceId, pin.pinName);
        expect(result.nets.filter((net) => net.pinRefs.includes(pinRef))).toHaveLength(1);
      }
    }
    expect(result.violations.some((violation) => violation.ruleId === "missing_common_ground"))
      .toBe(mode === "isolated_board");
    expect(result.statusByInstance["hc-sr04:1"]).toBe(mode === "isolated_board" ? "unpowered" : "ok");
  },
);
