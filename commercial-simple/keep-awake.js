/* Chrome's display lock also prevents idle system sleep; it never overrides manual sleep. */
var MirsadKeepAwake=(()=>{'use strict';
 const keys=['mirsadAutoRun','mirsadSimpleDaily','mirsadSimpleRunControl','mirsadDriveConfig'];let dirty=false,flight=null,held=null;
 function needed(s){const run=s.mirsadAutoRun,control=s.mirsadSimpleRunControl;return !!s.mirsadDriveConfig?.key&&!run?.paused&&!['paused','stopped'].includes(control?.mode)&&!!(run?.running&&!run.paused||s.mirsadSimpleDaily?.armed)}
 function refresh(){dirty=true;if(flight)return flight;flight=(async()=>{while(dirty){dirty=false;const s=await chrome.storage.local.get(keys),want=needed(s);if(want===held)continue;try{if(want)await chrome.power.requestKeepAwake('display');else await chrome.power.releaseKeepAwake();held=want;await chrome.storage.local.set({mirsadKeepAwakeStatus:{active:want,at:Date.now()}})}catch(error){held=null;await chrome.storage.local.set({mirsadKeepAwakeStatus:{active:false,error:error.message||'لم يتأكد منع السكون؛ اضبط إعدادات الطاقة يدويًا',at:Date.now()}})}}})().finally(()=>{flight=null;if(dirty)void refresh()});return flight}
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&keys.some(k=>k in changes))void refresh()});
 chrome.runtime.onStartup?.addListener(()=>{held=null;void refresh()});
 void refresh();return {refresh,needed};
})();
