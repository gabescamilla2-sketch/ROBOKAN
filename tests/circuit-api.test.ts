import { describe, expect, it } from "vitest";
import { evaluate, createCircuitApi, buildNetlist } from "../src/modules/circuit";
import type { ComponentSpec, CircuitGraph, PinDrives } from "../src/core";
const spec = (specId: string, category: ComponentSpec["category"], pinTypes: [string,string][]): ComponentSpec => ({
  specId, category, nameKey: specId, supplyVoltageV: 5, maxVoltageV: 5, svgPath: "", modelPath: "", behaviorKind: specId,
  pins: pinTypes.map(([pinName,pinType],i) => ({ pinName, pinType: pinType as never, labelKey:pinName, svgPosition:{x:i*20,y:0} })),
});
const board = spec("arduino-uno", "board", [["5V","power"],["GND_1","ground"],["D9","digital_out"],["D10","digital_in"]]);
const sensor = spec("hc-sr04", "sensor", [["VCC","power"],["GND","ground"],["TRIG","digital_in"],["ECHO","digital_out"]]);
const graph = (wires: [string,string][]): CircuitGraph => ({
 componentInstances: [board,sensor].map(s => ({instanceId:s.specId+":1",specId:s.specId,circuitPosition:{x:0,y:0},rotationDeg:0})),
 wires: wires.map(([fromPin,toPin],i)=>({wireId:`wire:${i+1}`,fromPin,toPin,colorHex:"#006edb"})),
});
const powered: [string,string][] = [["arduino-uno:1/5V","hc-sr04:1/VCC"],["arduino-uno:1/GND_1","hc-sr04:1/GND"],["arduino-uno:1/D9","hc-sr04:1/TRIG"]];
describe("runtime circuit API", () => {
 it("keeps floating outputs distinct from driven LOW and HIGH", () => {
  const current = graph(powered); let drives: PinDrives = {};
  const api = createCircuitApi({getGraph:()=>current,getSpecs:()=>[board,sensor],getBoardInstanceId:()=>"arduino-uno:1",getDrives:()=>drives});
  expect(api.resolvePin("D9").signalKind).toBe("floating");
  drives = {"arduino-uno:1/D9":{signalKind:"digital",voltageV:0,digitalValue:0}};
  expect(api.resolvePin("D9")).toMatchObject({signalKind:"digital",digitalValue:0,voltageV:0});
  drives = {"arduino-uno:1/D9":{signalKind:"digital",voltageV:5,digitalValue:1}};
  expect(api.evaluate().signalByPin["hc-sr04:1/TRIG"]).toMatchObject({digitalValue:1,voltageV:5});
  expect(api.connections("D9")).toContain("hc-sr04:1/TRIG");
  expect(()=>api.resolvePin("D99")).toThrow();
 });
 it("does not let an unpowered sensor drive a signal", () => {
  const current = graph([["hc-sr04:1/ECHO","arduino-uno:1/D10"]]);
  const result=evaluate(current,[board,sensor],{"hc-sr04:1/ECHO":{signalKind:"digital",voltageV:5,digitalValue:1}});
  expect(result.statusByInstance["hc-sr04:1"]).toBe("unpowered");
  expect(result.signalByPin["arduino-uno:1/D10"].signalKind).toBe("floating");
 });
 it("propagates board power but rejects malformed signal values", () => {
  const result=evaluate(graph(powered),[board,sensor]);
  expect(result.signalByPin["hc-sr04:1/VCC"].voltageV).toBe(5);
  expect(result.statusByInstance["hc-sr04:1"]).toBe("ok");
  expect(()=>evaluate(graph(powered),[board,sensor],{"arduino-uno:1/D9":{signalKind:"digital",voltageV:NaN,digitalValue:1}})).toThrow();
 });
 it("connects breadboard banks and rails without crossing their isolation", () => {
  const pins=["a1","b1","e1","f1","j1","a2","rail_top_pos_1","rail_top_pos_2","rail_top_neg_1"];
  const current={componentInstances:[{instanceId:"breadboard:1",specId:"breadboard"}],wires:[]};
  const result=buildNetlist(current,{breadboard:pins});
  const net=(name:string)=>result.nets.find(n=>n.pinRefs.includes(`breadboard:1/${name}`))!.netId;
  expect(net("a1")).toBe(net("e1")); expect(net("f1")).toBe(net("j1"));
  expect(net("a1")).not.toBe(net("f1")); expect(net("a1")).not.toBe(net("a2"));
  expect(net("rail_top_pos_1")).toBe(net("rail_top_pos_2"));
  expect(net("rail_top_pos_1")).not.toBe(net("rail_top_neg_1"));
 });
});
