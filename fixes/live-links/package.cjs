const fs=require('fs'),acorn=require('/tmp/mirsad-review-tools/node_modules/acorn');
const body=fs.readFileSync('fixes/live-links/merge.js','utf8');
for(const [kind,name] of [['Teams','mergeRemoteSnapshot'],['Schools','_0x52f546']]){
 const p='/tmp/stable-link-'+kind+'/drive-sync.js',s=fs.readFileSync(p,'utf8');let found;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name===name)found=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 walk(acorn.parse(s,{ecmaVersion:'latest'}));if(!found)throw Error(name);
 let patched=s.slice(0,found.start)+body.replace('function mergeRemoteSnapshot','function '+name)+s.slice(found.end);
 patched=patched.replace('return {pullRemoteLinks,','return {reconcileRunLinks,pullRemoteLinks,').replace("'pullRemoteLinks':","reconcileRunLinks:reconcileRunLinks,'pullRemoteLinks':");
 fs.writeFileSync(p,patched);
 const bg='/tmp/stable-link-'+kind+'/background.js';let bgSource=fs.readFileSync(bg,'utf8'),save;
 function findSave(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name==='saveRun')save=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(findSave);else if(v&&typeof v==='object')findSave(v)}
 findSave(acorn.parse(bgSource,{ecmaVersion:'latest'}));if(!save)throw Error('Missing saveRun');
 const parameter=bgSource.slice(save.params[0].start,save.params[0].end);
 bgSource=bgSource.slice(0,save.body.start+1)+'CloudMonitoring.reconcileRunLinks?.('+parameter+');'+bgSource.slice(save.body.start+1);
 fs.writeFileSync(bg,bgSource);
}
