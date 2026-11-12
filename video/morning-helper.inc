 // Before-school refresh stops once all lesson links are complete, independently of daytime mode.
 const MORNING_ALARM='mirsad-before-first-lesson',MORNING_SLOT='mirsadBeforeFirstLessonSlot';
 async function morningWindow(){
  const run=await getRun();if(!run?.running||run.paused||run.current||run.testMode||run.backtestMode||run.immediateMode||run.calendarTrial)return null;
  const day=(await chrome.storage.local.get('mirsadDriveDay')).mirsadDriveDay;if(day?.date!==today()||day.snapshot?.sourceType!=='madrasati'||day.snapshot.scheduleRevision!==run.scheduleRevision)return null;
  if(!missing(day.snapshot))return null;
  if(typeof scheduleSettings!=='object'||typeof periodBounds!=='function')return null;
  const clock=/^(\d{1,2}):(\d{2})$/.exec(scheduleSettings.manualStart||'');if(!clock||Number(clock[1])>23||Number(clock[2])>59)return null;
  const first=Number(clock[1])*60+Number(clock[2]),bounds=periodBounds({n:1,startOffset:first,endOffset:first+Number(scheduleSettings.periodDuration||45)},new Date(),'activeOrNext');
  const start=bounds?.start.getTime();if(!Number.isFinite(start)||start<=Date.now())return null;
  return {run,day,start,opens:start-30*60000};
 }
 async function morningAllowed(pending){const w=await morningWindow();return !!w&&Date.now()>=w.opens&&Date.now()<w.start-1000&&(!pending||pending.morningStart===w.start&&pending.runStartedAt===w.run.startedAt&&pending.epoch===(w.run.controlEpoch||0))}
 async function planMorning(invoke=false){
  if(typeof refreshScheduleSettings==='function')await refreshScheduleSettings();
  const w=await morningWindow();if(!w){await chrome.alarms.clear(MORNING_ALARM);return}
  const now=Date.now(),next=now<w.opens?w.opens:w.opens+(Math.floor((now-w.opens)/300000)+1)*300000;
  if(next<w.start)await chrome.alarms.create(MORNING_ALARM,{when:next});else await chrome.alarms.clear(MORNING_ALARM);
  if(invoke&&now>=w.opens)void collectMorning();
 }
 async function collectMorning(){
  await planMorning();if(busy||gapBusy||applying)return;const w=await morningWindow();if(!w||Date.now()<w.opens)return;
  const fingerprint=await scope(),slot=[fingerprint,today(),w.run.startedAt,w.run.controlEpoch||0,w.start,Math.floor((Date.now()-w.opens)/300000)].join('|');
  if((await chrome.storage.local.get(MORNING_SLOT))[MORNING_SLOT]===slot)return;
  gapBusy=true;try{
   await chrome.storage.local.set({[MORNING_SLOT]:slot});
   const source=await MadrasatiSource.info();if(source.state?.running||source.pending)throw Error('هناك تحميل آخر أو استيراد ينتظر التأكيد');
   const pending={reason:'morning',morningStart:w.start,runStartedAt:w.run.startedAt,epoch:w.run.controlEpoch||0};
   const shouldContinue=async()=>fingerprint===await scope()&&await morningAllowed(pending);
   const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/SchoolManagment/Teachers*'}),tab=tabs.find(t=>t.windowId===w.run.workspaceWindowId)||tabs[0];if(!tab)throw Error('افتح صفحة معلمي مدرستي وسجّل الدخول');
   await note('بدأ تحميل الجدول قبل الحصة الأولى؛ يتكرر كل خمس دقائق حتى بداية الحصة.');
   await health(tab,w.start-1000,shouldContinue);if(!await shouldContinue())return;
   const result=await MadrasatiSource.collect(w.day.snapshot.sourceScheduleDate||today(),{collectOnly:true,directoryTabId:tab.id,shouldContinue,mode:'continuous',startPeriod:1});
   if(!result?.payload||!await shouldContinue())return;
   await chrome.storage.local.set({[STAGED]:{...pending,gapKey:slot,date:today(),revision:w.day.snapshot.scheduleRevision,scope:fingerprint,payload:result.payload,at:Date.now(),mode:'continuous',startPeriod:1}});
   await beforeCycle(w.run);
  }catch(e){await note('تحميل ما قبل الحصة الأولى: '+e.message+'؛ بقي الجدول الحالي.',e.cancelled?'info':'warning')}finally{gapBusy=false;await planMorning()}
 }
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===MORNING_ALARM)void collectMorning()});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.mirsadAutoRun||changes.mirsadDriveDay||changes.mirsadScheduleSettings||changes.mirsadDriveConfig))void planMorning(true).catch(()=>{})});
 void Promise.resolve().then(()=>planMorning(true)).catch(()=>{});
