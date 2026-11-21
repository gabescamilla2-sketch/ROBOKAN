export const MAX_PROGRAM_FILE_BYTES = 1_000_000;

export function parseProgramFile(source: string): { blocks?: object } {
  if (new TextEncoder().encode(source).length > MAX_PROGRAM_FILE_BYTES) throw new Error("Program file too large");
  const envelope = JSON.parse(source);
  const workspace = envelope?.workspace;
  if (envelope?.version !== 1 || !workspace || typeof workspace !== "object" || Array.isArray(workspace)) throw new Error("Invalid program envelope");
  if (Object.keys(workspace).some((key) => key !== "blocks")) throw new Error("Unknown workspace serializer");
  const pending: unknown[] = [workspace];
  let visited = 0;
  const blockTypes = new Set(["robokan_wait", "robokan_motor_write", "robokan_read_distance", "robokan_sensor_read", "robokan_digital_write", "robokan_servo_write", "robokan_buzzer_write", "robokan_drive_until_distance"]);
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    if (++visited > 10000) throw new Error("Program structure too large");
    const record = current as Record<string, unknown>;
    if (Object.hasOwn(record, "type") && !blockTypes.has(String(record.type))) throw new Error("Unknown block type");
    pending.push(...Object.values(record));
  }
  return workspace;
}
