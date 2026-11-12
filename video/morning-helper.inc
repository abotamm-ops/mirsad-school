 // Before-school refresh stops once all lesson links are complete, independently of daytime mode.
 let morningBlocked='';
 const morningStop=reason=>{morningBlocked=reason;return null};
 const MORNING_NOTICE='mirsadMorningNotice',MORNING_WATCHDOG='mirsad-morning-watchdog';
 const MORNING_ALARM='mirsad-before-first-lesson',MORNING_SLOT='mirsadBeforeFirstLessonSlot';
 async function morningWindow(){
  let run=await getRun();if(run?.paused||run?.current||run?.testMode||run?.backtestMode||run?.immediateMode||run?.calendarTrial)return morningStop('تحميل الصباح ينتظر انتهاء الفحص أو استئناف الرصد المتوقف مؤقتًا.');
  const saved=await chrome.storage.local.get(['mirsadDriveDay','mirsadMadrasatiSelectedDate','mirsadPopupWorkflow','mirsadDriveConfig']),day=saved.mirsadDriveDay;if(day?.date!==today()||day.snapshot?.sourceType!=='madrasati'||(run?.running&&day.snapshot.scheduleRevision!==run.scheduleRevision))return morningStop('تحميل الصباح ينتظر تجهيز جدول اليوم المطابق لجلسة الرصد.');
  if(!run?.running){if(!saved.mirsadDriveConfig?.url||!saved.mirsadDriveConfig?.key||saved.mirsadPopupWorkflow?.date!==today()||saved.mirsadPopupWorkflow?.prepared!==day.snapshot.scheduleRevision)return morningStop('تحميل الصباح ينتظر ربط الحساب وتجهيز اليوم من الخطوة 3؛ لا يلزم تشغيل الرصد الآن.');run={running:false,standby:true,startedAt:'prepared:'+day.snapshot.scheduleRevision,controlEpoch:0,scheduleRevision:day.snapshot.scheduleRevision}}
  // Never pick or overwrite the user's source date. Morning refresh is today-only.
  const sourceDate=saved.mirsadMadrasatiSelectedDate||day.snapshot.sourceScheduleDate;if(sourceDate!==today()||day.snapshot.sourceScheduleDate!==sourceDate)return morningStop('تحميل الصباح متوقف: تاريخ مدرستي المختار أو الجدول المجهز لا يطابق تاريخ اليوم.');
  if(!missing(day.snapshot))return morningStop('اكتملت روابط اليوم؛ لا حاجة لتحميل الصباح.');
  if(typeof scheduleSettings!=='object'||typeof periodBounds!=='function')return morningStop('تحميل الصباح ينتظر تهيئة توقيت الحصص.');
  const clock=/^(\d{1,2}):(\d{2})$/.exec(scheduleSettings.manualStart||'');if(!clock||Number(clock[1])>23||Number(clock[2])>59)return morningStop('اضبط بداية الحصة الأولى لتفعيل تحميل الصباح.');
  const first=Number(clock[1])*60+Number(clock[2]),bounds=periodBounds({n:1,startOffset:first,endOffset:first+Number(scheduleSettings.periodDuration||45)},new Date(),'activeOrNext');
  const start=bounds?.start.getTime();if(!Number.isFinite(start)||start<=Date.now())return morningStop('تحميل الصباح متوقف بعد بداية الحصة الأولى؛ التحديث أثناء اليوم حسب الإعداد المختار.');
  return {run,day,sourceDate,start,opens:start-30*60000};
 }
 async function morningAllowed(pending){const w=await morningWindow();return !!w&&Date.now()>=w.opens&&Date.now()<w.start-1000&&(!pending||pending.morningStart===w.start&&pending.runStartedAt===w.run.startedAt&&pending.epoch===(w.run.controlEpoch||0))}
 async function morningNotice(text){const previous=(await chrome.storage.local.get(MORNING_NOTICE))[MORNING_NOTICE];if(previous?.date===today()&&previous.text===text)return;await chrome.storage.local.set({[MORNING_NOTICE]:{date:today(),text}});await note(text)}
 async function planMorning(invoke=false){
  if(typeof refreshScheduleSettings==='function')await refreshScheduleSettings();
  const w=await morningWindow();if(!w){await chrome.alarms.clear(MORNING_ALARM);await morningNotice(morningBlocked);return}
  const now=Date.now(),next=now<w.opens?w.opens:w.opens+(Math.floor((now-w.opens)/300000)+1)*300000;
  if(next<w.start)await chrome.alarms.create(MORNING_ALARM,{when:next});else await chrome.alarms.clear(MORNING_ALARM);
  if(now<w.opens)await morningNotice('تحميل الصباح مجدول: يبدأ قبل الحصة الأولى بنصف ساعة، عند '+new Date(w.opens).toLocaleTimeString('ar-SA')+' لتاريخ '+w.sourceDate+'.');else await morningNotice('تحميل الصباح جاهز؛ يحاول الآن ثم كل خمس دقائق ما دامت الروابط ناقصة.');
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
   const result=await MadrasatiSource.collect(w.sourceDate,{collectOnly:true,directoryTabId:tab.id,shouldContinue,mode:'continuous',startPeriod:1});
   if(!result?.payload||!await shouldContinue())return;
   if(result.payload.scheduleDate!==w.sourceDate||result.payload.importedForDate!==today())throw Error('تاريخ الجدول المستلم لا يطابق تاريخ اليوم الذي اخترته؛ لم يُعدّل الجدول');
   await chrome.storage.local.set({[STAGED]:{...pending,gapKey:slot,date:today(),revision:w.day.snapshot.scheduleRevision,scope:fingerprint,payload:result.payload,at:Date.now(),mode:'continuous',startPeriod:1}});
   await beforeCycle(w.run);
  }catch(e){await note('تحميل ما قبل الحصة الأولى: '+e.message+'؛ بقي الجدول الحالي.',e.cancelled?'info':'warning')}finally{gapBusy=false;await planMorning()}
 }
 chrome.alarms.onAlarm.addListener(a=>{if(a.name===MORNING_ALARM)void collectMorning();if(a.name===MORNING_WATCHDOG)void planMorning(true).catch(e=>morningNotice('تعذر تجهيز تحميل الصباح: '+e.message))});
 void chrome.alarms.create(MORNING_WATCHDOG,{periodInMinutes:1});
 chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.mirsadAutoRun||changes.mirsadDriveDay||changes.mirsadScheduleSettings||changes.mirsadDriveConfig||changes.mirsadPopupWorkflow||changes.mirsadMadrasatiSelectedDate))void planMorning(true).catch(()=>{})});
 void Promise.resolve().then(()=>planMorning(true)).catch(()=>{});
