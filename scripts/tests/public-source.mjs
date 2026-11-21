import{test}from'node:test';import assert from'node:assert/strict';import{verifyPublicSource}from'../verify-public-source.mjs';
import{readFile}from'node:fs/promises';
test('APK publication runs only in the distribution repository, never in the corresponding source mirror',async()=>{
 const workflow=await readFile(new URL('../../.github/workflows/android-release.yml',import.meta.url),'utf8');
 assert.match(workflow,/if: github\.repository == 'gamzagui-collab\/ArcadView' && startsWith\(github\.ref, 'refs\/tags\/v'\)/);
});
const config={owner:'owner',repository:'App-Source',tag:'v1.2.3',commit:'a'.repeat(40)};
const server=(repo,object,tagObject)=>async url=>({ok:true,status:200,json:async()=>url.endsWith('/App-Source')?repo:url.includes('/git/ref/')?{object}:tagObject});
test('accepts only the public source tag matching the distributed commit',async()=>{const r=await verifyPublicSource(config,server({full_name:'owner/App-Source',private:false},{type:'commit',sha:config.commit}));assert.equal(r.url,'https://github.com/owner/App-Source/tree/v1.2.3');});
test('resolves annotated tags while retaining the exact commit check',async()=>{await verifyPublicSource(config,server({full_name:'owner/App-Source',private:false},{type:'tag',sha:'b'.repeat(40)},{object:{type:'commit',sha:config.commit}}));});
test('rejects private, unavailable and mismatched corresponding source',async()=>{await assert.rejects(verifyPublicSource(config,server({full_name:'owner/App-Source',private:true},{type:'commit',sha:config.commit})),/must be public/);await assert.rejects(verifyPublicSource(config,async()=>({ok:false,status:404})),/unavailable/);await assert.rejects(verifyPublicSource(config,server({full_name:'owner/App-Source',private:false},{type:'commit',sha:'b'.repeat(40)})),/differs/);});
test('rejects injected repository paths and unbounded annotated-tag chains',async()=>{await assert.rejects(verifyPublicSource({...config,repository:'../private'}),/Invalid source/);await assert.rejects(verifyPublicSource(config,server({full_name:'owner/App-Source',private:false},{type:'tag',sha:'b'.repeat(40)},{object:{type:'tag',sha:'b'.repeat(40)}})),/differs/);});
test('uses the temporary runner token for API access without weakening public visibility or returning credentials',async()=>{
 const token='dummy-runner-token',publicServer=server({full_name:'owner/App-Source',private:false},{type:'commit',sha:config.commit});let requests=0;
 const restricted=async(url,options)=>{requests++;assert.equal(new URL(url).origin,'https://api.github.com');assert.equal(options.redirect,'error');if(options.headers.Authorization!==`Bearer ${token}`)return{ok:false,status:403};return publicServer(url);};
 await assert.rejects(verifyPublicSource(config,restricted),/unavailable \(403\)/);
 const result=await verifyPublicSource({...config,token},restricted);assert.equal(result.commit,config.commit);assert.equal(JSON.stringify(result).includes(token),false);assert.equal(requests,3);
 await assert.rejects(verifyPublicSource({...config,token},server({full_name:'owner/App-Source',private:true},{type:'commit',sha:config.commit})),/must be public/);
});
