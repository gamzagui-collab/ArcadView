import {expect,it} from "vitest";
import {takeoffDraftPoints} from "./draft";

it("moves first, middle and last draft vertices without adding a point or changing the other vertices",()=>{
 const points=[{x:0,y:0},{x:20,y:0},{x:20,y:10}],original=structuredClone(points);
 for(const replaceIndex of [0,1,2]){const point={x:10,y:15},edited=takeoffDraftPoints(points,{point,replaceIndex});expect(edited).toHaveLength(3);expect(edited[replaceIndex]).toEqual(point);edited.forEach((p,i)=>{if(i!==replaceIndex)expect(p).toEqual(original[i]);});expect(points).toEqual(original);}
});
it("resumes appending after vertex editing, and canceling a preview leaves the committed draft intact",()=>{
 const points=[{x:0,y:0},{x:20,y:0},{x:20,y:10}],edited=takeoffDraftPoints(points,{point:{x:25,y:0},replaceIndex:1});
 expect(takeoffDraftPoints(edited,{point:{x:0,y:10}})).toEqual([{x:0,y:0},{x:25,y:0},{x:20,y:10},{x:0,y:10}]);expect(takeoffDraftPoints(points,null)).toEqual(points);
});
it("preserves long drafts and closing endpoints without measurement reset or point-count truncation",()=>{
 const points=Array.from({length:4096},(_,i)=>({x:i,y:0}));const edited=takeoffDraftPoints(points,{point:{x:5000,y:0},replaceIndex:4095});expect(edited).toHaveLength(4096);expect(edited.at(-1)).toEqual({x:5000,y:0});
 const closed=[{x:0,y:0},{x:10,y:0},{x:10,y:10},{x:0,y:0}];expect(takeoffDraftPoints(closed,{point:{x:20,y:20}})).toHaveLength(5);
 expect(takeoffDraftPoints(points,{point:{x:0,y:1},replaceIndex:-1})).toEqual(points);
});
