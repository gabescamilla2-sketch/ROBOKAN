import { describe, expect, it } from "vitest";
import { generateCppProgram, generateInstructions, type ProgramBlock } from "../src/modules/blocks";

describe("block program outputs", () => {
  it("updates the C++ and instructions when wait duration changes", () => {
    expect(generateCppProgram([{ type: "wait", delayMs: 5000 }])).toContain("delay(5000);");
    expect(generateInstructions([{ type: "wait", delayMs: 5000 }])).toEqual([{ op: "wait", delayMs: 5000 }]);
  });

  it("generates each selected block in program order", () => {
    const blocks: ProgramBlock[] = [
      { type: "motor_write", instanceId: "dc-motor:1", speedPct: 50 },
      { type: "wait", delayMs: 2000 },
      { type: "read_distance", trigPinName: "D9", echoPinName: "D10", resultId: "distance_cm" },
      { type: "digital_write", pinName: "D3", digitalValue: 1 },
      { type: "buzzer_write", instanceId: "buzzer:1", isOn: true, frequencyHz: 440 },
    ];
    const cpp = generateCppProgram(blocks);
    expect(cpp).toContain('robokan_motor_write("dc-motor:1", 50);\n  delay(2000);');
    expect(cpp).toContain("distance_cm = robokan_distance_cm(9, 10);");
    expect(cpp).toContain("pinMode(3, OUTPUT);");
    expect(cpp).toContain("digitalWrite(3, HIGH);");
    expect(cpp).toContain('robokan_buzzer_write("buzzer:1", true, 440);');
    expect(generateInstructions(blocks).map((instruction) => instruction.op)).toEqual(blocks.map((block) => block.type));
    expect(generateCppProgram([])).not.toContain("digitalWrite");
  });
});
