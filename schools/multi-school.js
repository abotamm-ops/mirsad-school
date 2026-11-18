/* Per-tab school selection; the server validates membership and never changes the recorder's school here. */
(()=>{'use strict';const C=globalThis.MirsadCommercialConfig;if(!C)return;
 let feature=null;const scoped=new Set(['adminLogin','dates','day','teacherLink','teachersLive','getTimetableSource','previewTimetable','resetState','scheduleVersions','getAutoLinksControl','videoStatus','commercialEvidence','commercialSchoolSettings','videoConfigure','manualLessonLink','reportSchedule','override','setSeventhPeriod','restoreArchivedSchedule','setAutoLinksControl']);
 const account=()=>/^a\.([a-f0-9-]{36})\./.exec(C.session?.()||'')?.[1]||'',key=()=> 'mirsad-view-school:'+account();
 function selected(){
  const values=[new URL(location.href).searchParams.get('siteId'),sessionStorage.getItem(key()),globalThis.MirsadSchoolAccount?.activeSiteId];
  return values.find(id=>id&&!id.startsWith('archive-'))||'';
 }
 globalThis.MirsadSchoolViewScope=()=>{let sites=[];try{sites=JSON.parse(sessionStorage.getItem('mirsad-site-metadata:'+account())||'[]')}catch{}const id=selected()||'unselected',site=sites.find(x=>x.id===id)||globalThis.MirsadSchoolAccount?.sites?.find(x=>x.id===id);return {account:account(),id,localId:site?.localId||id,multi:feature!==false,legacy:feature===false||site?.legacy===true}};
 sessionStorage.removeItem('mirsad-school-profile-v2');globalThis.MirsadSchoolProfile={};
 const fetchOriginal=globalThis.fetch.bind(globalThis);globalThis.fetch=async(url,options={})=>{let body;try{body=JSON.parse(options.body)}catch{return fetchOriginal(url,options)}const site=selected();if(site&&scoped.has(body.action)&&/^https:\/\/script\.google\.com\/macros\//.test(String(url)))options={...options,body:JSON.stringify({...body,siteId:body.siteId||site})};return fetchOriginal(url,options)};
 let busy=false;async function show(){if(busy||!C.session?.()||!account())return;busy=true;try{const versionResponse=await fetchOriginal(C.endpoint(),{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'commercialServiceVersion'}),signal:AbortSignal.timeout(25000)}),version=await versionResponse.json();if(!version.ok)return;feature=version.multiSchoolAccounts===true;if(!feature)return;const list=await C.api('commercialSchoolSpaces');if(!list.sites?.length)return;sessionStorage.setItem('mirsad-site-metadata:'+account(),JSON.stringify(list.sites));
  const id=list.activeSiteId||list.sites[0].id;
  const url=new URL(location.href);
  const requested=url.searchParams.get('siteId');
  if(requested&&requested!==id){url.searchParams.set('siteId',id);location.replace(url.href);return}
  sessionStorage.setItem(key(),id);document.documentElement.dataset.mirsadSiteId=id;
  if(!document.getElementById('mirsad-school-selector')){
   const box=document.createElement('div');box.id='mirsad-school-selector';box.style.cssText='padding:8px 16px;font:14px Tahoma,Arial;background:#edf7f5';
   box.textContent='المدرسة الحالية';document.body.prepend(box);
  }

 }catch(error){/* Existing login UI handles expired sessions and old services. */}finally{busy=false}}
 window.addEventListener('mirsad-admin-login',()=>void show());void show();
})();
