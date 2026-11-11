var MirsadVideoStore=(()=>{
 let pending;
 function db(){return pending||(pending=new Promise((resolve,reject)=>{const r=indexedDB.open('mirsad-videos-v1',1);r.onupgradeneeded=()=>{const d=r.result;d.createObjectStore('clips',{keyPath:'id'});const chunks=d.createObjectStore('chunks',{keyPath:['id','index']});chunks.createIndex('clip','id')};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)}))}
 async function transact(store,mode,operation){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(store,mode),r=operation(tx.objectStore(store));tx.oncomplete=()=>resolve(r?.result);tx.onerror=()=>reject(tx.error||r?.error);tx.onabort=()=>reject(tx.error||Error('تعذر حفظ مقطع الفيديو'))})}
 const get=id=>transact('clips','readonly',s=>s.get(id));
 const put=clip=>transact('clips','readwrite',s=>s.put(clip));
 async function patch(id,change){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction('clips','readwrite'),s=tx.objectStore('clips'),r=s.get(id);let next;r.onsuccess=()=>{if(!r.result){tx.abort();return}next={...r.result,...change};s.put(next)};tx.oncomplete=()=>resolve(next);tx.onerror=tx.onabort=()=>reject(tx.error||Error('المقطع غير موجود أو تعذر تحديثه'))})}
 async function blob(id){const chunks=await transact('chunks','readonly',s=>s.index('clip').getAll(id));chunks.sort((a,b)=>a.index-b.index);const clip=await get(id);return new Blob(chunks.map(c=>c.data),{type:clip.mime||'video/webm'})}
 async function prune(id){const d=await db();return new Promise((resolve,reject)=>{const tx=d.transaction(['clips','chunks'],'readwrite'),r=tx.objectStore('clips').get(id);r.onsuccess=()=>{if(!r.result?.localSaved||!r.result?.driveSaved)return;const cursor=tx.objectStore('chunks').index('clip').openCursor(id);cursor.onsuccess=()=>{const c=cursor.result;if(c){c.delete();c.continue()}}};tx.oncomplete=()=>resolve();tx.onerror=tx.onabort=()=>reject(tx.error)})}
 return {get,put,patch,blob,prune,list:()=>transact('clips','readonly',s=>s.getAll()),chunk:(id,index,data)=>transact('chunks','readwrite',s=>s.put({id,index,data}))};
})();
