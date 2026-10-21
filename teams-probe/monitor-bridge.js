// Status-only bridge. A page can control only the environment currently selected in the extension.
(()=>{if(window.__mirsadMonitorBridge)return;window.__mirsadMonitorBridge=true;
 const experimentId=new URLSearchParams(location.search).get('experiment')||'';
 const send=(type,payload)=>window.postMessage({source:'mirsad-monitor-extension',type,payload},location.origin);
 function scoped(message,callback){chrome.runtime.sendMessage({type:'MIRSAD_EXPERIMENT_INFO'},e=>{if(chrome.runtime.lastError||String(e?.experimentId||'')!==experimentId){callback({ok:false,error:'هذه الصفحة تخص مساحة رصد أخرى؛ بدّل الوضع من الإضافة'});return}chrome.runtime.sendMessage(message,r=>callback(chrome.runtime.lastError?{ok:false}:r))})}
 const requestActivity=()=>scoped({type:'MIRSAD_SCAN_ACTIVITY'},r=>send('activity',r));
 chrome.storage?.onChanged?.addListener((changes,area)=>{if(area==='local'&&Object.keys(changes).some(k=>k==='mirsadEnvironment'||k.endsWith('mirsadActiveScan')))requestActivity()});
 chrome.runtime.onMessage.addListener(m=>{if(m?.type==='MIRSAD_MONITOR_CHANGED')send('changed',{})});
 window.addEventListener('message',event=>{if(event.source!==window||event.origin!==location.origin||event.data?.source!=='mirsad-monitor-control')return;const d=event.data;if(d.type==='state'){requestActivity();scoped({type:'MIRSAD_GET_LIVE_REPORT'},r=>send('state',r))}if(d.type==='schedule')scoped({type:'MIRSAD_DASHBOARD_SCHEDULE',settings:d.settings},r=>send('settings',r));if(d.type==='rounds')scoped({type:'MIRSAD_DASHBOARD_ROUNDS',count:d.count,gap:d.gap,thirdGap:d.thirdGap},r=>send('settings',r))});
})();
