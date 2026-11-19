import{expect,it}from"vitest";
import{DxfScene}from"dxf-viewer/src/DxfScene.js";
import{buildMeasurementGeometry,nearestSnap,type MeasurementDxf}from"./measurementGeometry";
import{nearestPackedSnap,measurementBuffers}from"./packedMeasurement";
import{perpendicularSnap}from"./cadPicking";
import{referenceDirections}from"./rightAngles";
import{installHatchSplineCompatibility}from"./hatchSpline";
const hatch=(x=0,y=0)=>({type:"HATCH",boundaryLoops:[{type:3,isExternal:true,polyline:{vertices:[{x,y},{x:x+100,y},{x:x+100,y:y+60},{x,y:y+60}],isClosed:true}}]});
const find=(g:ReturnType<typeof buildMeasurementGeometry>,p:{x:number;y:number},r=.01)=>g.packed?nearestPackedSnap(g.packed,p,r):nearestSnap(g.snaps,p,r);
it("snaps to hatch boundary vertices and midpoints, including perpendiculars, without creating false object lengths",()=>{
 for(const packed of[false,true]){
  const g=buildMeasurementGeometry({entities:[hatch()]}as MeasurementDxf,{},undefined,packed);
  expect(find(g,{x:100,y:0})).toEqual({x:100,y:0,kind:"endpoint"});expect(find(g,{x:50,y:0})).toEqual({x:50,y:0,kind:"midpoint"});
  expect(perpendicularSnap(g,{x:30,y:-30},{x:30.1,y:.1},1)).toEqual({x:30,y:0});
  expect(referenceDirections(g,{x:30,y:0},.1)).toHaveLength(1);
  expect(g.entities).toHaveLength(0);expect(g.packed?.entityCount??0).toBe(0);expect(g.snapLimited).toBe(false);
 }
});
it("transforms hatch features and insertion points through scaled, rotated, nested and mirrored blocks",()=>{
 const d:MeasurementDxf={entities:[{type:"INSERT",name:"P",position:{x:100,y:200},rotation:90,xScale:2,yScale:3}],blocks:{P:{position:{x:10,y:20},entities:[{type:"INSERT",name:"C",position:{x:10,y:20}}]},C:{entities:[hatch()]}}}as any;
 const g=buildMeasurementGeometry(d,{},undefined,true);
 expect(find(g,{x:100,y:200})).not.toBeNull();expect(find(g,{x:100,y:400})?.kind).toBe("endpoint");expect(find(g,{x:-80,y:300})?.kind).toBe("midpoint");
 const origin=buildMeasurementGeometry({entities:[{type:"INSERT",name:"B",position:{x:100,y:200}}],blocks:{B:{entities:[hatch(10,10)]}}}as any,{},undefined,true);expect(find(origin,{x:100,y:200})?.kind).toBe("insertion");
 const mirrored=buildMeasurementGeometry({entities:[{type:"INSERT",name:"B",position:{x:100,y:200},xScale:-2,yScale:1}],blocks:{B:{entities:[hatch()]}}}as any);
 expect(find(mirrored,{x:-100,y:200})?.kind).toBe("endpoint");
});
it("honours layer visibility, nested XCLIP and partial straight boundaries",()=>{
 const d:MeasurementDxf={entities:[{type:"INSERT",name:"B",position:{x:0,y:0},xdata:{IZCAD_XCLIP:{values:[{code:1000,value:"0,0;50,60"}]}}}],blocks:{B:{entities:[hatch(-20,0)]}}}as any;
 const g=buildMeasurementGeometry(d,{},undefined,true);expect(find(g,{x:-20,y:0})).toBeNull();expect(find(g,{x:80,y:60})).toBeNull();
 expect(perpendicularSnap(g,{x:25,y:30},{x:25,y:0},.1)).toEqual({x:25,y:0});expect(perpendicularSnap(g,{x:70,y:30},{x:70,y:0},.1)).toBeNull();
 const hidden=buildMeasurementGeometry({entities:[{...hatch(),layer:"HIDDEN"}],tables:{layer:{layers:{HIDDEN:{visible:false}}}}}as any);expect(hidden.snaps).toHaveLength(0);
 const concave=buildMeasurementGeometry({entities:[{type:"INSERT",name:"B",position:{x:0,y:0},xdata:{IZCAD_XCLIP:{values:[{code:1000,value:"0,0;4,0;4,4;3,4;3,1;1,1;1,4;0,4"}]}}}],blocks:{B:{entities:[{type:"LINE",vertices:[{x:.5,y:3},{x:3.5,y:3}]}]}}}as any,{},undefined,true);
 expect(perpendicularSnap(concave,{x:2,y:4},{x:2,y:3},.1)).toBeNull();expect(perpendicularSnap(concave,{x:.8,y:4},{x:.8,y:3},.1)).toEqual({x:.8,y:3});
});
it("filters hatch islands by the same normal/outer/ignore styles as rendering",()=>{
 const outer=hatch().boundaryLoops[0],hole={...hatch(20,20).boundaryLoops[0],isExternal:false,isOutermost:false};
 const normal=buildMeasurementGeometry({entities:[{type:"HATCH",hatchStyle:0,boundaryLoops:[outer,hole]}]}as any);expect(find(normal,{x:20,y:20})).not.toBeNull();
 const ignored=buildMeasurementGeometry({entities:[{type:"HATCH",hatchStyle:2,boundaryLoops:[hole,outer]}]}as any);expect(find(ignored,{x:20,y:20})).toBeNull();
 const outermost=buildMeasurementGeometry({entities:[{type:"HATCH",hatchStyle:1,boundaryLoops:[outer,hole]}]}as any);expect(find(outermost,{x:20,y:20})).toBeNull();
});
it("extracts bulged boundary arc centres and matches rendered clockwise arc and ellipse endpoints",()=>{
 const g=buildMeasurementGeometry({entities:[{type:"HATCH",boundaryLoops:[{polyline:{vertices:[{x:-1,y:0,bulge:1},{x:1,y:0},{x:0,y:2}]}}]}]}as any);
 expect(g.snaps.some(p=>p.kind==="center"&&Math.hypot(p.x,p.y)<1e-8)).toBe(true);expect(find(g,{x:0,y:-1})?.kind).toBe("midpoint");
 const scene:any=new DxfScene();scene.angBase=.1;
 for(const type of[2,3])for(const ccw of[true,false]){
  const edge={type,start:{x:10,y:20},end:{x:3,y:4},radius:type===2?10:.5,startAngle:.2,endAngle:1.4,isCcw:ccw};
  const geometry=buildMeasurementGeometry({header:{$ANGBASE:.1},entities:[{type:"HATCH",boundaryLoops:[{edges:[edge]}]}]}as any);
  const vertices:any[]=[];scene._GenerateArcVertices({vertices,center:edge.start,radius:type===2?10:5,yRadius:type===2?10:2.5,startAngle:.2,endAngle:1.4,ccwAngleDir:ccw});
  if(type===3){const c=.6,s=.8;for(const p of vertices){const x=p.x-10,y=p.y-20;p.x=10+c*x-s*y;p.y=20+s*x+c*y;}}
  expect(find(geometry,vertices[0])?.kind).toBe("endpoint");expect(find(geometry,vertices.at(-1))?.kind).toBe("endpoint");
 }
});
it("uses the renderer's recovered rational spline endpoint interpolation rather than control points",()=>{
 installHatchSplineCompatibility(DxfScene);const scene:any=new DxfScene();
 const h={type:"HATCH",boundaryLoops:[{type:0,edges:[{type:4,rational:true,degreeOfSplineCurve:2,controlPoints:[{x:0,y:0},{x:1,y:2},{x:2,y:0}],knotValues:[0,0,0,1,1,1,1,2,1]}]}]};
 scene._GetHatchBoundaryLoops(h);
 const g=buildMeasurementGeometry({entities:[h]}as any,{},undefined,true,scene._InterpolateSpline.bind(scene));
 expect(find(g,{x:0,y:0})?.kind).toBe("endpoint");expect(find(g,{x:2,y:0})?.kind).toBe("endpoint");expect(find(g,{x:1,y:2})).toBeNull();expect(g.snapLimited).toBe(false);
});
it("keeps measurement indexing intact when supplementary snap budgets are reached and transfers extra buffers",()=>{
 const plain=buildMeasurementGeometry({entities:[hatch(),{type:"LINE",vertices:[{x:200,y:0},{x:300,y:0}]}]}as any,{maxSupplementalSnaps:1,maxSnaps:3,maxSnapSegments:1});expect(plain.limited).toBe(false);expect(plain.snapLimited).toBe(true);expect(plain.entities).toHaveLength(1);
 const g=buildMeasurementGeometry({entities:[hatch(),{type:"LINE",vertices:[{x:200,y:0},{x:300,y:0}]}]}as any,{maxSupplementalSnaps:1,maxSnapSegments:1},undefined,true);
 expect(g.limited).toBe(false);expect(g.snapLimited).toBe(true);expect(g.packed!.entityCount).toBe(1);expect(g.packed!.extraSnapCount).toBe(1);expect(find(g,{x:300,y:0})?.kind).toBe("endpoint");
 const p=g.packed!;expect(measurementBuffers(p)).toContain(p.extraSnaps![0].buffer);expect(measurementBuffers(p)).toContain(p.snapSegments![0].buffer);
});
it("adds solid/face block vertices and only the MINSERT instance drawn by the pinned renderer",()=>{
 const g=buildMeasurementGeometry({entities:[{type:"INSERT",name:"B",position:{x:10,y:20},columnCount:3,columnSpacing:1000}],blocks:{B:{entities:[{type:"SOLID",points:[{x:0,y:0},{x:100,y:0},{x:0,y:100},{x:100,y:100}]}]}}}as any,{},undefined,true);
 expect(find(g,{x:10,y:20})).not.toBeNull();expect(find(g,{x:110,y:120})?.kind).toBe("endpoint");expect(find(g,{x:60,y:120})?.kind).toBe("midpoint");expect(find(g,{x:1010,y:20})).toBeNull();
});
it("ignores the parser's fifth face sentinel and snaps to the rendered boundary rather than its diagonals",()=>{
 const g=buildMeasurementGeometry({entities:[{type:"3DFACE",vertices:[{x:0,y:0},{x:100,y:0},{x:0,y:100},{x:100,y:100},{}]}]}as any,{},undefined,true);
 expect(g.snapLimited).toBe(false);expect(find(g,{x:50,y:100})?.kind).toBe("midpoint");expect(find(g,{x:0,y:50})?.kind).toBe("midpoint");expect(find(g,{x:50,y:50})).toBeNull();
});
