/* Optional read/merge only. No replacement, no delete, no automatic login. */
var MirsadAutoLinks=(()=>{
 const REMOTE='mirsadAutoLinksRemote',PREF='mirsadAutoLinksEnabled',STAGED='mirsadAutoLinksStaged',STATE='mirsadAutoLinksState',NOTES='mirsadAutoLinksNotes',ALARM='mirsad-auto-links-five-minutes';let busy=false,gapBusy=false,applying=false;
 const today=()=>MirsadMonitorModel.day();
 const edition=chrome.runtime.getManifest().name.includes('المدارس')?'schools/':'';
 const home='/'+edition+'automatic-monitoring.html';
 const validSender=s=>{if(!s.tab)return s.id===chrome.runtime.id;try{const u=new URL(s.tab.url);return u.origin==='https://mirsad-school.onrender.com'&&u.pathname===home}catch{return false}};
 const pause=ms=>new Promise(r=>setTimeout(r,ms));
 const missing=s=>(s?.lessons||[]).filter(l=>!MirsadScheduleCore.normalizeTeamsUrl(l.url)&&!MirsadMonitorModel.isExcludedPeriod(s.date,l.period,s)).length;
 async function scope(){const c=(await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig||{};return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode((c.url||'')+'|'+(c.key||''))))).map(v=>v.toString(16).padStart(2,'0')).join('')}
 async function note(text,kind='info'){const at=Date.now(),s=await chrome.storage.local.get(NOTES),notes=s[NOTES]||[];await chrome.storage.local.set({[NOTES]:[...notes,{at,date:today(),text,kind}].slice(-100),[STATE]:{at,date:today(),text,kind}})}
 async function info(){const s=await chrome.storage.local.get([PREF,STATE,NOTES,'mirsadDriveDay']);const day=s.mirsadDriveDay;return {ok:true,enabled:s[PREF]===true,missing:day?.date===today()?missing(day.snapshot):null,state:s[STATE]||null,notes:(s[NOTES]||[]).filter(n=>n.date===today()).slice(-15)}}
 async function enabled(){const v=await chrome.storage.local.get([PREF,REMOTE]);return v[PREF]===true&&v[REMOTE]?.scope===await scope()&&Date.now()-v[REMOTE].seenAt<180000}
 async function configure(on){if(typeof on!=='boolean')throw Error('خيار غير صالح');await chrome.storage.local.set({[PREF]:on});if(on){await chrome.alarms.create(ALARM,{periodInMinutes:5});await note('التحديث مفعّل: تُفحص صفحة المعلمين كل خمس دقائق طالما بقيت روابط ناقصة.')}else{await chrome.alarms.clear(ALARM);await MadrasatiSource.cancelAutomatic?.();await chrome.storage.local.remove(STAGED);await chrome.storage.local.remove('mirsadAutoLinksHealth');await note('تحديث الروابط التلقائي متوقف.')}return info()}
 async function health(tab){
  await chrome.tabs.reload(tab.id);const deadline=Date.now()+60000;
  while(Date.now()<deadline){if(!await enabled())throw Error('أُلغي تحديث الروابط');const t=await chrome.tabs.get(tab.id);if(t.status==='complete'&&!t.pendingUrl){let u;try{u=new URL(t.url)}catch{}if(!u||u.origin!=='https://schools.madrasati.sa'||!/^\/SchoolManagment\/Teachers\/?$/i.test(u.pathname))throw Error('جلسة مدرستي أو صفحة المعلمين غير جاهزة؛ سجّل الدخول وافتح قائمة المعلمين');try{const r=await chrome.tabs.sendMessage(tab.id,{type:'MIRSAD_MADRASATI_READ',kind:'directory'});if(r?.ok&&r.teachers?.length)return r;if(r?.error&&!r.retryable)throw Object.assign(Error(r.error),{fatal:true})}catch(e){if(e.fatal)throw e}}
   await pause(500);
  }throw Error('لم تتأكد جاهزية قائمة المعلمين بعد التحديث؛ بقي الجدول كما هو');
 }
 async function tick(){if(busy||gapBusy||applying||!await enabled())return;busy=true;try{
  const d=(await chrome.storage.local.get('mirsadDriveDay')).mirsadDriveDay;if(d?.date!==today()||d.snapshot?.sourceType!=='madrasati')return;
  const run=await getRun(),mode=await selectedMode(),startPeriod=Math.max(1,run?.period||1),rows=(d.snapshot.lessons||[]).filter(l=>l.period>=startPeriod&&!MirsadMonitorModel.isExcludedPeriod(today(),l.period,d.snapshot));
  if(!rows.length||mode==='missing'&&!rows.some(l=>!MirsadScheduleCore.normalizeTeamsUrl(l.url))){await chrome.storage.local.remove(STAGED);await chrome.storage.local.set({[STATE]:{at:Date.now(),date:today(),text:'اكتملت روابط الحصص القادمة؛ توقف تحديث الصفحة تلقائيًا.',complete:true}});return}
  const source=await MadrasatiSource.info();if(source.state?.running||source.pending)return;
  const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/SchoolManagment/Teachers*'}),tab=tabs.find(t=>t.windowId===run?.workspaceWindowId)||tabs[0];if(!tab)throw Error('افتح صفحة معلمي مدرستي؛ لم يُفتح تبويب جديد');
  const fingerprint=await scope();await health(tab);if(!await enabled()||fingerprint!==await scope())return;
  await chrome.storage.local.set({mirsadAutoLinksHealth:{date:today(),at:Date.now(),scope:fingerprint,tabId:tab.id,revision:d.snapshot.scheduleRevision},[STATE]:{at:Date.now(),date:today(),text:'تم تحديث صفحة المعلمين فقط؛ تحميل الجدول ينتظر فاصل دورات الرصد.'}});
 }catch(e){await note('لم تُحدّث صفحة المعلمين: '+e.message,'warning')}finally{busy=false}}
 async function selectedMode(){const v=(await chrome.storage.local.get(REMOTE))[REMOTE];return v?.mode==='continuous'?'continuous':'missing'}
 async function collectGap(){if(gapBusy||busy||applying||!await enabled())return;gapBusy=true;try{
  const run=await getRun();if(!run?.running||run.paused||run.current||!run.waitingForCycle2||!(run.nextCycleAt>Date.now()+2000))return;
  const d=(await chrome.storage.local.get('mirsadDriveDay')).mirsadDriveDay;if(d?.date!==today()||d.snapshot?.sourceType!=='madrasati')return;
  const fingerprint=await scope(),mode=await selectedMode(),startPeriod=Math.max(1,run.period||1),rows=d.snapshot.lessons.filter(l=>l.period>=startPeriod&&!MirsadMonitorModel.isExcludedPeriod(today(),l.period,d.snapshot));
  if(!rows.length||mode==='missing'&&!rows.some(l=>!MirsadScheduleCore.normalizeTeamsUrl(l.url)))return;
  const healthState=(await chrome.storage.local.get('mirsadAutoLinksHealth')).mirsadAutoLinksHealth;
  if(!healthState||healthState.date!==today()||healthState.scope!==fingerprint||Date.now()-healthState.at>360000||healthState.revision!==d.snapshot.scheduleRevision){await note('أُجّل تحميل الجدول حتى يتأكد تحديث صفحة المعلمين وسلامتها.');return}
  const source=await MadrasatiSource.info();if(source.state?.running||source.pending)return;
  const shouldContinue=async()=>{if(!await enabled()||fingerprint!==await scope()||mode!==await selectedMode())return false;const r=await getRun();return r?.running&&!r.paused&&!r.current&&r.waitingForCycle2&&r.nextCycleAt===run.nextCycleAt&&r.startedAt===run.startedAt&&(r.controlEpoch??0)===(run.controlEpoch??0)&&Date.now()<run.nextCycleAt-1000};
  const result=await MadrasatiSource.collect(today(),{collectOnly:true,directoryTabId:healthState.tabId,shouldContinue,mode,startPeriod});
  if(!result?.payload||!await shouldContinue())return;
  await chrome.storage.local.set({[STAGED]:{date:today(),revision:d.snapshot.scheduleRevision,scope:fingerprint,payload:result.payload,at:Date.now(),mode,startPeriod}});
  await note('اكتملت قراءة الجدول وأُغلقت تبويبات التحميل؛ التحقق من الروابط قبل الدورة التالية.');
 }catch(e){await note(e.cancelled?e.message:'لم يُحمّل الجدول: '+e.message,e.cancelled?'info':'warning')}finally{gapBusy=false}}
 async function beforeCycle(run){await MadrasatiSource.cancelAutomatic?.();if(applying||!await enabled())return;applying=true;try{
  const stored=await chrome.storage.local.get([STAGED,'mirsadDriveDay']),pending=stored[STAGED],d=stored.mirsadDriveDay;if(!pending)return;
  if(pending.mode!==await selectedMode()||pending.date!==today()||d?.date!==today()||pending.revision!==d.snapshot?.scheduleRevision||pending.scope!==await scope()){await chrome.storage.local.remove(STAGED);return}
  const current=await getRun();if(!current?.running||current.paused||current.current||current.scheduleRevision!==pending.revision||run&&(current.startedAt!==run.startedAt||(current.controlEpoch??0)!==(run.controlEpoch??0)))return;
  if(pending.mode!=='continuous'&&!missing(d.snapshot)){await chrome.storage.local.remove(STAGED);return}
  // Only a delta merge against the existing revision; never stageImport/publish/reset.
  const r=await CloudMonitoring.fillMissingLinks(pending.payload,{requireExisting:true,expectedRevision:pending.revision,automaticRefresh:true,refreshExisting:pending.mode==='continuous',startPeriod:pending.startPeriod});
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

  await chrome.storage.local.remove(STAGED);await note(r.filled?'تم تحميل الجدول: أُضيف '+(r.added??r.filled)+' رابط، وحُدّث '+(r.changed||0)+' رابط.'+(r.completed?.length?' — '+r.completed.slice(0,3).map(l=>l.teacher).join('، '):'')+' النتائج والصور محفوظة.':'تم تحميل الجدول، ولا يوجد جديد.');
 }catch(e){await note('تعذر إضافة الروابط: '+e.message+'؛ يستمر الرصد بالجدول الحالي.','warning')}finally{applying=false}}
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===ALARM)void tick()});
 chrome.storage.onChanged.addListener((changes,area)=>{const n=changes.mirsadAutoRun?.newValue,o=changes.mirsadAutoRun?.oldValue;if(area==='local'&&n?.running&&!n.current&&n.waitingForCycle2&&(!o?.waitingForCycle2||o.nextCycleAt!==n.nextCycleAt))void collectGap()});
 chrome.runtime.onMessage.addListener((m,s,reply)=>{if(!['MIRSAD_AUTO_LINKS_INFO','MIRSAD_AUTO_LINKS_CONFIG'].includes(m?.type)||!validSender(s))return;(m.type==='MIRSAD_AUTO_LINKS_CONFIG'?Promise.reject(Error('غيّر الإعداد من موقع مرصاد؛ التحكم الآن محفوظ عن بُعد')):info()).then(reply).catch(e=>reply({ok:false,error:e.message}));return true});
 void enabled().then(async on=>{if(on&&!await chrome.alarms.get(ALARM))await chrome.alarms.create(ALARM,{periodInMinutes:5})});

 async function acceptRemote(control,expectedScope){
  if(!control||typeof control.enabled!=='boolean'||!Number.isInteger(control.revision)||control.revision<0)return false;
  const fingerprint=await scope();if(expectedScope&&expectedScope!==fingerprint)return false;const old=(await chrome.storage.local.get(REMOTE))[REMOTE];
  if(old?.scope===fingerprint&&control.revision<old.revision)return false;
  const changed=old?.scope!==fingerprint||old.revision!==control.revision||old.enabled!==control.enabled||old.mode!==(control.mode||'missing')||(await chrome.storage.local.get(PREF))[PREF]!==control.enabled;
  if(changed)await configure(control.enabled);
  await chrome.storage.local.set({[REMOTE]:{scope:fingerprint,revision:control.revision,enabled:control.enabled,mode:control.mode||'missing',seenAt:Date.now(),appliedAt:changed?Date.now():old.appliedAt}});
  if(changed&&control.enabled)void tick();return changed;
 }
 async function remoteReport(){const v=(await chrome.storage.local.get(REMOTE))[REMOTE];if(!v||v.scope!==await scope())return null;const state=await info();return {revision:v.revision,enabled:state.enabled,mode:v.mode||'missing',appliedAt:v.appliedAt,remaining:state.missing,complete:state.state?.complete===true,notes:state.notes.slice(-5)}}
 chrome.alarms.onAlarm.addListener(a=>{if(a.name==='mirsadAutoLinksRemoteControl')void MirsadLiveSender.sync()});
 void chrome.alarms.get('mirsadAutoLinksRemoteControl').then(a=>{if(!a)return chrome.alarms.create('mirsadAutoLinksRemoteControl',{periodInMinutes:1})});
 return {tick,collectGap,beforeCycle,configure,info,acceptRemote,remoteReport,remoteScope:scope};
})();
