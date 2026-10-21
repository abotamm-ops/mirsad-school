/* The same attendance engine, with separate persistent stores for each full-day experiment. */
var MirsadEnvironment=(()=>{
 const raw=chrome.storage.local,KEY='mirsadEnvironment',shared=new Set(['mirsadDriveConfig']),valid=id=>typeof id==='string'&&/^[a-f0-9-]{36}$/.test(id);let changing=false;
 async function info(){const all=await raw.get(KEY),v=all[KEY];if(v?.experimentId&&!valid(v.experimentId))throw new Error('معرّف التجربة غير صالح');return v?.experimentId?{environment:'experiment',experimentId:v.experimentId}:{environment:'official'}}
 const prefix=e=>e.experimentId?'mirsadExperiment:'+e.experimentId+':':'';
 async function get(keys){const e=await info(),p=prefix(e),all=await raw.get(keys===null||keys===undefined?null:(typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys)).map(k=>shared.has(k)?k:p+k)),names=keys===null||keys===undefined?Object.keys(all).filter(k=>p?k.startsWith(p):!k.startsWith('mirsadExperiment:')):typeof keys==='string'?[keys]:Array.isArray(keys)?keys:Object.keys(keys),out={};for(const k of names){const name=p&&k.startsWith(p)?k.slice(p.length):k;const mapped=shared.has(name)?name:p+name;if(Object.prototype.hasOwnProperty.call(all,mapped))out[name]=all[mapped];else if(keys&&typeof keys==='object'&&!Array.isArray(keys))out[name]=keys[name]}return out}
 async function set(values){const p=prefix(await info());await raw.set(Object.fromEntries(Object.entries(values).map(([k,v])=>[shared.has(k)?k:p+k,v])))}
 async function select(experimentId){if(experimentId&&!valid(experimentId))throw new Error('معرّف التجربة غير صالح');await raw.set({[KEY]:experimentId?{experimentId}:{}})}
 async function backupOfficial(){const all=await raw.get(null),snapshot={};for(const [k,v] of Object.entries(all))if(!k.startsWith('mirsadExperiment:')&&!k.startsWith('mirsadOfficialBackup:')&&k!==KEY)snapshot[k]=v;const id='mirsadOfficialBackup:'+Date.now();await raw.set({[id]:snapshot});const checked=await raw.get(id);if(JSON.stringify(checked[id])!==JSON.stringify(snapshot))throw new Error('تعذر التحقق من النسخة الاحتياطية؛ لم يبدأ وضع التجربة');return snapshot}
 return {info,prefix,get,set,select,backupOfficial,get changing(){return changing},set changing(v){changing=v}};
})();
var MirsadStore={get:keys=>MirsadEnvironment.get(keys),set:values=>MirsadEnvironment.set(values)};
