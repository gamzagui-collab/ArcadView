import {expect,it} from "vitest";
import {createMoveSnap} from "./moveSnapping";
import {annotationGeometry,translateAnnotation,type Annotation} from "./annotations";
import {buildMeasurementGeometry,distance} from "./measurementGeometry";
import {resizeObject} from "./objectSizing";
import {SupplementalSnaps} from "./packedMeasurement";
const rectangle:Annotation={id:"moving",layerId:"base",kind:"rectangle",points:[{x:0,y:0},{x:40,y:20}]};
const circle:Annotation={id:"circle",layerId:"base",kind:"circle",points:[{x:0,y:0},{x:10,y:0}]};
it.each([false,true])("snaps a non-base corner and a circle center in packed=%s without deforming the moving shape",packed=>{
 const g=buildMeasurementGeometry({entities:[{type:"LINE",vertices:[{x:100,y:100},{x:100,y:200}]},{type:"CIRCLE",center:{x:300,y:300},radius:50}]},{},undefined,packed),snap=createMoveSnap(rectangle,rectangle.points[0]);
 const corner=snap({x:59,y:81},[g],3)!;expect(corner.point).toEqual({x:60,y:80});expect(corner.contact).toMatchObject({x:100,y:100});
 const n=translateAnnotation(rectangle,rectangle.points[0],corner.point);expect(distance(n.points[0],n.points[1])).toBe(distance(rectangle.points[0],rectangle.points[1]));
 const center=createMoveSnap(circle,circle.points[0])({x:301,y:299},[g],3)!;expect(center.kind).toBe("center");expect(center.point).toEqual({x:300,y:300});
});
it.each([false,true])("snaps arbitrary circle/arc edge points analytically and respects the missing arc in packed=%s",packed=>{
 const c={x:1e9,y:2e9},a=.37,g=buildMeasurementGeometry({entities:[{type:"ARC",center:c,radius:100,startAngle:0,endAngle:Math.PI/2}]},{},undefined,packed),o={...circle,kind:"text"as const,points:[{x:0,y:0}]},snap=createMoveSnap(o,o.points[0]);
 const s=snap({x:c.x+101*Math.cos(a),y:c.y+101*Math.sin(a)},[g],2)!;expect(s.kind).toBe("curve");expect(distance(s.point,c)).toBeCloseTo(100,5);
 expect(snap({x:c.x-100,y:c.y},[g],2)).toBeNull();
});
it("aligns parallel line interiors and circle tangencies, including the reverse edge contact",()=>{
 const target:Annotation={...rectangle,id:"stationary",kind:"polyline",points:[{x:15,y:100},{x:25,y:100}]},g=annotationGeometry([target]);
 const result=createMoveSnap({...rectangle,kind:"polyline",points:[{x:0,y:0},{x:40,y:0}]},{x:0,y:0})({x:0,y:99},[g],2)!;expect(result.point.y).toBe(100);
 const long=annotationGeometry([{...target,points:[{x:-100,y:100},{x:100,y:100}]}]),tangent=createMoveSnap(circle,circle.points[0])({x:23,y:89},[long],2)!;expect(["curve","edge"]).toContain(tangent.kind);expect(tangent.point.y).toBe(90);
});
it("honors masks and viewport boundaries and includes hatch/block supplemental edges",()=>{
 const g=annotationGeometry([]);g.snapSegments=[[{x:100,y:100},{x:100,y:200}]];const snap=createMoveSnap(rectangle,rectangle.points[0]),raw={x:59,y:81};
 expect(snap(raw,[g],3)).not.toBeNull();expect(snap(raw,[g],3,()=>false)).toBeNull();expect(snap(raw,[g],3,()=>true,{minX:0,minY:0,maxX:50,maxY:50})).toBeNull();
});
it("snaps a moving line interior to a packed block center without unpacking the original entities",()=>{
 const g=buildMeasurementGeometry({entities:[]},{},undefined,true),extra=new SupplementalSnaps();extra.add({x:17,y:100,kind:"center"});extra.finish(g.packed!);
 const o:Annotation={...rectangle,kind:"polyline",points:[{x:0,y:0},{x:80,y:0}]},result=createMoveSnap(o,o.points[0])({x:0,y:99},[g],2)!;
 expect(result.point.y).toBe(100);expect(result.contact).toMatchObject({x:17,y:100});expect(g.entities).toEqual([]);
});
it("preserves all downstream vectors for a long diagonal polyline at large drawing coordinates",()=>{
 const o:Annotation={...rectangle,kind:"polyline",points:Array.from({length:2000},(_,i)=>({x:1e9+i*300,y:2e9+i*400}))},before=JSON.stringify(o),n=resizeObject(o,[250],731)!;
 expect(JSON.stringify(o)).toBe(before);expect(n.points.slice(0,732)).toEqual(o.points.slice(0,732));expect(distance(n.points[731],n.points[732])).toBe(250);
 for(let i=733;i<n.points.length;i++){expect(n.points[i].x-n.points[i-1].x).toBe(300);expect(n.points[i].y-n.points[i-1].y).toBe(400);}
});
