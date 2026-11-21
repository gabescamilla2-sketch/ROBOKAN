import { describe, expect, it } from "vitest";
import { parseProgramFile } from "../src/modules/blocks/program-file";

describe("program files", () => {
  it("preserves serialized blocks, fields and connections", () => {
    const workspace = { blocks: { languageVersion: 0, blocks: [{ type: "robokan_wait", fields: { SECONDS: 5 }, next: { block: { type: "robokan_digital_write", fields: { PIN: "D3", VALUE: "1" } } } }] } };
    expect(parseProgramFile(JSON.stringify({ version: 1, workspace }))).toEqual(workspace);
    expect(parseProgramFile('{"version":1,"workspace":{}}')).toEqual({});
  });
  it("rejects malformed, incompatible and unknown program structures", () => {
    for (const source of ["{", "null", '{"version":2,"workspace":{}}', '{"version":1,"workspace":[]}', '{"version":1,"workspace":{"variables":[]}}', '{"version":1,"workspace":{"blocks":{"blocks":[{"type":"unknown"}]}}}', " ".repeat(1000001)]) {
      expect(() => parseProgramFile(source)).toThrow();
    }
  });
});
