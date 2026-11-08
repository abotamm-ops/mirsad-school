/* Workspace routing only: never changes scan results or selects the dashboard during capture. */
var MirsadWorkspace = (() => {
 const page=chrome.runtime.getManifest().name.includes('المدارس')?'/schools/automatic-monitoring.html':'/automatic-monitoring.html';
 const url='https://mirsad-school.onrender.com'+page;
 const dashboard=t=>{try{const u=new URL(t.url||t.pendingUrl);return u.origin==='https://mirsad-school.onrender.com'&&u.pathname===page}catch{return false}};
 async function find(run){
  const tabs=(await chrome.tabs.query({url:url+'*'})).filter(dashboard);
  const own=tabs.find(t=>t.windowId===run?.workspaceWindowId)||tabs.find(t=>t.active)||tabs[0];
  if(own)return own;
  let windowId=run?.workspaceWindowId;
  if(Number.isInteger(windowId))try{await chrome.windows.get(windowId)}catch{windowId=null}
  if(!Number.isInteger(windowId)){const list=await chrome.tabs.query({url:'https://schools.madrasati.sa/SchoolManagment/Teachers*'});windowId=list[0]?.windowId}
  return chrome.tabs.create({url,active:false,...Number.isInteger(windowId)?{windowId}:{}});
 }
 async function ensureProbeTab(run){
  await MadrasatiSource.cancelAutomatic?.();
  const valid=async()=>{if(typeof isRunCurrent==='function')return isRunCurrent(run);const latest=await getRun();return !!latest?.running&&!latest.paused&&latest.startedAt===run.startedAt};
  if(!await valid())return null;
  const home=await find(run);if(!await valid())return null;
  run.workspaceWindowId=home.windowId;
  let tab;
  if(Number.isInteger(run.tabId))try{const candidate=await chrome.tabs.get(run.tabId);if(await MirsadTabOwnership.reusable(candidate))tab=candidate;else run.tabId=null}catch{run.tabId=null}
  if(tab){await chrome.tabs.update(tab.id,{pinned:false});tab=await chrome.tabs.move(tab.id,{windowId:home.windowId,index:-1})}
  else tab=await MirsadTabOwnership.claimProbe(await chrome.tabs.create({url:'about:blank',active:false,windowId:home.windowId,index:Math.max(0,(await chrome.tabs.query({windowId:home.windowId})).length)}));
  if(!await valid()){if(run.tabId!==tab.id)await MirsadTabOwnership.closeProbe(tab.id).catch(()=>{});return null}
  run.tabId=tab.id;if(await saveRun(run)===false)return null;return tab.id;
 }
 async function prepareCapture(id){
  const tab=await chrome.tabs.get(id);
  if(!/^https:\/\/(teams\.microsoft\.com|teams\.live\.com)\//i.test(tab.url||''))throw Error('التصوير مخصص لتبويب تيمز فقط');
  const homes=(await chrome.tabs.query({url:url+'*'})).filter(dashboard);
  const home=homes.find(t=>t.windowId===tab.windowId)||homes[0];
  if(!home)throw Error('افتح جدول مرصاد في نافذة الرصد قبل التصوير');
  await chrome.tabs.update(id,{pinned:false});await chrome.tabs.move(id,{windowId:home.windowId,index:-1});
  await chrome.tabs.update(id,{active:true});await chrome.windows.update(home.windowId,{focused:true});
  return chrome.tabs.get(id);
 }
 async function captureTeams(id,scanId){
  const validScan=async()=>{const r=await getRun();return !!scanId&&r?.running&&!r.paused&&r.current?.scanId===scanId&&[r.tabId,...(r.probeTabIds||[])].includes(id)};
  if(!await validScan())throw Error('توقف الفحص أو تغير؛ لم تُعتمد الصورة');
  const tab=await chrome.tabs.get(id),active=(await chrome.tabs.query({windowId:tab.windowId,active:true}))[0];
  if(active?.id!==id||!/^https:\/\/(teams\.microsoft\.com|teams\.live\.com)\//i.test(tab.url||''))throw Error('لم يتأكد تبويب تيمز النشط؛ لم تُحفظ صورة خاطئة');
  const image=await chrome.tabs.captureVisibleTab(tab.windowId,{format:'png'});
  const after=(await chrome.tabs.query({windowId:tab.windowId,active:true}))[0];
  if(!await validScan()||after?.id!==id||after.url!==tab.url)throw Error('تغير التبويب أثناء التصوير؛ تُعاد المحاولة دون اعتماد الصورة');
  return image;
 }
 return {ensureProbeTab,prepareCapture,captureTeams};
})();
