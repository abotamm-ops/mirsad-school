// Patch only the stable school content script; leave join verification and scanning intact.
const fs=require('node:fs'),path=require('node:path');
const babel=require(path.join(path.dirname(require.resolve('playwright')),'lib/transform/babelBundle.js'));
function patch(input,filename){
 const decoded=babel.babelTransform(input,filename,false,[[path.resolve(__dirname,'../chrome-store/readable-plugin.cjs'),{}]],[]).code;
 const fallback=/async function (\w+)\(\) \{\n      for \(let (\w+) = 0; \2 < 3; \2\+\+\) \{\n        if \((\w+)\(\)\) return await new Promise\(/.exec(decoded);
 if(!fallback)throw Error('Stable Teams browser fallback changed; review patch');
 const ready=`function mirsadEntryReady(){
  const controls=[...document.querySelectorAll('button,[role="button"]')];
  const labels=new Set(['join now','join','join meeting','join the meeting','join on the web','انضمام الآن','الانضمام الآن','انضم الآن','الانضمام','انضمام','الانضمام إلى الاجتماع','انضمام للاجتماع']);
  return controls.some(el=>!el.disabled&&el.getAttribute('aria-disabled')!=='true'&&el.getClientRects().length&&
    (el.id==='roster-button'||el.getAttribute('data-inp')==='roster-button'||
    [el.innerText,el.getAttribute('aria-label'),el.getAttribute('title')].some(label=>labels.has(String(label||'').trim().replace(/\\s+/g,' ').toLocaleLowerCase()))));
 }
 `;
 let out=decoded.replace(fallback[0],ready+fallback[0].replace(`if (${fallback[3]}()`, `if (mirsadEntryReady()) return false;\n        if (${fallback[3]}()`));
 const initial=new RegExp('await new Promise\\((\\w+) => setTimeout\\(\\1, 2000\\)\\), await '+fallback[1]+'\\(\\);');
 if(!initial.test(out))throw Error('Stable Teams entry delay changed; review patch');
 out=out.replace(initial,`await ${fallback[1]}();`);
 return out;
}
module.exports={patch};
if(require.main===module){const file=process.argv[2];fs.writeFileSync(file,patch(fs.readFileSync(file,'utf8'),file));console.log('Teams entry: skip fixed startup waits when Join is ready');}
