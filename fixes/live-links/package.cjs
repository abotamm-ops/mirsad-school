const fs=require('fs'),acorn=require('/tmp/mirsad-review-tools/node_modules/acorn');
const body=fs.readFileSync('fixes/live-links/merge.js','utf8');
for(const [kind,name] of [['Teams','mergeRemoteSnapshot'],['Schools','_0x52f546']]){
 const p='/tmp/stable-link-'+kind+'/drive-sync.js',s=fs.readFileSync(p,'utf8');let found;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name===name)found=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 walk(acorn.parse(s,{ecmaVersion:'latest'}));if(!found)throw Error(name);
 let patched=s.slice(0,found.start)+body.replace('function mergeRemoteSnapshot','function '+name)+s.slice(found.end);
 patched=patched.replace('return {pullRemoteLinks,','return {reconcileRunLinks,pullRemoteLinks,').replace("'pullRemoteLinks':","reconcileRunLinks:reconcileRunLinks,'pullRemoteLinks':");
 let sync;const syncName=kind==='Teams'?'syncRunLinks':'_0x5390ce';
 function findSync(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name===syncName)sync=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(findSync);else if(v&&typeof v==='object')findSync(v)}
 findSync(acorn.parse(patched,{ecmaVersion:'latest'}));if(!sync)throw Error('Missing manual sync');
 const loop=sync.body.body.find(n=>n.type==='ForOfStatement');if(!loop)throw Error('Missing manual sync loop');
 const snapshotParam=patched.slice(sync.params[0].start,sync.params[0].end);
 patched=patched.slice(0,loop.start)+'runLinkSnapshot='+snapshotParam+';'+patched.slice(loop.start);
 fs.writeFileSync(p,patched);
 const bg='/tmp/stable-link-'+kind+'/background.js';let bgSource=fs.readFileSync(bg,'utf8'),save;
 function findSave(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name==='saveRun')save=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(findSave);else if(v&&typeof v==='object')findSave(v)}
 findSave(acorn.parse(bgSource,{ecmaVersion:'latest'}));if(!save)throw Error('Missing saveRun');
 const parameter=bgSource.slice(save.params[0].start,save.params[0].end);
 bgSource=bgSource.slice(0,save.body.start+1)+'CloudMonitoring.reconcileRunLinks?.('+parameter+');'+bgSource.slice(save.body.start+1);
 if(kind==='Schools'){
  const broken='await MirsadAutoLinks.beforeCycle(_0x119063);';
  if(!bgSource.includes(broken))throw Error('Missing school resume patch target');
  bgSource=bgSource.replace(broken,'await MirsadAutoLinks.beforeCycle(_0x3b0507);');
 }
 fs.writeFileSync(bg,bgSource);
}
