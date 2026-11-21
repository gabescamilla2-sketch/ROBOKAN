import type { Point, Wire } from "../../core";
export const wireKey=(fromPin:string,toPin:string)=>[fromPin,toPin].sort().join("|");
export function orthogonalPath(from:Point,to:Point):string {
  const middle=Math.round((from.x+to.x)/2);return `M ${from.x} ${from.y} H ${middle} V ${to.y} H ${to.x}`;
}
export function missingGhostWires(wires:readonly Wire[],expected:readonly Wire[]):Wire[]{
  const connected=new Set(wires.map(wire=>wireKey(wire.fromPin,wire.toPin)));
  return expected.filter(wire=>!connected.has(wireKey(wire.fromPin,wire.toPin)));
}
