import { expect, it } from "vitest";
import { createIdAllocator, type ComponentSpec, type CircuitGraph } from "../src/core";
import { addComponent, connectPins, removeComponent, rotateComponent, moveComponent, serializeCircuit, deserializeCircuit, pinPosition, orthogonalPath, missingGhostWires } from "../src/modules/circuit";
const spec: ComponentSpec = {specId:"led",category:"actuator",nameKey:"led",supplyVoltageV:5,maxVoltageV:5,svgPath:"",modelPath:"",behaviorKind:"led",svgSize:{width:100,height:100},pins:[
 {pinName:"ANODE",pinType:"passive",svgPosition:{x:10,y:20},labelKey:"ANODE"},{pinName:"CATHODE",pinType:"passive",svgPosition:{x:90,y:80},labelKey:"CATHODE"}]};
const empty: CircuitGraph={componentInstances:[],wires:[]};
it("edits immutably and never reuses deleted IDs",()=>{
 const ids=createIdAllocator();let graph=addComponent(empty,spec,{x:101,y:201},ids);
 const first=graph.componentInstances[0].instanceId;
 graph=moveComponent(graph,first,{x:121,y:201});expect(graph.componentInstances[0].circuitPosition).toEqual({x:120,y:200});
 graph=rotateComponent(graph,first);expect(graph.componentInstances[0].rotationDeg).toBe(90);
 graph=connectPins(graph,[spec],`${first}/ANODE`,`${first}/CATHODE`,"#006edb",ids);
 expect(connectPins(graph,[spec],`${first}/CATHODE`,`${first}/ANODE`,"#006edb",ids)).toBe(graph);
 const copy=serializeCircuit(graph,[spec]);expect(deserializeCircuit(copy,[spec])).toEqual(graph);
 graph=removeComponent(graph,first);expect(graph.wires).toEqual([]);
 graph=addComponent(graph,spec,{x:0,y:0},ids);expect(graph.componentInstances[0].instanceId).not.toBe(first);
 expect(empty).toEqual({componentInstances:[],wires:[]});
});
it("rejects invalid saved circuits without changing current data",()=>{
 const graph=addComponent(empty,spec,{x:0,y:0},createIdAllocator());const before=JSON.stringify(graph);
 expect(()=>deserializeCircuit('{"version":99,"graph":{}}',[spec])).toThrow();
 const saved=JSON.parse(serializeCircuit(graph,[spec]));saved.graph.wires=[{wireId:"wire:1",fromPin:"missing:1/X",toPin:"led:1/ANODE",colorHex:"#006edb"}];
 expect(()=>deserializeCircuit(JSON.stringify(saved),[spec])).toThrow();
 expect(()=>moveComponent(graph,"led:1",{x:NaN,y:2})).toThrow();expect(JSON.stringify(graph)).toBe(before);
});
it("rotates pin geometry and routes orthogonal wires",()=>{
 const instance={instanceId:"led:1",specId:"led",circuitPosition:{x:100,y:200},rotationDeg:90};
 expect(pinPosition(instance,spec,"ANODE")).toEqual({x:180,y:210});
 expect(orthogonalPath({x:0,y:0},{x:100,y:80})).toBe("M 0 0 H 50 V 80 H 100");
 const expected=[{wireId:"wire:2",fromPin:"led:1/ANODE",toPin:"led:2/ANODE",colorHex:"#006edb"}];
 expect(missingGhostWires([{...expected[0],fromPin:expected[0].toPin,toPin:expected[0].fromPin}],expected)).toEqual([]);
});
