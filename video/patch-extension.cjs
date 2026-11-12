const fs=require('fs'),acorn=require('/tmp/mirsad-review-tools/node_modules/acorn');
for(const label of ['Teams','Schools']){
 const root='/tmp/mirsad-video-'+label+'/';let s=fs.readFileSync(root+'drive-sync.js','utf8');
 if(label==='Teams'){if(!s.includes('return {reconcileRunLinks,'))throw Error('private export missing');s=s.replace('return {reconcileRunLinks,',"return {video:(action,payload)=>request(action,payload),reconcileRunLinks,")}
 else{if(!s.includes('reconcileRunLinks:reconcileRunLinks,'))throw Error('school export missing');s=s.replace('reconcileRunLinks:reconcileRunLinks,',"video:(action,payload)=>_0x5735a2(action,payload),reconcileRunLinks:reconcileRunLinks,")}
 fs.writeFileSync(root+'drive-sync.js',s);
 s=fs.readFileSync(root+'background.js','utf8');let target;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name==='navigateCurrent')target=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}walk(acorn.parse(s,{ecmaVersion:'latest'}));if(!target)throw Error('missing navigation');s=s.slice(0,target.body.start+1)+'await MirsadVideo.beforeScan();'+s.slice(target.body.start+1);const advance=/async function advancePeriod\(([^,]+),([^)]*)\)\{/;if(!advance.test(s))throw Error('missing advancePeriod');s=s.replace(advance,(match,run,after)=>match+'await MirsadVideo.completed('+run+','+after+').catch(()=>{});');fs.writeFileSync(root+'background.js',s);
}

require('./patch-final-gap.cjs');
