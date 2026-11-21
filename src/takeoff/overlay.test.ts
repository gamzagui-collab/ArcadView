import {afterEach,expect,it,vi} from "vitest";
import {newTakeoff,type TakeoffObject} from "./model";
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
