const fs=require('fs'),acorn=require('/tmp/mirsad-review-tools/node_modules/acorn');
const root='/tmp/mirsad-schools-service-fix/';
for(const [file,name] of [['madrasati-source.js','_0x5f4cbb'],['drive-sync.js','_0x5735a2']]){
 const s=fs.readFileSync(root+file,'utf8');let fn;
 function walk(n,callback){if(!n||typeof n!=='object')return;callback(n);for(const v of Object.values(n))if(Array.isArray(v))v.forEach(n=>walk(n,callback));else if(v&&typeof v==='object')walk(v,callback)}
 walk(acorn.parse(s,{ecmaVersion:'latest'}),n=>{if(n.type==='FunctionDeclaration'&&n.id?.name===name)fn=n});
 if(!fn)throw Error('Missing request function '+name);
 const sites=[];walk(fn,n=>{if(n.type==='CallExpression'&&n.callee.type==='Identifier'&&n.callee.name==='fetch')sites.push(n.callee)});
 if(sites.length!==1)throw Error('Unexpected fetch count '+name);
 const site=sites[0];fs.writeFileSync(root+file,s.slice(0,site.start)+'MirsadServiceTransport.fetch'+s.slice(site.end));
}
const p=root+'background.js';fs.writeFileSync(p,"importScripts('service-transport.js');\n"+fs.readFileSync(p,'utf8'));
