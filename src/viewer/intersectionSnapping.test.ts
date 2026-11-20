import {expect,it} from "vitest";
import {buildMeasurementGeometry} from "./measurementGeometry";
import {annotationGeometry,type Annotation} from "./annotations";
import {intersectionSnap} from "./intersectionSnapping";
const line=(id:string,points:Annotation["points"]):Annotation=>({id,layerId:"base",kind:"polyline",points});
it("snaps a selected overlay crossing an original packed/unpacked line away from their endpoints",()=>{
 for(const packed of[false,true]){
  const cad=buildMeasurementGeometry({entities:[{type:"LINE",vertices:[{x:1e9,y:1e9},{x:1e9+1000,y:1e9}]}]}as any,{},undefined,packed);
  const own=annotationGeometry([line("a",[{x:1e9+300,y:1e9-100},{x:1e9+300,y:1e9+100}])]);
  const target={x:1e9+301,y:1e9+2};
  expect(intersectionSnap([cad,own],target,5)).toEqual({x:1e9+300,y:1e9});
  expect(intersectionSnap([cad,own],target,5,()=>false)).toBeNull();
 }
});
it("snaps exact line/circle and circle/circle crossings rather than sampled chords",()=>{
 const circle:Annotation={id:"c",layerId:"base",kind:"circle",points:[{x:0,y:0},{x:50,y:0}]};
 const own=annotationGeometry([circle,line("l",[{x:-100,y:30},{x:100,y:30}])]);
 expect(intersectionSnap([own],{x:41,y:31},4)).toEqual({x:40,y:30});
 const pair=annotationGeometry([circle,{...circle,id:"d",points:[{x:60,y:0},{x:110,y:0}]}]);
 expect(intersectionSnap([pair],{x:31,y:41},4)).toEqual({x:30,y:40});
});
it("uses supplemental block and hatch edges as intersection snapping candidates",()=>{
 const g=annotationGeometry([]);g.snapSegments=[[{x:-100,y:0},{x:100,y:0}],[{x:0,y:-100},{x:0,y:100}]];
 expect(intersectionSnap([g],{x:2,y:1},4)).toEqual({x:0,y:0});
 expect(intersectionSnap([g],{x:15,y:1},4)).toBeNull();
});
it("respects arc sweep and does not snap to extended line intersections",()=>{
 const arc:Annotation={id:"a",layerId:"base",kind:"arc",points:[{x:0,y:0},{x:50,y:0}],start:0,sweep:Math.PI/2};
 const g=annotationGeometry([arc,line("l",[{x:-100,y:30},{x:100,y:30}])]);
 expect(intersectionSnap([g],{x:40,y:30},3)?.x).toBeCloseTo(40);
 expect(intersectionSnap([g],{x:-40,y:30},3)).toBeNull();
 expect(intersectionSnap([annotationGeometry([line("1",[{x:0,y:0},{x:10,y:0}]),line("2",[{x:20,y:-10},{x:20,y:10}])])],{x:20,y:0},15)).toBeNull();
});
