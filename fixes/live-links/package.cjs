const fs=require('fs'),acorn=require('/tmp/mirsad-review-tools/node_modules/acorn');
require('child_process').execFileSync('python3',['-c',`
import zipfile,pathlib
for kind,version in [('Teams','0.6.81.1'),('Schools','2.3.3.1')]:
 p=pathlib.Path('/tmp/stable-link-'+kind);p.mkdir(exist_ok=True)
 with zipfile.ZipFile('schools/downloads/Mirsad-'+kind+'-'+version+'.zip') as z:
  (p/'drive-sync.js').write_bytes(z.read('الإضافة/drive-sync.js'))
`]);
const body=fs.readFileSync('fixes/live-links/merge.js','utf8');
for(const [kind,name] of [['Teams','mergeRemoteSnapshot'],['Schools','_0x52f546']]){
 const p='/tmp/stable-link-'+kind+'/drive-sync.js',s=fs.readFileSync(p,'utf8');let found;
 function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id?.name===name)found=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v)}
 walk(acorn.parse(s,{ecmaVersion:'latest'}));if(!found)throw Error(name);
 fs.writeFileSync(p,s.slice(0,found.start)+body.replace('function mergeRemoteSnapshot','function '+name)+s.slice(found.end));
}
