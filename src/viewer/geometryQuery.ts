import type {DrawingBounds as B} from './savedView';
import type {MeasurementGeometry as G} from './measurementGeometry';

type Node={box:B;start:number;end:number;left?:Node;right?:Node};
const overlaps=(a:B,b:B)=>a.minX<=b.maxX&&a.maxX>=b.minX&&a.minY<=b.maxY&&a.maxY>=b.minY;
/** Immutable double bounds only; geometry and CAD coordinates remain in their original buffers. */
function boundsIndex(count:number,bounds:(id:number)=>B){
 const values=new Float64Array(count*4),order=Uint32Array.from({length:count},(_,i)=>i);
 for(let i=0;i<count;i++){const b=bounds(i);values.set([b.minX,b.minY,b.maxX,b.maxY],i*4);}
 const at=(i:number):B=>({minX:values[i*4],minY:values[i*4+1],maxX:values[i*4+2],maxY:values[i*4+3]});
 const build=(start:number,end:number):Node=>{
  const box:B={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(let i=start;i<end;i++){const b=at(order[i]);box.minX=Math.min(box.minX,b.minX);box.minY=Math.min(box.minY,b.minY);box.maxX=Math.max(box.maxX,b.maxX);box.maxY=Math.max(box.maxY,b.maxY);}
  const node:Node={box,start,end};if(end-start<=24)return node;
  const axis=box.maxX-box.minX>=box.maxY-box.minY?0:1;
  order.subarray(start,end).sort((a,b)=>values[a*4+axis]+values[a*4+axis+2]-values[b*4+axis]-values[b*4+axis+2]||a-b);
  const mid=(start+end)>>>1;node.left=build(start,mid);node.right=build(mid,end);return node;
 };
 const root=count?build(0,count):null;
 return(box:B,visit:(id:number)=>void)=>{
  if(!root)return;const stack=[root];while(stack.length){const n=stack.pop()!;if(!overlaps(n.box,box))continue;
   if(n.left){stack.push(n.left,n.right!);continue;}for(let i=n.start;i<n.end;i++)if(overlaps(at(order[i]),box))visit(order[i]);
  }
 };
}
const cache=new WeakMap<G,{entityCount:number;supplementalCount:number;entities:ReturnType<typeof boundsIndex>;supplemental:ReturnType<typeof boundsIndex>}>();
function index(g:G){
 const p=g.packed,extra=p?.snapSegmentCount??0,entityCount=p?.entityCount??g.entities.length,supplementalCount=extra+(g.snapSegments?.length??0);
 let value=cache.get(g);if(value?.entityCount===entityCount&&value.supplementalCount===supplementalCount)return value;
 value={entityCount,supplementalCount,entities:boundsIndex(entityCount,i=>{
  if(!p)return g.entities[i].bounds;const d=p.data[Math.floor(i/16384)],k=i%16384*7;return{minX:d[k],minY:d[k+1],maxX:d[k+2],maxY:d[k+3]};
 }),supplemental:boundsIndex(supplementalCount,i=>{
  let ax:number,ay:number,bx:number,by:number;
  if(i<extra){const d=p!.snapSegments![Math.floor(i/16384)],k=i%16384*4;[ax,ay,bx,by]=[d[k],d[k+1],d[k+2],d[k+3]];}
  else{const[a,b]=g.snapSegments![i-extra];[ax,ay,bx,by]=[a.x,a.y,b.x,b.y];}
  return{minX:Math.min(ax,bx),minY:Math.min(ay,by),maxX:Math.max(ax,bx),maxY:Math.max(ay,by)};
 })};cache.set(g,value);return value;
}
export function queryEntityIds(g:G,box:B,visit:(id:number)=>void):void{index(g).entities(box,visit);}
export function querySupplementalIds(g:G,box:B,visit:(id:number)=>void):void{index(g).supplemental(box,visit);}
export function releaseGeometryQuery(g:G):void{cache.delete(g);}
/** Prepare once while the drawing is loading, so the first precision hold does not build an index. */
export function prepareGeometryQuery(g:G):void{index(g);}
