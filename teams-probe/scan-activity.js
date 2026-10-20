/* Ephemeral UI activity follows the real Teams tab, not attendance results or upload state. */
var MirsadScanActivity=(()=>{
 const KEY='mirsadActiveScan';let serial=Promise.resolve();
 function queue(fn){const result=serial.catch(()=>{}).then(fn);serial=result.catch(()=>{});return result}
 async function read(){return (await chrome.storage.local.get(KEY))[KEY]||null}
 async function clearTab(tabId){return queue(async()=>{const current=await read();if(current?.tabId===tabId)await chrome.storage.local.set({[KEY]:null})})}
 function open(tabId,run){const current=run?.current;if(!current||!Number.isInteger(tabId))return Promise.resolve();const activity={active:true,tabId,scanId:current.scanId,teacher:current.teacher,teacherId:current.teacherId||null,date:MirsadMonitorModel.day(),period:run.period,cycle:run.cycle,openedAt:Date.now()};return queue(async()=>{try{await chrome.tabs.get(tabId);await chrome.storage.local.set({[KEY]:activity})}catch{await chrome.storage.local.set({[KEY]:null})}})}
 async function info(){await serial;const activity=await read();if(!activity)return {ok:true,activity:null};try{await chrome.tabs.get(activity.tabId);return {ok:true,activity}}catch{await clearTab(activity.tabId);return {ok:true,activity:null}}}
 chrome.tabs.onRemoved?.addListener(tabId=>{void clearTab(tabId).catch(()=>{})});
 chrome.runtime.onStartup?.addListener(()=>{void info().catch(()=>{})});
 return {open,clearTab,info};
})();
