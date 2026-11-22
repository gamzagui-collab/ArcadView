import{expect,it}from'vitest';
import{BufferGeometry,CustomBlending,LineSegments,Mesh,OneMinusSrcAlphaFactor,OrthographicCamera,Points,RawShaderMaterial,Scene,SrcAlphaFactor}from'three';
import{CadStrokeStyle,installCadStrokeShaders,overviewCoverage}from'./cadStroke';
it('thins overview coverage continuously and restores full detail without assuming drawing units',()=>{
 expect(overviewCoverage(100,100)).toBeCloseTo(.65);expect(overviewCoverage(100,1000)).toBe(.35);expect(overviewCoverage(100,20)).toBe(1);expect(overviewCoverage(0,100)).toBe(1);
});
it('keeps XCLIP shader inputs and CAD RGB intact, including exact color-pick passes',()=>{
 class Viewer{_CreateSimpleColorMaterial(){return new RawShaderMaterial({fragmentShader:'uniform vec3 color; void main() { fragColor = vec4(color, 1.0); }'});} _CreateSimplePointMaterial(){return this._CreateSimpleColorMaterial();}}
 installCadStrokeShaders(Viewer);installCadStrokeShaders(Viewer);const m=new Viewer()._CreateSimpleColorMaterial();expect(m.fragmentShader.match(/uniform float arcadStrokeCoverage/g)).toHaveLength(1);expect(m.fragmentShader).toContain('vec4(color, arcadStrokeCoverage)');expect(m).toMatchObject({blending:CustomBlending,blendSrc:SrcAlphaFactor,blendDst:OneMinusSrcAlphaFactor,transparent:false,alphaToCoverage:false});
 const scene=new Scene(),line=new LineSegments(new BufferGeometry(),m),mesh=new Mesh(new BufferGeometry(),m);scene.add(line,mesh);const original=line.onBeforeRender,style=new CadStrokeStyle(scene,100),camera=new OrthographicCamera(-50,50);style.update(camera);
 (line.onBeforeRender as any)();expect(m.uniforms.arcadStrokeCoverage.value).toBeCloseTo(.65);(line.onAfterRender as any)();expect(m.uniforms.arcadStrokeCoverage.value).toBe(1);expect(m.uniformsNeedUpdate).toBe(true);
 expect(()=>style.withExact(()=>{(line.onBeforeRender as any)();expect(m.uniforms.arcadStrokeCoverage.value).toBe(1);(line.onAfterRender as any)();throw Error('pick interrupted')})).toThrow();(line.onBeforeRender as any)();expect(m.uniforms.arcadStrokeCoverage.value).toBeCloseTo(.65);(line.onAfterRender as any)();style.dispose();expect(line.onBeforeRender).toBe(original);
});
it('shrinks CAD point pixels only in overviews and does not change filled geometry',()=>{
 const m=new RawShaderMaterial({uniforms:{arcadStrokeCoverage:{value:1},pointSize:{value:3}}}),scene=new Scene(),p=new Points(new BufferGeometry(),m),mesh=new Mesh(new BufferGeometry(),m);scene.add(p,mesh);const meshBefore=mesh.onBeforeRender,style=new CadStrokeStyle(scene,100);style.update(new OrthographicCamera(-500,500));(p.onBeforeRender as any)();expect(m.uniforms.pointSize.value).toBeCloseTo(1.05);(p.onAfterRender as any)();expect(m.uniforms.pointSize.value).toBe(3);expect(mesh.onBeforeRender).toBe(meshBefore);style.dispose();
});
