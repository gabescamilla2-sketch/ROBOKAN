import type { ComponentInstance, ComponentSpec, CircuitGraph, Point } from "../../core";
import { parsePinRef } from "./netlist";
export function componentSize(spec: ComponentSpec) {
  return spec.svgSize ?? {width:Math.max(140,...spec.pins.map(pin=>pin.svgPosition.x+24)),height:Math.max(100,...spec.pins.map(pin=>pin.svgPosition.y+24))};
}
export function pinPosition(instance: ComponentInstance, spec: ComponentSpec, pinName: string): Point {
  const pin=spec.pins.find(pin=>pin.pinName===pinName); if(!pin) throw new Error("Unknown pin");
  const size=componentSize(spec); const angle=instance.rotationDeg*Math.PI/180;
  const x=pin.svgPosition.x-size.width/2,y=pin.svgPosition.y-size.height/2;
  return {x:Math.round(instance.circuitPosition.x+size.width/2+x*Math.cos(angle)-y*Math.sin(angle)),y:Math.round(instance.circuitPosition.y+size.height/2+x*Math.sin(angle)+y*Math.cos(angle))};
}
export function resolvePinPosition(pinRef:string,graph:CircuitGraph,specs:readonly ComponentSpec[]):Point {
  const address=parsePinRef(pinRef);const instance=graph.componentInstances.find(instance=>instance.instanceId===address?.instanceId);
  const spec=specs.find(spec=>spec.specId===instance?.specId);
  if(!address||!instance||!spec)throw new Error("Unknown pin reference");return pinPosition(instance,spec,address.pinName);
}
export function hitTestPin(point:Point,graph:CircuitGraph,specs:readonly ComponentSpec[],radius=12):string|undefined {
  let best=radius,ref:string|undefined;
  for(const instance of graph.componentInstances){const spec=specs.find(spec=>spec.specId===instance.specId);if(!spec)continue;
    for(const pin of spec.pins){const position=pinPosition(instance,spec,pin.pinName);const distance=Math.hypot(point.x-position.x,point.y-position.y);
      if(distance<=best){best=distance;ref=`${instance.instanceId}/${pin.pinName}`;}}
  }return ref;
}
