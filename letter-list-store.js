/* Delete generated letter entries only; never alters attendance or evidence. */
(function(root){'use strict';
 const key=(endpoint,date)=>'mirsad-letter-deletions-v1:'+encodeURIComponent(endpoint)+'|'+date;
 const signature=r=>JSON.stringify({id:r.id,date:r.date,provisional:!!r.provisional,cases:r.reports.map(g=>({type:g.type,lessons:g.lessons.map(l=>[l.period,l.subject||'',l.className||'']).sort((a,b)=>a[0]-b[0])})).sort((a,b)=>a.type.localeCompare(b.type))});
 function read(endpoint,date,storage=root.localStorage){try{const v=JSON.parse(storage.getItem(key(endpoint,date))||'[]');return Array.isArray(v)?v.filter(x=>typeof x==='string'):[]}catch{return []}}
 function visible(reports,endpoint,date,storage=root.localStorage){const deleted=new Set(read(endpoint,date,storage));return reports.filter(r=>!deleted.has(signature(r)))}
 function remove(reports,endpoint,date,storage=root.localStorage){if(reports.some(r=>r.date!==date))throw new Error('حدد يوم الخطابات المطلوب حذفه');const all=[...new Set([...read(endpoint,date,storage),...reports.map(signature)])];storage.setItem(key(endpoint,date),JSON.stringify(all))}
 function restore(endpoint,date,storage=root.localStorage){storage.removeItem(key(endpoint,date))}
 const api={visible,remove,restore,count:(endpoint,date,storage)=>read(endpoint,date,storage).length};if(typeof module==='object')module.exports=api;else root.MirsadLetterList=api;
})(globalThis);
