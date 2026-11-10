/* Visible website device time; an offline gap is never counted as usage. */
(()=>{'use strict';const C=globalThis.MirsadCommercialConfig;if(!C)return;let busy=false,pending=null,last='';
 async function pulse(active=document.visibilityState==='visible'){
  const key=localStorage.getItem(C.sessionKey)||'';if(!key)return;if(busy){pending=active;return}busy=true;
  try{const result=await C.api('commercialWebsiteActivity',{active});if(key!==localStorage.getItem(C.sessionKey))return;last=key;if(result.settings)window.dispatchEvent(new CustomEvent('mirsad-portal-settings',{detail:{session:key,settings:result.settings}}))}catch{}finally{busy=false;if(pending!==null){const next=pending;pending=null;void pulse(next)}}
 }
 const timer=setInterval(()=>{if(document.visibilityState==='visible')void pulse(true)},60000);
 document.addEventListener('visibilitychange',()=>void pulse());
 window.addEventListener('mirsad-admin-login',()=>void pulse());window.addEventListener('focus',()=>void pulse());
 window.addEventListener('pagehide',()=>{clearInterval(timer);void pulse(false)});
 window.addEventListener('storage',e=>{if(e.key===C.sessionKey&&last!==e.newValue)void pulse()});
 if(document.getElementById('profilePanel'))new MutationObserver(()=>{if(!document.getElementById('profilePanel').hidden)void pulse()}).observe(document.getElementById('profilePanel'),{attributes:true,attributeFilter:['hidden']});
 void pulse();
})();
