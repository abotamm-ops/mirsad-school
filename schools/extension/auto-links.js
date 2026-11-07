/* Optional read/merge only. No replacement, no delete, no automatic login. */
var MirsadAutoLinks=(()=>{
 const PREF='mirsadAutoLinksEnabled',STAGED='mirsadAutoLinksStaged',STATE='mirsadAutoLinksState',NOTES='mirsadAutoLinksNotes',ALARM='mirsad-auto-links-five-minutes';let busy=false,applying=false;
 const today=()=>MirsadMonitorModel.day();
 const edition=chrome.runtime.getManifest().name.includes('المدارس')?'schools/':'';
 const home='/'+edition+'automatic-monitoring.html';
 const validSender=s=>{if(!s.tab)return s.id===chrome.runtime.id;try{const u=new URL(s.tab.url);return u.origin==='https://mirsad-school.onrender.com'&&u.pathname===home}catch{return false}};
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const missing=s=>(s?.lessons||[]).filter(l=>!MirsadScheduleCore.normalizeTeamsUrl(l.url)&&!MirsadMonitorModel.isExcludedPeriod(s.date,l.period,s)).length;
 async function scope(){const c=(await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig||{};return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode((c.url||'')+'|'+(c.key||''))))).map(v=>v.toString(16).padStart(2,'0')).join('')}
 async function note(text,kind='info'){const at=Date.now(),s=await chrome.storage.local.get(NOTES),notes=s[NOTES]||[];await chrome.storage.local.set({[NOTES]:[...notes,{at,date:today(),text,kind}].slice(-100),[STATE]:{at,date:today(),text,kind}})}
 async function info(){const s=await chrome.storage.local.get([PREF,STATE,NOTES,'mirsadDriveDay']);const day=s.mirsadDriveDay;return {ok:true,enabled:s[PREF]===true,missing:day?.date===today()?missing(day.snapshot):null,state:s[STATE]||null,notes:(s[NOTES]||[]).filter(n=>n.date===today()).slice(-15)}}
 async function enabled(){return (await chrome.storage.local.get(PREF))[PREF]===true}
 async function configure(on){if(typeof on!=='boolean')throw Error('خيار غير صالح');await chrome.storage.local.set({[PREF]:on});if(on){await chrome.alarms.create(ALARM,{periodInMinutes:5});await note('التحديث مفعّل: تُفحص صفحة المعلمين كل خمس دقائق طالما بقيت روابط ناقصة.')}else{await chrome.alarms.clear(ALARM);await chrome.storage.local.remove(STAGED);await note('تحديث الروابط التلقائي متوقف.')}return info()}
 async function health(tab){
  await chrome.tabs.reload(tab.id);const deadline=Date.now()+60000;
  while(Date.now()<deadline){if(!await enabled())throw Error('أُلغي تحديث الروابط');const t=await chrome.tabs.get(tab.id);if(t.status==='complete'&&!t.pendingUrl){let u;try{u=new URL(t.url)}catch{}if(!u||u.origin!=='https://schools.madrasati.sa'||!/^\/SchoolManagment\/Teachers\/?$/i.test(u.pathname))throw Error('جلسة مدرستي أو صفحة المعلمين غير جاهزة؛ سجّل الدخول وافتح قائمة المعلمين');try{const r=await chrome.tabs.sendMessage(tab.id,{type:'MIRSAD_MADRASATI_READ',kind:'directory'});if(r?.ok&&r.teachers?.length)return r;if(r?.error&&!r.retryable)throw Object.assign(Error(r.error),{fatal:true})}catch(e){if(e.fatal)throw e}}
   await pause(500);
  }throw Error('لم تتأكد جاهزية قائمة المعلمين بعد التحديث؛ بقي الجدول كما هو');
 }
 async function tick(){if(busy||applying||!await enabled())return;busy=true;try{
  const s=await chrome.storage.local.get(['mirsadDriveDay',STAGED]),d=s.mirsadDriveDay;
  if(d?.date!==today()||d.snapshot?.sourceType!=='madrasati')return;
  if(!missing(d.snapshot)){await chrome.storage.local.remove(STAGED);await chrome.storage.local.set({[STATE]:{at:Date.now(),date:today(),text:'اكتملت روابط اليوم؛ توقف تحديث صفحة مدرستي تلقائيًا.',complete:true}});return}
  const r=await getRun();
  const source=await MadrasatiSource.info();if(source.state?.running||source.pending)return;
  const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/SchoolManagment/Teachers*'}),tab=tabs.find(t=>t.windowId===r?.workspaceWindowId)||tabs[0];
  if(!tab)throw Error('صفحة معلمي مدرستي غير مفتوحة؛ لم يُفتح تبويب جديد ولم يتغير الجدول');
  const fingerprint=await scope(),revision=d.snapshot.scheduleRevision;await health(tab);
  if(!await enabled()||fingerprint!==await scope())return;
  await chrome.storage.local.set({[STATE]:{at:Date.now(),date:today(),text:'صفحة المعلمين سليمة؛ جارٍ فحص الروابط الناقصة…'}});
  const result=await MadrasatiSource.collect(today(),{collectOnly:true,directoryTabId:tab.id});
  if(!result?.payload||!await enabled()||fingerprint!==await scope())return;
  const current=(await chrome.storage.local.get('mirsadDriveDay')).mirsadDriveDay;
  if(current?.date!==today()||current.snapshot?.scheduleRevision!==revision)throw Error('تغير جدول اليوم أثناء الجمع؛ أُلغي التحديث ولم يُستبدل الجدول');
  await chrome.storage.local.set({[STAGED]:{date:today(),revision,scope:fingerprint,payload:result.payload,at:Date.now()}});
  await note('اكتملت قراءة مدرستي؛ ستُضاف الروابط الجديدة عند بداية الدورة التالية.');const idle=await getRun();if(idle?.running&&!idle.current&&!idle.waitingForCycle2&&!idle.periodItems?.length)await beforeCycle(idle);
 }catch(e){await note('لم يُحدّث الجدول: '+e.message,'warning')}finally{busy=false}}
 async function beforeCycle(run){if(applying||!await enabled())return;applying=true;try{
  const stored=await chrome.storage.local.get([STAGED,'mirsadDriveDay']),pending=stored[STAGED],d=stored.mirsadDriveDay;if(!pending)return;
  if(pending.date!==today()||d?.date!==today()||pending.revision!==d.snapshot?.scheduleRevision||pending.scope!==await scope()){await chrome.storage.local.remove(STAGED);return}
  const current=await getRun();if(!current?.running||current.paused||current.current||current.scheduleRevision!==pending.revision||run&&(current.startedAt!==run.startedAt||(current.controlEpoch??0)!==(run.controlEpoch??0)))return;
  if(!missing(d.snapshot)){await chrome.storage.local.remove(STAGED);return}
  // Only a delta merge against the existing revision; never stageImport/publish/reset.
  const r=await CloudMonitoring.fillMissingLinks(pending.payload,{requireExisting:true,expectedRevision:pending.revision});
  if(!r?.merged)throw Error('لم يتأكد تكميل الروابط؛ بقي الجدول الحالي');
  // Earlier versions omitted linkless lessons from run.schedule. Add verified new
  // lessons to the NEXT cycle queue, retaining every existing result and URL.
  if(r.filled&&r.day?.snapshot){const next=await getRun();if(!next?.running||next.paused||next.current||next.startedAt!==current.startedAt||(next.controlEpoch??0)!==(current.controlEpoch??0))return;
   const schedule=Array.isArray(next.schedule)?next.schedule.slice():[],settings=typeof scheduleSettings==='object'?scheduleSettings:{};
   for(const row of r.day.snapshot.lessons||[]){if(!MirsadScheduleCore.normalizeTeamsUrl(row.url)||MirsadMonitorModel.isExcludedPeriod(today(),row.period,r.day.snapshot)||row.period<(settings.startPeriod||1)||row.period>(settings.endPeriod||7))continue;
    const existing=schedule.find(l=>Number(l.period)===Number(row.period)&&MirsadMonitorModel.normalize(l.teacher||l.teacherName)===MirsadMonitorModel.normalize(row.teacherName));
    if(!existing)schedule.push({...row,teacher:row.teacherName,hasLesson:true,validPeriod:true});
   }
   if(schedule.length!==next.schedule?.length){next.schedule=schedule;if(await saveRun(next)===false)return;if(typeof wakeUpdatedLinks==='function')await wakeUpdatedLinks()}
  }

  await chrome.storage.local.remove(STAGED);await note(r.filled?'أُضيفت '+r.filled+' روابط جديدة؛ النتائج والصور والتوقيت محفوظة.':'لم تُضف روابط للحصص الناقصة بعد؛ يستمر الرصد بالجدول نفسه.');
 }catch(e){await note('تعذر إضافة الروابط: '+e.message+'؛ يستمر الرصد بالجدول الحالي.','warning')}finally{applying=false}}
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void tick()});
 chrome.runtime.onMessage.addListener((m,s,reply)=>{if(!['MIRSAD_AUTO_LINKS_INFO','MIRSAD_AUTO_LINKS_CONFIG'].includes(m?.type)||!validSender(s))return;(m.type==='MIRSAD_AUTO_LINKS_CONFIG'?configure(m.enabled):info()).then(reply).catch(e=>reply({ok:false,error:e.message}));return true});
 void enabled().then(async on=>{if(on&&!await chrome.alarms.get(ALARM))await chrome.alarms.create(ALARM,{periodInMinutes:5})});
 return {tick,beforeCycle,configure,info};
})();
