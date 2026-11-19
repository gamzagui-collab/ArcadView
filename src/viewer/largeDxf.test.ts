import {expect,it} from "vitest";
import DxfParser from "dxf-viewer/src/parser/DxfParser.js";
import {dxfLines} from "./largeDxf";

it("matches indexed split lines, including CRLF at chunk boundaries, empty tails and distant rewinds",()=>{
 const text=Array.from({length:1300},(_,i)=>`한글 긴 텍스트 ${i}`).join("\r\n")+"\r\n";
 const chunks=Array.from({length:Math.ceil(text.length/17)},(_,i)=>text.slice(i*17,i*17+17));
 const lines=dxfLines(chunks) as Record<number,string>&{length:number},expected=text.split(/\r\n|\r|\n/g);
 for(let i=0;i<expected.length;i++){expect(lines.length).toBeGreaterThan(i);expect(lines[i]).toBe(expected[i]);}
 expect(lines.length).toBe(expected.length);expect(lines[0]).toBe(expected[0]);expect(lines[578]).toBe(expected[578]);
 expect(lines[expected.length]).toBeUndefined();
});
it.each(["\n","\r\n","\r"])("keeps all parsed entity values and block contents identical for %j",eol=>{
 const entities=Array.from({length:700},(_,i)=>`0\nLINE\n8\n한글 레이어\n10\n${i}\n20\n5\n11\n${i+20}\n21\n40\n`).join("");
 const text=("0\nSECTION\n2\nENTITIES\n"+entities+"0\nENDSEC\n0\nEOF\n").replaceAll("\n",eol);
 const parser=new DxfParser() as unknown as {_parse(source:unknown):unknown;parseSync(source:string):unknown};
 const chunks=Array.from({length:Math.ceil(text.length/67)},(_,i)=>text.slice(i*67,i*67+67));
 expect(parser._parse({split:()=>dxfLines(chunks)})).toEqual(parser.parseSync(text));
});
it("reports truncated CAD input instead of accepting missing values",()=>{
 const parser=new DxfParser() as unknown as {_parse(source:unknown):unknown};
 expect(()=>parser._parse({split:()=>dxfLines(["0\nSECTION\n2\nENTITIES\n0\nLINE\n10"])})).toThrow();
});
