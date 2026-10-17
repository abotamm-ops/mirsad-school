(() => {
 if (window.__mirsadAutoReportBridge) return;
 window.__mirsadAutoReportBridge = true;
 window.addEventListener("message", event => {
  if (event.source !== window || event.origin !== location.origin ||
      event.data?.source !== "mirsad-auto-report" || event.data?.type !== "GET_REPORT") return;
  chrome.runtime.sendMessage({type:"MIRSAD_GET_LIVE_REPORT"}, response => {
   const payload = chrome.runtime.lastError ? {ok:false,error:chrome.runtime.lastError.message} : response;
   window.postMessage({source:"mirsad-auto-report",type:"REPORT_DATA",payload},location.origin);
  });
 });
})();