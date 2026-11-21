/** Continuous rails, isolated a-e/f-j banks, numbered columns. No implicit mid-rail bridge. */
export function breadboardConnections(
  pinNames: readonly string[],
): [string, string][] {
  const groups = new Map<string, string[]>();
  for (const pinName of pinNames) {
    const hole = /^([a-j])([1-9]\d*)$/.exec(pinName);
    const rail = /^(rail_(?:top|bottom)_(?:pos|neg))_([1-9]\d*)$/.exec(pinName);
    const group = hole
      ? `${hole[1] <= "e" ? "left" : "right"}:${hole[2]}`
      : rail?.[1];
    if (!group) continue;
    const pins = groups.get(group) ?? [];
    pins.push(pinName);
    groups.set(group, pins);
  }
  return [...groups.values()].flatMap((pins) =>
    pins.slice(1).map((pin): [string, string] => [pins[0], pin]),
  );
}
