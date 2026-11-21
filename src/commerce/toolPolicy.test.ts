import {it,expect} from "vitest";
import {isUnmeteredTool,measurementToolId} from "./toolPolicy";
it("aligned and linear measurement have different stable billing IDs",()=>{
  expect(measurementToolId("distance")).toBe("measure.aligned");expect(measurementToolId("linear")).toBe("measure.linear");
  expect(isUnmeteredTool(measurementToolId("distance"))).toBe(true);
  for(const mode of ["linear","path","area","radius","angle","object"]as const)expect(isUnmeteredTool(measurementToolId(mode))).toBe(false);
});
