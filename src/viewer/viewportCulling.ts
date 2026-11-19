import type { Object3D, OrthographicCamera, Scene } from "three";
type Box = {minX:number;minY:number;maxX:number;maxY:number};
const boxes=new WeakMap<object,Box|null>();
function attributeBounds(a:any):Box|null {
  if(boxes.has(a))return boxes.get(a)!;
  const b={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};
  for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i);b.minX=Math.min(b.minX,x);b.maxX=Math.max(b.maxX,x);b.minY=Math.min(b.minY,y);b.maxY=Math.max(b.maxY,y);}
  const result=Object.values(b).every(Number.isFinite)?b:null;boxes.set(a,result);return result;
}
function transformed(b:Box,a:number,bx:number,c:number,d:number,tx:number,ty:number):Box {
  const x=a>=0?[b.minX*a,b.maxX*a]:[b.maxX*a,b.minX*a],y=bx>=0?[b.minY*bx,b.maxY*bx]:[b.maxY*bx,b.minY*bx];
  const u=c>=0?[b.minX*c,b.maxX*c]:[b.maxX*c,b.minX*c],v=d>=0?[b.minY*d,b.maxY*d]:[b.maxY*d,b.minY*d];
  return{minX:x[0]+y[0]+tx,maxX:x[1]+y[1]+tx,minY:u[0]+v[0]+ty,maxY:u[1]+v[1]+ty};
}
export function renderObjectBounds(object:any):Box|null {
  const attrs=object.geometry?.attributes;if(!attrs?.position)return null;
  let b=attributeBounds(attrs.position);if(!b)return null;b={...b};
  const uniforms=object.material?.uniforms;
  for(let n=1;uniforms?.[`izcadClipPolygon_${n}`];n++){
    const points=uniforms[`izcadClipPolygon_${n}`].value.slice(0,uniforms[`izcadClipPointCount_${n}`].value);
    b={minX:Math.max(b.minX,Math.min(...points.map((p:any)=>p.x))),maxX:Math.min(b.maxX,Math.max(...points.map((p:any)=>p.x))),minY:Math.max(b.minY,Math.min(...points.map((p:any)=>p.y))),maxY:Math.min(b.maxY,Math.max(...points.map((p:any)=>p.y)))};
  }
  if(b.minX>b.maxX||b.minY>b.maxY)return null; // Keep uncertain/empty objects conservatively.
  const t0=attrs.instanceTransform0,t1=attrs.instanceTransform1,translation=attrs.instanceTransform;
  if(t0&&t1){const union={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};for(let i=0;i<t0.count;i++){const bb=transformed(b,t0.getX(i),t0.getY(i),t1.getX(i),t1.getY(i),t0.getZ(i),t1.getZ(i));union.minX=Math.min(union.minX,bb.minX);union.maxX=Math.max(union.maxX,bb.maxX);union.minY=Math.min(union.minY,bb.minY);union.maxY=Math.max(union.maxY,bb.maxY);}b=union;}
  else if(translation){const t=attributeBounds(translation);if(!t)return null;b={minX:b.minX+t.minX,maxX:b.maxX+t.maxX,minY:b.minY+t.minY,maxY:b.maxY+t.maxY};}
  const e=object.matrixWorld.elements;
  const result=transformed(b,e[0],e[4],e[1],e[5],e[12],e[13]);
  return Object.values(result).every(Number.isFinite)?result:null;
}
/** Only camera membership changes. Layer visibility and all geometry stay intact. */
export class ViewportCuller {
  private entries:Array<{object:Object3D;mask:number;bounds:Box}>=[];
  constructor(scene:Scene){scene.updateMatrixWorld(true);for(const object of scene.children){const bounds=renderObjectBounds(object);if(bounds)this.entries.push({object,mask:object.layers.mask,bounds});}}
  update(camera:OrthographicCamera,viewportWidth:number):void {
    // izCAD is a fixed 2D top view; leave unusual camera rotations uncropped.
    if(Math.abs(camera.quaternion.x)+Math.abs(camera.quaternion.y)+Math.abs(camera.quaternion.z)>1e-10){this.restore();return;}
    const x=camera.position.x+(camera.left+camera.right)/(2*camera.zoom),y=camera.position.y+(camera.top+camera.bottom)/(2*camera.zoom);
    const hw=(camera.right-camera.left)/(2*camera.zoom),hh=(camera.top-camera.bottom)/(2*camera.zoom),pad=8*(2*hw)/Math.max(1,viewportWidth);
    for(const {object,mask,bounds:b} of this.entries){
      // The shader evaluates instance transforms in Float32. At deep zoom,
      // keep several ULPs of margin as well as the screen-space point radius.
      const margin=pad+Math.max(Math.abs(b.minX),Math.abs(b.maxX),Math.abs(b.minY),Math.abs(b.maxY))*2**-20;
      object.layers.mask=b.maxX<x-hw-margin||b.minX>x+hw+margin||b.maxY<y-hh-margin||b.minY>y+hh+margin?0:mask;
    }
  }
  restore():void {for(const {object,mask}of this.entries)object.layers.mask=mask;}
}
