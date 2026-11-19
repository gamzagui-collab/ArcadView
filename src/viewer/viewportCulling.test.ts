import {expect,it}from"vitest";
import {BufferGeometry,BufferAttribute,InstancedBufferAttribute,Mesh,OrthographicCamera,Scene,RawShaderMaterial}from"three";
import {ViewportCuller,renderObjectBounds}from"./viewportCulling";
const object=()=>{const g=new BufferGeometry();g.setAttribute('position',new BufferAttribute(new Float32Array([0,0,10,0,10,20]),2));return new Mesh(g,new RawShaderMaterial());};
it("includes mirrored/rotated shader instances and object translations conservatively",()=>{
 const o=object();o.geometry.setAttribute('instanceTransform0',new InstancedBufferAttribute(new Float32Array([0,-1,100]),3));o.geometry.setAttribute('instanceTransform1',new InstancedBufferAttribute(new Float32Array([-1,0,200]),3));o.position.set(1000,2000,0);o.updateMatrixWorld(true);
 expect(renderObjectBounds(o)).toEqual({minX:1080,maxX:1100,minY:2190,maxY:2200});
});
it("culls outside the camera, preserves layer visibility, and restores the original layer mask",()=>{
 const scene=new Scene(),o=object();scene.add(o);o.position.x=10000;o.updateMatrix();
 const c=new ViewportCuller(scene),cam=new OrthographicCamera(-50,50,50,-50,.1,2);cam.position.z=1;
 c.update(cam,100);expect(o.layers.mask).toBe(0);o.visible=false;cam.position.x=10000;c.update(cam,100);expect(o.layers.mask).toBe(1);expect(o.visible).toBe(false);
 cam.position.x=0;c.update(cam,100);c.restore();expect(o.layers.mask).toBe(1);
});
it("uses nested clip bounds before the instance transform and keeps points near viewport edges",()=>{
 const o=object();o.material=new RawShaderMaterial({uniforms:{izcadClipPolygon_1:{value:[{x:2,y:3},{x:8,y:3},{x:8,y:9},{x:2,y:9}]},izcadClipPointCount_1:{value:4}}});o.updateMatrixWorld();
 expect(renderObjectBounds(o)).toEqual({minX:2,maxX:8,minY:3,maxY:9});
});
