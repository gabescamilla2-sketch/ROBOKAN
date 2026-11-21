import type { ProgramBlock } from "./definitions";

function pinExpression(pinName: string): string {
  if (/^D\d+$/.test(pinName)) return pinName.slice(1);
  if (/^A\d+$/.test(pinName)) return pinName;
  if (/^GPIO\d+$/.test(pinName)) return pinName.slice(4);
  throw new Error(`Unsupported Arduino pin: ${pinName}`);
}

export function generateCpp(block: ProgramBlock): string {
  switch (block.type) {
    case "wait":
      return `delay(${block.delayMs});`;
    case "motor_write":
      return `robokan_motor_write(${JSON.stringify(block.instanceId)}, ${block.speedPct});`;
    case "read_distance":
      return `${block.resultId} = robokan_distance_cm(${pinExpression(block.trigPinName)}, ${pinExpression(block.echoPinName)});`;
    case "sensor_read":
      return `${block.resultId} = robokan_sensor_read(${JSON.stringify(block.instanceId)});`;
    case "digital_write":
      return `digitalWrite(${pinExpression(block.pinName)}, ${block.digitalValue === 1 ? "HIGH" : "LOW"});`;
    case "buzzer_write":
      return `robokan_buzzer_write(${JSON.stringify(block.instanceId)}, ${block.isOn}, ${block.frequencyHz});`;
    case "servo_write":
      return `robokan_servo_write(${JSON.stringify(block.instanceId)}, ${block.angleDeg});`;
  }
}

export function generateCppProgram(
  blocks: readonly ProgramBlock[],
  options: { repeat?: boolean } = {},
): string {
  const declarations: string[] = [];
  if (blocks.some((block) => block.type === "motor_write"))
    declarations.push(
      "void robokan_motor_write(const char* instanceId, double speedPct);",
    );
  if (blocks.some((block) => block.type === "buzzer_write"))
    declarations.push(
      "void robokan_buzzer_write(const char* instanceId, bool isOn, double frequencyHz);",
    );
  if (blocks.some((block) => block.type === "servo_write"))
    declarations.push("void robokan_servo_write(const char* instanceId, double angleDeg);");
  if (blocks.some((block) => block.type === "sensor_read"))
    declarations.push("double robokan_sensor_read(const char* instanceId);");
  if (blocks.some((block) => block.type === "read_distance"))
    declarations.push("double robokan_distance_cm(int trigPin, int echoPin);");
  const resultIds = new Set(
    blocks
      .filter((block) => block.type === "read_distance" || block.type === "sensor_read")
      .map((block) => block.resultId),
  );
  for (const resultId of resultIds)
    declarations.push(`double ${resultId} = 0;`);
  const setup = new Set<string>();
  for (const block of blocks) {
    if (block.type === "digital_write")
      setup.add(`  pinMode(${pinExpression(block.pinName)}, OUTPUT);`);
    if (block.type === "read_distance") {
      setup.add(`  pinMode(${pinExpression(block.trigPinName)}, OUTPUT);`);
      setup.add(`  pinMode(${pinExpression(block.echoPinName)}, INPUT);`);
    }
  }
  const body = blocks.map((block) => `  ${generateCpp(block)}`).join("\n");
  if (options.repeat === false) {
    const shutdown = new Set<string>();
    for (const block of blocks) {
      if (block.type === "motor_write")
        shutdown.add(`  ${generateCpp({ ...block, speedPct: 0 })}`);
      if (block.type === "digital_write")
        shutdown.add(`  ${generateCpp({ ...block, digitalValue: 0 })}`);
      if (block.type === "buzzer_write")
        shutdown.add(`  ${generateCpp({ ...block, isOn: false })}`);
      if (block.type === "servo_write")
        shutdown.add(`  ${generateCpp({ ...block, angleDeg: 90 })}`);
    }
    return `${declarations.join("\n")}\n\nvoid setup() {\n${[...setup].join("\n")}\n${body}\n${[...shutdown].join("\n")}\n}\n\nvoid loop() {\n}`.trim();
  }
  return `${declarations.join("\n")}\n\nvoid setup() {\n${[...setup].join("\n")}\n}\n\nvoid loop() {\n${body}\n}`.trim();
}
