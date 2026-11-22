import {afterEach,expect,it,vi} from "vitest";
import {newTakeoff,totals,validateDocument,type TakeoffObject} from "./model";
import {drawTakeoff} from "./overlay";

class Element {
 attributes:Record<string,string>={};children:Element[]=[];textContent="";
 setAttribute(name:string,value:string){this.attributes[name]=value;}
 append(child:Element){this.children.push(child);}
}
afterEach(()=>vi.unstubAllGlobals());

it("pans between separated objects without leaving empty label hit targets, and restores labels on return",()=>{
 vi.stubGlobal("document",{createElementNS:()=>new Element()});
 const path=(id:string,x:number,y:number):TakeoffObject=>({id,layerId:"takeoff-default",groupId:"wall",kind:"wall",geometry:{type:"path",points:[{x,y},{x:x+120,y}]},dimensions:{heightMm:3000,thicknessMm:200},label:{visible:true}});
 const doc={...newTakeoff({key:"v1-"+"a".repeat(64),name:"site.dwg",size:1,lastModified:0},"mm"),objects:[path("near",100,300),path("far",10000,10000)]};
 let nodes:Element[]=[];
 const svg={clientWidth:360,clientHeight:616,replaceChildren:(...children:Element[])=>{nodes=children;}}as unknown as SVGSVGElement;
 const labels=()=>nodes.filter(e=>"data-takeoff-label"in e.attributes);
 const check=(id:string)=>{expect(labels().map(e=>e.attributes["data-takeoff-label"])).toEqual([id]);expect(labels().every(e=>e.children.some(c=>"rx"in c.attributes))).toBe(true);};
 drawTakeoff(svg,doc,"near",null,p=>p.map(v=>({...v})),true);check("near");
 drawTakeoff(svg,doc,"far",null,p=>p.map(v=>({x:v.x-9900,y:v.y-9900})),true);check("far");
 drawTakeoff(svg,doc,null,null,p=>p.map(v=>({...v})),false);check("near");
 expect(doc.objects[0].geometry.points[0]).toEqual({x:100,y:300});
});

function labelFixture(){
 vi.stubGlobal("document",{createElementNS:()=>new Element()});
 const doc=newTakeoff({key:"v1-"+"b".repeat(64),name:"labels.dwg",size:1,lastModified:0},"mm");
 doc.objects=[{id:"wall-visible",layerId:doc.activeLayerId,groupId:"wall",kind:"wall",geometry:{type:"path",points:[{x:0,y:0},{x:20000,y:0}]},dimensions:{heightMm:3000,thicknessMm:200},label:{visible:true}}];
 let nodes:Element[]=[];const svg={clientWidth:360,clientHeight:616,replaceChildren:(...children:Element[])=>{nodes=children;}}as unknown as SVGSVGElement;
 const draw=()=>drawTakeoff(svg,doc,null,null,p=>p.map(v=>({x:100+v.x*.005,y:300-v.y*.005})),false);
 return{doc,draw,nodes:()=>nodes,labels:()=>nodes.filter(e=>"data-takeoff-label"in e.attributes)};
}
it("shows volume in one small line while keeping full calculation details available",()=>{
 const f=labelFixture();f.draw();const label=f.labels()[0],box=label.children.find(e=>"rx"in e.attributes)!;
 expect(+box.attributes.width).toBeLessThanOrEqual(80);expect(+box.attributes.height).toBe(22);
 const text=label.children.filter(e=>"font-size"in e.attributes);expect(text).toHaveLength(1);expect(text[0].textContent).toBe("12.000 m³");expect(text[0].attributes["font-size"]).toBe("10");
 expect(label.children.find(e=>e.textContent.includes("길이 20 m × 높이 3 m × 두께 0.2 m"))?.textContent).toContain("12.000 m³");
});
it("toggles only label graphics, preserving geometry, totals and individual visibility; old documents default to shown",()=>{
 const f=labelFixture();f.doc.objects.push({...f.doc.objects[0],id:"individually-hidden",label:{visible:false}});delete f.doc.options.labelsVisible;validateDocument(f.doc);f.draw();expect(f.labels()).toHaveLength(1);
 const geometry=()=>JSON.stringify(f.nodes().filter(e=>"data-takeoff"in e.attributes));const original=geometry(),objects=JSON.stringify(f.doc.objects),total=totals(f.doc);
 f.doc.options.labelsVisible=false;f.draw();expect(f.labels()).toHaveLength(0);expect(geometry()).toBe(original);expect(totals(f.doc)).toEqual(total);expect(JSON.stringify(f.doc.objects)).toBe(objects);
 f.doc.options.labelsVisible=true;f.draw();expect(f.labels()).toHaveLength(1);expect(f.labels()[0].attributes["data-takeoff-label"]).toBe("wall-visible");
 expect(()=>validateDocument({...f.doc,options:{...f.doc.options,labelsVisible:"false"}})).toThrow();
});

it("draws an area-mode wall as a filled closed polygon with an m² label and no height/thickness formula",()=>{
 const f=labelFixture(),o=f.doc.objects[0];f.doc.objects=[{...o,calculation:"area",geometry:{type:"polygon",points:[{x:0,y:0},{x:8000,y:0},{x:8000,y:5000},{x:0,y:5000}]},dimensions:{}}];f.draw();expect(f.nodes().some(n=>n.attributes.class==="takeoff-area-fill")).toBe(true);const label=f.labels()[0];expect(label.children.some(n=>n.textContent==="40.000 m²")).toBe(true);expect(label.children.map(n=>n.textContent).join(" ")).not.toContain("m³");
});
