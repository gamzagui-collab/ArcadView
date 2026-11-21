import{readFile}from'node:fs/promises';import{execFileSync}from'node:child_process';import{pathToFileURL}from'node:url';
export async function verifyPublicSource({owner,repository,tag,commit,token},fetcher=fetch){
 if(!/^[\w.-]+$/.test(owner)||!/^[\w.-]+$/.test(repository)||!/^v\d+\.\d+\.\d+$/.test(tag)||!/^[a-f0-9]{40}$/.test(commit))throw Error('Invalid source identity');
 const base=`https://api.github.com/repos/${owner}/${repository}`,get=async path=>{const response=await fetcher(base+path,{headers:{Accept:'application/vnd.github+json','User-Agent':'Arcad-View-source-verification','Cache-Control':'no-cache',...(token?{Authorization:`Bearer ${token}`}:{})},redirect:'error',signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error(`Public source unavailable (${response.status})`);return response.json();};
 const repo=await get('');if(repo.private!==false||repo.full_name!==`${owner}/${repository}`)throw Error('Source repository must be public');
 let object=(await get('/git/ref/tags/'+tag)).object;
 for(let depth=0;object?.type==='tag'&&depth<5;depth++){
  if(!/^[a-f0-9]{40}$/.test(object.sha))throw Error('Invalid source tag');object=(await get('/git/tags/'+object.sha)).object;
 }
 if(object?.type!=='commit'||object.sha!==commit)throw Error('Public source tag differs from the binary commit');
 return{repository:repo.full_name,tag,commit,url:`https://github.com/${repo.full_name}/tree/${tag}`};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const source=JSON.parse(await readFile('source-config.json','utf8')),release=JSON.parse(await readFile('release-config.json','utf8')),pkg=JSON.parse(await readFile('package.json','utf8'));
 if(process.env.GITHUB_REPOSITORY!==`${release.owner}/${release.repository}`||process.env.GITHUB_REF_NAME!==`v${pkg.version}`)throw Error('Expected the build repository and release tag');
 const result=await verifyPublicSource({...source,token:process.env.GITHUB_TOKEN,tag:process.env.GITHUB_REF_NAME,commit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim()});console.log('PASS complete corresponding source '+JSON.stringify(result));
}
