import {afterEach,beforeEach,expect,it,vi} from "vitest";
const mocked=vi.hoisted(()=>({platform:"android",save:vi.fn()}));
vi.mock("@capacitor/core",()=>({Capacitor:{getPlatform:()=>mocked.platform},registerPlugin:()=>({save:mocked.save})}));
import {saveTakeoffWorkbook,XLSX_MIME} from "./takeoffExport";
beforeEach(()=>{mocked.platform="android";mocked.save.mockReset();});afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();vi.useRealTimers();});
it("preserves binary XLSX bytes when bridging to Android and distinguishes confirmed save from cancellation",async()=>{
 const bytes=new Uint8Array([80,75,3,4,0,255,128]);mocked.save.mockResolvedValueOnce({cancelled:false}).mockResolvedValueOnce({cancelled:true});expect(await saveTakeoffWorkbook("현장.xlsx",bytes)).toBe("saved");const payload=mocked.save.mock.calls[0][0];expect(payload.name).toBe("현장.xlsx");expect(new Uint8Array(Buffer.from(payload.data,"base64"))).toEqual(bytes);expect(await saveTakeoffWorkbook("현장.xlsx",bytes)).toBe("cancelled");
});
it("propagates save failures instead of reporting success",async()=>{mocked.save.mockRejectedValue(Error("disk full"));await expect(saveTakeoffWorkbook("현장.xlsx",new Uint8Array([80,75,3,4]))).rejects.toThrow("disk full");});
it("rejects oversized generated exports before the native bridge is called",async()=>{await expect(saveTakeoffWorkbook("현장.xlsx",new Uint8Array(16*1024*1024+1))).rejects.toThrow("16MB");expect(mocked.save).not.toHaveBeenCalled();});
it("uses a real XLSX Blob/download name on the web and releases the object URL",async()=>{
 mocked.platform="web";vi.useFakeTimers();const a={href:"",download:"",click:vi.fn(),remove:vi.fn()},append=vi.fn();vi.stubGlobal("document",{createElement:()=>a,body:{append}});const create=vi.spyOn(URL,"createObjectURL").mockReturnValue("blob:export"),revoke=vi.spyOn(URL,"revokeObjectURL").mockImplementation(()=>{});expect(await saveTakeoffWorkbook("현장.xlsx",new Uint8Array([80,75,3,4]))).toBe("download");expect((create.mock.calls[0][0] as Blob).type).toBe(XLSX_MIME);expect(a.download).toBe("현장.xlsx");expect(a.click).toHaveBeenCalledOnce();expect(a.remove).toHaveBeenCalledOnce();expect(revoke).not.toHaveBeenCalled();vi.advanceTimersByTime(60000);expect(revoke).toHaveBeenCalledWith("blob:export");expect(mocked.save).not.toHaveBeenCalled();
});
