import { expect, it } from "vitest";
import { DxfScene } from "dxf-viewer/src/DxfScene.js";
import { Matrix3 } from "three";
import { installTrianglePrecision, installTrianglePrecisionRendering } from "./trianglePrecision";
installTrianglePrecision(DxfScene);
it("preserves sub-unit triangle strokes near 1e8 drawing coordinates including flattened blocks", () => {
  const scene: any = new (DxfScene as any)({}); scene.origin = { x: 0, y: 0 };
  const triangle = { layer: "TEXT", color: 0xffffff, vertices: [{ x: 135913541.8, y: 76530380.1 }, { x: 135913541.9, y: 76530380.1 }, { x: 135913541.8, y: 76530380.2 }], indices: [0, 1, 2] };
  scene._ProcessTriangles(triangle);
  // Root geometry is already local before its first Float32 write.
  let batch: any; scene.batches.each((b: any) => { batch ??= b; });
  expect(batch.chunks[0].vertices.buffer).toBeInstanceOf(Float32Array);
  // A block definition stages glyphs near zero; flattening must also rebase
  // before the transformed vertices reach the destination Float32 buffer.
  const localScene: any = new (DxfScene as any)({}); localScene.origin = { x: 0, y: 0 };
  localScene._ProcessTriangles({ ...triangle, vertices: [{ x: 0, y: 0 }, { x: 0.1, y: 0 }, { x: 0, y: 0.1 }] });
  let localBatch: any; localScene.batches.each((b: any) => { localBatch = b; });
  scene._FlattenBatch(localBatch, "COPY", 0xffffff, 0, new Matrix3().makeTranslation(135913541.8, 76530380.1));
  const built = scene._BuildScene();
  const vertices = new Float32Array(built.vertices);
  for (const b of built.batches) {
    const c = b.chunks[0], offset = c.verticesOffset;
    expect(c.izcadOrigin).toBeDefined();
    expect(vertices[offset + 2] - vertices[offset]).toBeCloseTo(0.1, 5);
    expect(vertices[offset + 5] - vertices[offset + 1]).toBeCloseTo(0.1, 5);
  }
});
it("restores per-chunk double origins on root render objects", () => {
  class Viewer { scene = { children: [] as any[] }; _LoadBatch(_scene: any, _batch: any) { this.scene.children.push({ position: { set: (...v: number[]) => { this.position = v; } }, updateMatrix: () => { this.updated = true; } }); } position: number[] = []; updated = false; }
  installTrianglePrecisionRendering(Viewer); const viewer = new Viewer();
  viewer._LoadBatch({}, { key: { blockName: null }, chunks: [{ izcadOrigin: { x: 1e8 + 0.125, y: 2e8 + 0.25 } }] });
  expect(viewer.position).toEqual([1e8 + 0.125, 2e8 + 0.25, 0]); expect(viewer.updated).toBe(true);
});

it("keeps large-coordinate line endpoints aligned while the camera pans at deep zoom", () => {
  const scene:any=new (DxfScene as any)({});
  // Synthetic coordinates reproduce the precision range without shipping a site drawing.
  scene.origin={x:800000.5,y:3600000.25};
  const a={x:135000000.12345,y:76000000.6789},b={x:a.x,y:a.y-11440.25};
  scene._ProcessLineSegments({layer:"FRAME",color:0xffffff,lineType:0,vertices:[a,b]});
  const built=scene._BuildScene(),batch=built.batches[0],v=new Float32Array(built.vertices),origin=batch.izcadOrigin;
  expect(origin).toBeDefined();
  expect(v[batch.verticesOffset]).toBe(0);
  for(const offset of [-91.125,-3.75,0,7.125,102.875]){
    const camera={x:a.x-scene.origin.x+offset,y:a.y-scene.origin.y-12.75};
    for(const [axis,index]of[["x",0],["y",1]]as const){
      const local=v[batch.verticesOffset+index];
      // Three computes object-origin minus camera in JS double before uploading.
      const gpu=Math.fround(local+Math.fround(origin[axis]-camera[axis]));
      const exact=a[axis]-scene.origin[axis]-camera[axis];
      expect(Math.abs(gpu-exact)/.1).toBeLessThan(.001);
    }
  }
});

it("partitions root points and indexed polylines without rounding their far coordinates",()=>{
  const scene:any=new (DxfScene as any)({});scene.origin={x:0,y:0};
  for(const x of[135913541.8125,269913541.8125]){
    scene._ProcessPoints({layer:"DOT",color:0xffffff,vertices:[{x,y:76530380.125}]});
    for(const entity of scene._DecomposePolyline({layer:"LINE",color:0xffffff,shape:true,vertices:[{x,y:76530380.125},{x:x+.125,y:76530380.125},{x:x+.125,y:76530380.375},{x,y:76530380.375}]}))scene._ProcessPolyline(entity);
  }
  const built=scene._BuildScene(),v=new Float32Array(built.vertices);
  expect(built.batches).toHaveLength(4);
  for(const b of built.batches){
    const c=b.chunks?.[0]??b,o=c.izcadOrigin;
    expect(o).toBeDefined();expect(v[c.verticesOffset]).toBe(0);
    if(b.chunks){expect(v[c.verticesOffset+2]).toBe(.125);expect(v[c.verticesOffset+5]).toBe(.25);}
  }
});

it("rebases flattened block lines before Float32 conversion",()=>{
  const block:any=new (DxfScene as any)({});block.origin={x:0,y:0};
  const vertices=[{x:0,y:0},{x:.125,y:.25}];
  block._ProcessLineSegments({layer:"0",color:0xffffff,lineType:0,vertices},{name:"B",TransformVertex:(v:any)=>v});
  let source:any;block.batches.each((b:any)=>source=b);
  const scene:any=new (DxfScene as any)({});scene.origin={x:0,y:0};
  scene._FlattenBatch(source,"COPY",0xffffff,0,new Matrix3().makeTranslation(135913541.8125,76530380.125));
  const built=scene._BuildScene(),b=built.batches[0],v=new Float32Array(built.vertices);
  expect(b.izcadOrigin).toEqual({x:135913541.8125,y:76530380.125});
  expect(Array.from(v)).toEqual([0,0,.125,.25]);
});

it("preserves precise instance translations and block-local clip coordinates",()=>{
  const scene:any=new (DxfScene as any)({});scene.origin={x:0,y:0};
  const matrices:Matrix3[]=[];
  scene.blocks.set("B",{flatten:false,HasGeometry:()=>true,bounds:{minX:0,minY:0,maxX:100,maxY:100},InstantiationContext:()=>({GetInsertionTransform:(e:any)=>{const m=new Matrix3().makeTranslation(e.position.x,e.position.y);matrices.push(m);return m;}})});
  for(const x of[135913541.8125,269913541.8125])scene._ProcessInsert({name:"B",layer:"INSERT",color:0xffffff,position:{x,y:76530380.125}});
  const built=scene._BuildScene(),transforms=new Float32Array(built.transforms);
  expect(built.batches).toHaveLength(1);
  const b=built.batches[0];expect(b.key.blockName).toBe("B");expect(transforms).toHaveLength(12);
  expect(Array.from(b.izcadInstanceTranslations)).toEqual([135913541.8125,76530380.125,269913541.8125,76530380.125]);
  expect(matrices.every(m=>m.elements[6]>1e8&&m.elements[7]===76530380.125)).toBe(true);
});

it("applies a shared double origin to every rendered child of an instance tile",()=>{
  class Viewer{scene={children:[]as any[]};_LoadBatch(){for(let i=0;i<3;i++)this.scene.children.push({position:{set(x:number,y:number,z:number){Object.assign(this,{x,y,z});}},updateMatrix(){this.updated=true;}});}}
  installTrianglePrecisionRendering(Viewer);const viewer=new Viewer();
  (viewer as any)._LoadBatch({}, {key:{blockName:"B"},izcadOrigin:{x:135913541.8125,y:76530380.125}});
  for(const child of viewer.scene.children){expect(child.position.x).toBe(135913541.8125);expect(child.position.y).toBe(76530380.125);expect(child.updated).toBe(true);}
});

it("preserves far shaped-point instance positions before their first Float32 write",()=>{
  const scene:any=new (DxfScene as any)({});scene.origin={x:0,y:0};scene.pdMode=32;scene.pdSize=10;
  for(const x of[135913541.8125,269913541.8125])for(const entity of scene._DecomposePoint({position:{x,y:76530380.125},layer:"DOT",color:0xffffff}))scene._ProcessEntity(entity);
  const built=scene._BuildScene(),v=new Float32Array(built.vertices),instances=built.batches.filter((b:any)=>b.key.geometryType===6);
  expect(instances).toHaveLength(2);
  for(const b of instances){expect(b.izcadOrigin.y).toBe(76530380.125);expect(v[b.verticesOffset]).toBe(0);expect(v[b.verticesOffset+1]).toBe(0);}
});

it("rebases shared instance buffers near the camera without extra draw objects or per-frame uploads",()=>{
  const tx=135913541.8125,ty=76530380.125;
  class Viewer{
    scene={children:[]as any[]};camera={position:{x:tx+13.375,y:ty+7.125}};
    buffer={array:new Float32Array([1,0,tx,0,1,ty]),needsUpdate:false};
    _LoadBatch(){for(let i=0;i<2;i++)this.scene.children.push({visible:true,layers:{mask:1},geometry:{attributes:{instanceTransform0:{data:this.buffer}}},position:{x:0,y:0,set(x:number,y:number){Object.assign(this,{x,y});}},updateMatrix(){}});}
    GetCamera(){return this.camera;}Render(){}Clear(){this.scene.children=[];}
  }
  installTrianglePrecisionRendering(Viewer);const viewer=new Viewer();
  (viewer as any)._LoadBatch({}, {key:{blockName:"B"},izcadInstanceTranslations:new Float64Array([tx,ty])});
  viewer.Render();expect(viewer.scene.children).toHaveLength(2);
  const verify=()=>{const o=viewer.scene.children[0],a=viewer.buffer.array;
    for(const[axis,index,coordinate]of[["x",2,tx],["y",5,ty]]as const){
      const gpu=Math.fround(Math.fround(a[index]+27.125)+Math.fround(o.position[axis]-viewer.camera.position[axis]));
      expect(Math.abs(gpu-(coordinate+27.125-viewer.camera.position[axis]))/.1).toBeLessThan(.02);
    }
  };
  verify();viewer.buffer.needsUpdate=false;viewer.camera.position.x+=.375;viewer.Render();verify();expect(viewer.buffer.needsUpdate).toBe(false);
  viewer.camera.position.x+=16384;viewer.Render();verify();expect(viewer.buffer.needsUpdate).toBe(true);
  viewer.Clear();viewer.buffer.needsUpdate=false;viewer.Render();expect(viewer.buffer.needsUpdate).toBe(false);
});
