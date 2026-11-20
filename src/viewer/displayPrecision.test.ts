import{afterEach,expect,it,vi}from"vitest";
import{formatCadNumber,readPrecision,savePrecision}from"./displayPrecision";
import{convertMeasurement}from"./measurementGeometry";
afterEach(()=>vi.unstubAllGlobals());
it("formats 0–6 selected decimal places without changing the underlying distance",()=>{
 const value=123.4567891;expect(formatCadNumber(value,0,"en")).toBe("123");expect(formatCadNumber(value,2,"en")).toBe("123.46");expect(formatCadNumber(value,6,"en")).toBe("123.456789");expect(value).toBe(123.4567891);
 expect(formatCadNumber(12,3,"en")).toBe("12");expect(formatCadNumber(-.00001,2,"en")).toBe("0");
});
it("applies the same formatting to converted lengths, areas and angles",()=>{
 expect(formatCadNumber(convertMeasurement(1234.567,"mm","m"),2,"en")).toBe("1.23");
 expect(formatCadNumber(convertMeasurement(1234567,"mm","m",true),3,"en")).toBe("1.235");expect(formatCadNumber(89.9876,1,"en")).toBe("90");expect(formatCadNumber(12.5,2,"tr")).toBe("12,5");
});
it("remembers the choice, preserves the previous three-place default and rejects invalid preferences",()=>{
 const values=new Map<string,string>();vi.stubGlobal("localStorage",{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});
 expect(readPrecision()).toBe(3);expect(savePrecision(5)).toBe(true);expect(readPrecision()).toBe(5);expect(savePrecision(7)).toBe(false);expect(savePrecision(2.5)).toBe(false);expect(readPrecision()).toBe(5);
 values.set("arcad.display.precision.v1","broken");expect(readPrecision()).toBe(3);vi.stubGlobal("localStorage",{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});expect(readPrecision()).toBe(3);expect(savePrecision(2)).toBe(false);
});
