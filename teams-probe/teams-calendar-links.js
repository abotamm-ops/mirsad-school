/* Enrich the existing Madrasati snapshot. Calendar fields never replace school/lesson metadata. */
var MirsadCalendarLinks=(()=>{
 const ACTIVE='mirsadDriveDay',STATE='mirsadTeamsCalendarState',PENDING='mirsadTeamsCalendarPending',PREVIEW='mirsadCalendarLinkPreview';let working=null,active=null;
 const today=()=>MirsadMonitorModel.day(),norm=s=>MirsadMonitorModel.normalize(s),key=(name,period)=>norm(name)+'|'+Number(period);
 const stopError=()=>Object.assign(Error('توقف فحص التقويم لإعطاء تيمز أولوية الرصد'),{cancelled:true});
 async function state(text,error=false,extra={}){const {day,...meta}=extra;await chrome.storage.local.set({[STATE]:{date:today(),at:Date.now(),text,error,running:false,...meta}});return {note:text,error,...extra}}
 function bounded(promise,deadline){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(stopError()),Math.max(1,deadline-Date.now()))})]).finally(()=>clearTimeout(timer))}
 async function cancel(){if(!active)return false;active.cancelled=true;active.controller?.abort();try{await chrome.tabs.sendMessage(active.tabId,{type:'MIRSAD_TEAMS_CALENDAR_CANCEL',requestId:active.id})}catch{}return true}
 async function canRead(revision,date,deadline){if(Date.now()>=deadline)return false;const s=(await chrome.storage.local.get(ACTIVE))[ACTIVE],r=await getRun();return s?.date===date&&s.snapshot?.scheduleRevision===revision&&(!r?.running||r.paused||!r.current&&r.waitingForCycle2)}
 async function findCalendar(date,deadline){const tabs=await bounded(chrome.tabs.query({url:['https://teams.microsoft.com/*','https://teams.live.com/*']}),deadline),run=await getRun(),scanIds=new Set([run?.tabId,...(run?.probeTabIds||[])].filter(Number.isInteger));
  const calendars=[];for(const tab of tabs.slice(0,32)){if(Date.now()>=deadline)throw stopError();if(scanIds.has(tab.id))continue;try{const r=await bounded(chrome.tabs.sendMessage(tab.id,{type:'MIRSAD_TEAMS_CALENDAR_PROBE'}),Math.min(deadline,Date.now()+2000));if(r?.ok&&r.isCalendar)calendars.push({tab,date:r.date})}catch{}}
  return calendars.find(x=>x.date===date)?.tab||calendars.find(x=>!x.date)?.tab||null;
 }
 function candidates(events,snapshot){const lessons=new Map();for(const l of snapshot.lessons||[]){const k=key(l.teacherName,l.period);if(lessons.has(k))lessons.set(k,null);else lessons.set(k,l)}
  const grouped=new Map();let same=0,unmatched=0;const titleMismatches=[];for(const e of events||[]){const k=key(e.teacherName,e.period),lesson=lessons.get(k),url=MirsadScheduleCore.normalizeTeamsUrl(e.url);if(!lesson||!url||!Number.isInteger(Number(e.period))){unmatched++;continue}const title=v=>norm(v).replace(/[\p{P}\p{S}]/gu,' ').replace(/\s+/g,' ').trim();if(e.title&&lesson.subject&&title(e.title)!==title(lesson.subject))titleMismatches.push(lesson.teacherName+' — الحصة '+lesson.period);if(MirsadScheduleCore.sameTeamsMeeting(lesson.url,url)){same++;continue}if(!grouped.has(k))grouped.set(k,new Map());grouped.get(k).set(MirsadScheduleCore.teamsMeetingKey(url),{teacherName:lesson.teacherName,period:lesson.period,url,eventId:String(e.eventId||'').slice(0,240)})}
  const entries=[];let ambiguous=0;for(const urls of grouped.values())if(urls.size===1)entries.push([...urls.values()][0]);else ambiguous++;
  return {entries,same,unmatched,ambiguous,titleMismatches};
 }
 async function previewBinding(){const c=(await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig||{},bytes=new TextEncoder().encode(JSON.stringify(c));return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('')}
 async function previewFor(day){const p=(await chrome.storage.local.get(PREVIEW))[PREVIEW];return p?.date===day?.date&&p.revision===day?.snapshot?.scheduleRevision&&p.sourceDate===(day.snapshot.sourceScheduleDate||day.date)&&p.binding===await previewBinding()?p.entries:[]}
 async function execute(day,options){const snapshot=day?.snapshot,date=day?.date;if(date!==today()||snapshot?.sourceType!=='madrasati')return state('جدول مدرستي الحالي غير جاهز لمطابقة التقويم.',true);
  const sourceDate=snapshot.sourceScheduleDate||date,run=await getRun(),deadline=Math.min(Date.now()+90000,run?.running&&!run.paused?Number(run.nextCycleAt)||Date.now():Infinity)-1000;
  const binding=async()=>JSON.stringify((await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig||{}),initialBinding=await binding();const allowed=async()=>await binding()===initialBinding&&await canRead(snapshot.scheduleRevision,date,deadline)&&(!options.automatic||await globalThis.MirsadAutoLinks?.isEnabled?.());
  if(!await allowed()){await chrome.storage.local.set({[PENDING]:{date,revision:snapshot.scheduleRevision}});return state('ستُفحص روابط تقويم تيمز في فاصل الدورات، دون التأثير على الرصد الحالي.',false,{deferred:true})}
  await state('جارٍ البحث عن تقويم تيمز المفتوح…',false,{running:true});
  if(!await allowed())return state('أُجلت مطابقة التقويم لإعطاء الرصد أولوية.',false,{deferred:true});
  const tab=await findCalendar(sourceDate,deadline);if(!tab)return state('افتح تقويم تيمز بعرض اليوم وتاريخ جدول مدرستي؛ لم تُضف روابط من التقويم.',true);
  if(!await allowed())return state('أُجلت مطابقة التقويم حتى فاصل الدورات التالي.',false,{deferred:true});
  const id=crypto.randomUUID();active={id,tabId:tab.id,cancelled:false,controller:typeof AbortController==='function'?new AbortController():null};
  try{
   await state('جارٍ مطابقة تقويم تيمز حسب اسم المعلم وترتيب الحصة…',false,{running:true});
   if(active.cancelled||!await allowed())throw stopError();
   const result=await bounded(chrome.tabs.sendMessage(tab.id,{type:'MIRSAD_TEAMS_CALENDAR_READ',date:sourceDate,teachers:[...new Set((snapshot.lessons||[]).map(l=>l.teacherName))],requestId:id,deadlineAt:deadline}),deadline);
   if(active.cancelled||!await allowed())throw stopError();
   if(!result?.ok)throw Error(result?.error||result?.warnings?.join('؛ ')||'لم تتأكد قراءة تقويم تيمز؛ بقيت روابط مدرستي كما هي');if(result.date!==sourceDate)throw Error('تاريخ تقويم تيمز لا يطابق تاريخ جدول مدرستي');
   const match=candidates(result.events,snapshot);let saved=null;if(globalThis.MirsadCalendarPilot?.localOnly){await chrome.storage.local.set({[PREVIEW]:{date,sourceDate,revision:snapshot.scheduleRevision,binding:await previewBinding(),at:Date.now(),entries:match.entries}});saved={added:match.entries.length,preview:true}}else if(match.entries.length){if(typeof CloudMonitoring.addCalendarLinks!=='function')throw Error('حدّث الإضافة وسكربت الخدمة لدعم رابط التقويم الإضافي');saved=await bounded(CloudMonitoring.addCalendarLinks(match.entries,{date,sourceDate,expectedRevision:snapshot.scheduleRevision,deadlineAt:deadline,...(active.controller?{signal:active.controller.signal}:{})}),deadline)}
   if(active.cancelled||!await allowed())throw stopError();
   await chrome.storage.local.remove(PENDING);const added=Number(saved?.added)||0,warnings=[...(result.warnings||[])];if(match.ambiguous)warnings.push('توجد روابط متعددة غير محسومة لـ '+match.ambiguous+' حصة');if(match.unmatched)warnings.push('لم تُطابق '+match.unmatched+' مواعيد');if(match.titleMismatches.length)warnings.push('عنوان الدرس مختلف للمراجعة: '+[...new Set(match.titleMismatches)].slice(0,3).join('، '));
   return state((saved?.preview&&added?'عُثر على '+added+' رابط تقويم مختلف للتجربة فقط؛ لم يُعدّل جدول مدرستي.':added?'أُضيف '+added+' رابط من تقويم تيمز بجانب روابط مدرستي.':match.same?'روابط تقويم تيمز المطابقة هي نفس روابط مدرستي؛ لم تُكرّر.':'اكتمل فحص تقويم تيمز؛ لا رابط إضافي جديد.')+(warnings.length?' ملاحظات: '+warnings.slice(0,3).join('؛ '):''),false,{added,warnings,preview:saved?.preview===true,day:saved?.day||null});
  }catch(e){return state(e.cancelled?e.message:'لم تُضف روابط التقويم: '+e.message,!e.cancelled)}finally{void cancel();active=null}
 }
 async function refresh(day,options={}){day=day||(await chrome.storage.local.get(ACTIVE))[ACTIVE];const binding=JSON.stringify((await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig||{}),identity=[binding,day?.date,day?.snapshot?.sourceScheduleDate,day?.snapshot?.scheduleRevision].join('|');
  if(working){if(working.identity===identity)return working.promise;const previous=working;await cancel();await previous.promise;return refresh(day,options)}
  const job={identity,promise:null};working=job;job.promise=execute(day,options).catch(e=>state('تعذرت مطابقة التقويم: '+e.message,true)).finally(()=>{if(working===job)working=null});return job.promise;
 }
 async function enrichImport(result,payload){if(!result?.day?.snapshot)return result;try{const extra=await refresh(result.day);return {...result,...(extra.day?{day:extra.day}:{}),calendarNote:extra.note,calendarAdded:extra.added||0}}catch(e){return {...result,calendarNote:'لم تُقرأ روابط التقويم: '+e.message}}}
 chrome.storage.onChanged?.addListener((changes,area)=>{if(area!=='local')return;if(changes.mirsadDriveConfig){void cancel();void chrome.storage.local.remove(PREVIEW)}if(changes.mirsadAutoLinksEnabled?.newValue===false)void cancel();const run=changes.mirsadAutoRun?.newValue;if(run?.running&&!run.paused&&(run.current||!run.waitingForCycle2))void cancel();if(run?.running&&!run.current&&run.waitingForCycle2)void chrome.storage.local.get(PENDING).then(s=>{if(s[PENDING]?.date===today())void (async()=>{if(await globalThis.MirsadAutoLinks?.isEnabled?.())await refresh(null,{automatic:true})})()})});
 async function diagnostic(){const tabs=await chrome.tabs.query({url:['https://teams.microsoft.com/*','https://teams.live.com/*']}),run=await getRun(),excluded=new Set([run?.tabId,...(run?.probeTabIds||[])].filter(Number.isInteger));let chosen=tabs.find(t=>t.active&&!excluded.has(t.id));
  if(!chosen){const day=(await chrome.storage.local.get(ACTIVE))[ACTIVE];chosen=await findCalendar(day?.snapshot?.sourceScheduleDate||today(),Date.now()+6000)}
  if(!chosen)throw Error('افتح تقويم تيمز في تبويب مستقل ثم اضغط تقرير الفحص');
  const report=await bounded(chrome.tabs.sendMessage(chosen.id,{type:'MIRSAD_TEAMS_CALENDAR_DIAGNOSTIC',explicitUserRequest:true}),Date.now()+6000);if(!report?.ok||!report.nodes?.length)throw Error('لم يظهر تقرير الصفحة؛ أعد تحميل تبويب التقويم بعد تحديث الإضافة ثم حاول مجددًا');
  const body=JSON.stringify({version:1,at:new Date().toISOString(),...report},null,2);await chrome.downloads.download({url:'data:application/json;charset=utf-8,'+encodeURIComponent(body),filename:'Mirsad-Calendar-Check.json',saveAs:true});return {ok:true,text:'تم تنزيل تقرير فحص التقويم. أرسله للدعم لاستكمال مطابقة شكل التقويم.'};
 }
 chrome.runtime?.onMessage?.addListener((m,sender,reply)=>{if(sender.tab||!['MIRSAD_TEAMS_CALENDAR_INFO','MIRSAD_TEAMS_CALENDAR_REFRESH','MIRSAD_TEAMS_CALENDAR_DIAGNOSTIC_EXPORT'].includes(m?.type))return;if(m.type==='MIRSAD_TEAMS_CALENDAR_DIAGNOSTIC_EXPORT'){diagnostic().then(reply).catch(e=>reply({ok:false,error:e.message}));return true}if(m.type==='MIRSAD_TEAMS_CALENDAR_INFO'){chrome.storage.local.get(STATE).then(s=>reply({ok:true,state:s[STATE]||null}));return true}void refresh();reply({ok:true,started:true});return false});
 return {refresh,enrichImport,cancel,candidates,previewFor,diagnostic};
})();
