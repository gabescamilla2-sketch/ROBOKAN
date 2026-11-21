import type { IdSequence } from "./contract";
export function createIdAllocator(
  componentIds: readonly string[] = [],
  wireIds: readonly string[] = [],
  saved?: IdSequence,
) {
  const maximum = (ids: readonly string[]) =>
    Math.max(0, ...ids.map((id) => Number(/:(\d+)$/.exec(id)?.[1] ?? 0)));
  let component = Math.max(maximum(componentIds) + 1, saved?.component ?? 1);
  let wire = Math.max(maximum(wireIds) + 1, saved?.wire ?? 1);
  return {
    createComponentId(specId: string) {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(specId))
        throw new Error("Invalid component spec ID");
      return `${specId}:${component++}`;
    },
    createWireId: () => `wire:${wire++}`,
    snapshot: (): IdSequence => ({ component, wire }),
  };
}
