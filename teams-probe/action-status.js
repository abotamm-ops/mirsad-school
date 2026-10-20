/* Toolbar color follows persisted monitoring state, independently of popup lifetime. */
var MirsadActionStatus=(()=>{
 const KEY='mirsadAutoRun';let serial=Promise.resolve(),lastState;
 async function paint(){if(!chrome.action)return;const saved=await chrome.storage.local.get(KEY),running=saved[KEY]?.running===true;if(lastState===running)return;const state=running?'on':'off',path=Object.fromEntries([16,32,48,128].map(size=>[size,`icons/${state}-${size}.png`]));await Promise.all([chrome.action.setIcon({path}),chrome.action.setTitle({title:running?'مرصاد — الرصد يعمل (يشمل انتظار الحصص)':'مرصاد — الرصد متوقف'})]);lastState=running}
 function refresh(){serial=serial.catch(()=>{}).then(paint).catch(()=>{});return serial}
 chrome.storage.onChanged?.addListener((changes,area)=>{if(area==='local'&&changes[KEY])void refresh()});
 chrome.runtime.onStartup?.addListener(()=>void refresh());chrome.runtime.onInstalled?.addListener(()=>void refresh());
 void refresh();return {refresh};
})();
