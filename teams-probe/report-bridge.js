(() => {
 if (window.__mirsadAutoReportBridge) return;
 window.__mirsadAutoReportBridge = true;
 window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== location.origin ||
      event.data?.source !== "mirsad-auto-report") return;
  if(event.data.type==="GET_REPORT"){
   chrome.runtime.sendMessage({type:"MIRSAD_GET_LIVE_REPORT"}, response => {
    const payload = chrome.runtime.lastError ? {ok:false,error:chrome.runtime.lastError.message} : response;
    window.postMessage({source:"mirsad-auto-report",type:"REPORT_DATA",payload},location.origin);
   });
  } else if(event.data.type==="SAVE_SCHEDULE_SETTINGS"){
   chrome.runtime.sendMessage({type:"MIRSAD_SAVE_SCHEDULE_SETTINGS",settings:event.data.settings}, response=>{
    const payload=chrome.runtime.lastError?{ok:false}:response;
    if(payload?.ok)payload.message="تم حفظ إعدادات التوقيت اليدوي. إذا كان الرصد ينتظر، يعيد حساب الموعد؛ وإذا كان يفحص رابطًا الآن، تُطبّق الإعدادات الجديدة بعد انتهائه.";
    window.postMessage({source:"mirsad-auto-report",type:"SCHEDULE_SETTINGS_SAVED",payload},location.origin);
   });
  } else if(event.data.type==="SAVE_MAPPING"){
   chrome.runtime.sendMessage({type:"MIRSAD_SAVE_MAPPING",teamsName:event.data.teamsName,teacher:event.data.teacher}, response=>{
    window.postMessage({source:"mirsad-auto-report",type:"MAPPING_SAVED",payload:chrome.runtime.lastError?{ok:false}:response},location.origin);
   });
  } else if(event.data.type==="SET_MANUAL_STATUS"){
   chrome.runtime.sendMessage({type:"MIRSAD_SET_MANUAL_STATUS",day:event.data.day,period:event.data.period,teacher:event.data.teacher,status:event.data.status}, response=>{
    window.postMessage({source:"mirsad-auto-report",type:"MANUAL_STATUS_SAVED",payload:chrome.runtime.lastError?{ok:false}:response},location.origin);
   });
  }
 });
})();
