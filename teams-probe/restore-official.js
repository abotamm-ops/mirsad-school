/* Restore the original storage and paused progress; retain all archived experiment files and records. */
var MirsadOfficialReady=(async()=>{
 const saved=await chrome.storage.local.get(['mirsadEnvironment','mirsadAutoRun']);
 const id=saved.mirsadEnvironment?.experimentId;if(!id)return;
 if(typeof id!=='string'||!/^[a-f0-9-]{36}$/.test(id))throw new Error('تعذر تحديد مساحة الرصد القديمة بأمان');
 const key='mirsadExperiment:'+id+':mirsadAutoRun',trial=(await chrome.storage.local.get(key))[key];
 await chrome.alarms.clear('mirsadNextAction');await chrome.alarms.clear('mirsadScanTimeout');
 if(trial){
  const tabIds=[...new Set([trial.tabId,...(trial.probeTabIds||[])].filter(Number.isInteger))];
  await chrome.storage.local.set({[key]:{...trial,running:false,paused:true,autoResume:false,current:null,tabId:null,probeTabIds:[]}});
  for(const tabId of tabIds)try{await chrome.tabs.remove(tabId)}catch{}
 }
 await chrome.storage.local.set({mirsadEnvironment:{},mirsadOfficialRestoredAt:Date.now()});
})();
