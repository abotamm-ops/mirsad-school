/* OS session lock only: idle does not mean locked, and API failure stays unknown. */
var MirsadDeviceState=(()=>{
 async function read(){return new Promise(resolve=>{let done=false;const finish=state=>{if(done)return;done=true;clearTimeout(timer);resolve({sessionState:['active','idle','locked'].includes(state)?state:'unknown'})};const timer=setTimeout(()=>finish('unknown'),1500);try{if(!chrome.idle?.queryState){finish('unknown');return}chrome.idle.queryState(60,state=>finish(chrome.runtime.lastError?'unknown':state))}catch{finish('unknown')}})}
 chrome.idle?.onStateChanged?.addListener(()=>{if(typeof MirsadLiveSender!=='undefined')void MirsadLiveSender.sync(true)});
 return {read};
})();
