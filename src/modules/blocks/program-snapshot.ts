// Editing permissions change during execution without changing the program.
export function programSnapshot(state: object): string {
  return JSON.stringify(state, (key, value) => {
    if (["editable", "movable", "deletable"].includes(key)) return undefined;
    return value;
  });
}
