importScripts("schedule-core.js","monitor-model.js","drive-sync.js");
const scheduleCore = globalThis.MirsadScheduleCore;
const KEY="mirsadAutoRun", STATUS_KEY="mirsadAutoStatus", NEXT_ALARM="mirsadNextAction", SCAN_TIMEOUT_ALARM="mirsadScanTimeout";
const SCHEDULE_SETTINGS_KEY="mirsadScheduleSettings";
const SCAN_TIMEOUT_MS=30000;
const RECONNECT_RETRY_MS=15000;
const DEFAULT_SCHEDULE_SETTINGS={manualStart:"06:30",periodDuration:45,manualGapMinutes:1,periodCount:7,scanDelay:1,roundCount:2,roundGapMinutes:5};
let scheduleSettings={...DEFAULT_SCHEDULE_SETTINGS};
let PERIODS=[];
function clockText(n){n=((n%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")}
function parseClock(value){const match=/^(\d{1,2}):(\d{2})$/.exec(scheduleCore.asciiDigits(value||""));if(!match)return null;const hour=Number(match[1]),minute=Number(match[2]);return hour<24&&minute<60?hour*60+minute:null}
function makePeriods(base){if(!Array.isArray(base)||base.length!==7)return [];const b=[];let previousStart=null;for(let i=0;i<base.length;i++){const p=base[i]||{};let start=Number(p.startOffset),end=Number(p.endOffset);if(!Number.isFinite(start)||!Number.isFinite(end))return [];start=((start%1440)+1440)%1440;end=((end%1440)+1440)%1440;if(previousStart!==null&&start<previousStart)start+=1440;if(end<=start)end+=1440;if(end-start>180)return [];b.push({n:i+1,startOffset:start,endOffset:end});previousStart=start}return b.map(p=>({n:p.n,startOffset:p.startOffset,endOffset:p.endOffset,start:clockText(p.startOffset),end:clockText(p.endOffset)}))}
function makeManualPeriods(startValue,gapValue,durationValue=45,countValue=7,delayValue=1){return scheduleCore.makeManualPeriods(startValue,durationValue,gapValue,countValue,delayValue)}
function activePeriods(settings){return makeManualPeriods(settings.manualStart,settings.manualGapMinutes,settings.periodDuration,settings.periodCount,settings.scanDelay)}
async function refreshScheduleSettings(){const saved=await chrome.storage.local.get(SCHEDULE_SETTINGS_KEY),old=saved[SCHEDULE_SETTINGS_KEY]||{},delay=Number(old.scanDelay),duration=Number(old.periodDuration);scheduleSettings={...DEFAULT_SCHEDULE_SETTINGS,...old,manualStart:old.manualStart||DEFAULT_SCHEDULE_SETTINGS.manualStart,periodDuration:Number.isInteger(duration)&&duration>=1&&duration<=180?duration:DEFAULT_SCHEDULE_SETTINGS.periodDuration,periodCount:7,scanDelay:Number.isInteger(delay)&&delay>=1&&delay<=10?delay:DEFAULT_SCHEDULE_SETTINGS.scanDelay,roundCount:Number.isInteger(Number(old.roundCount))&&Number(old.roundCount)>=1&&Number(old.roundCount)<=3?Number(old.roundCount):2,roundGapMinutes:Number.isInteger(Number(old.roundGapMinutes))&&Number(old.roundGapMinutes)>=1&&Number(old.roundGapMinutes)<=10?Number(old.roundGapMinutes):5};PERIODS=activePeriods(scheduleSettings);return scheduleSettings}
refreshScheduleSettings().catch(()=>{});
async function loadPeriodsFromSchedule(tabId,settingsOverride){const activeSettings=settingsOverride||scheduleSettings,response=await chrome.tabs.sendMessage(tabId,{type:"MIRSAD_GET_SCHEDULE",manualPeriodMapping:true});const items=(response?.items||[]).filter(x=>x.teacher&&x.hasLesson);const invalid=items.find(x=>x.validPeriod===false||!Number.isInteger(x.period)||x.period<1||x.period>7);if(invalid)throw new Error("تعذر تحديد رقم الحصة من عمود الجدول بأمان؛ لم يُفتح أي رابط. الخلية التي تعذر ربطها: "+(invalid.reason||invalid.teacher||"غير معروفة"));const periods=makeManualPeriods(activeSettings.manualStart,activeSettings.manualGapMinutes,activeSettings.periodDuration,activeSettings.periodCount,activeSettings.scanDelay);if(!periods.length)throw new Error("أدخل بداية الحصة الأولى والمدة والفاصل وعدد الحصص وتأخير الرصد بشكل صحيح.");scheduleSettings={...DEFAULT_SCHEDULE_SETTINGS,...activeSettings};await chrome.storage.local.set({[SCHEDULE_SETTINGS_KEY]:scheduleSettings});PERIODS=periods;return {items,periods}}

async function setStatus(text,extra={}){await chrome.storage.local.set({[STATUS_KEY]:{text,at:Date.now(),...extra}})}
async function getRun(){const x=await chrome.storage.local.get(KEY);return x[KEY]||null}
async function saveRun(run){await chrome.storage.local.set({[KEY]:run})}
const DAILY_REPORT_KEY="mirsadDailyAttendanceReports";
function localDayKey(date=new Date()){
 const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,"0"),d=String(date.getDate()).padStart(2,"0");
 return y+"-"+m+"-"+d;
}
async function appendDailyReport(record){
 const day=localDayKey(new Date(record.scannedAt||Date.now()));
 const saved=await chrome.storage.local.get(DAILY_REPORT_KEY);
 const reports=saved[DAILY_REPORT_KEY]&&typeof saved[DAILY_REPORT_KEY]==="object"?saved[DAILY_REPORT_KEY]:{};
 reports[day]=Array.isArray(reports[day])?reports[day]:[];
 // Keep the raw result from every scan cycle, then derive the teacher's
 // running attendance state for this lesson from all conclusive scans.
 record.scanStatus=record.scanStatus||record.status||"unresolved";
 reports[day].push(record);
 const keyOf=x=>String(x.scheduledTeacher||x.teacher||"")+"|"+String(x.period||"")+"|"+String(x.url||"");
 const groups=new Map();
 for(const item of reports[day]){
  const key=keyOf(item);
  if(!groups.has(key))groups.set(key,[]);
  groups.get(key).push(item);
 }
 for(const group of groups.values()){
  group.sort((a,b)=>(a.scannedAt||0)-(b.scannedAt||0));
  const conclusive=group.filter(x=>x.scanStatus==="present"||x.scanStatus==="absent");
  const presentCount=conclusive.filter(x=>x.scanStatus==="present").length;
  const percent=conclusive.length?Math.round(presentCount/conclusive.length*100):0;
  const attendanceStatus=scheduleCore.summarizeAttendanceStatuses(group);
  for(const item of group){
   item.attendanceStatus=attendanceStatus;
   item.attendancePercent=percent;
   item.presentCycles=presentCount;
   item.countedCycles=conclusive.length;
   // Final attendance has only present/absent when evidence is conclusive;
   // scanStatus preserves each individual cycle for audit.
   item.status=item.scanStatus==="no-link"?"no-link":item.attendanceStatus;
  }
 }
 const keys=Object.keys(reports).sort();
 while(keys.length>45)delete reports[keys.shift()];
 await chrome.storage.local.set({[DAILY_REPORT_KEY]:reports});
}
async function closeProbeTab(run){
 if(!run)return;
 const ids=new Set([...(run.probeTabIds||[]),run.tabId].filter(id=>Number.isInteger(id)));
 for(const id of ids){try{await chrome.tabs.remove(id)}catch(_){}}
 run.tabId=null;run.probeTabIds=[];await saveRun(run);
}
async function trackProbeTab(tab){
 if(!Number.isInteger(tab?.id)||!Number.isInteger(tab?.openerTabId))return;
 const run=await getRun();
 if(!run?.running||!Number.isInteger(run.tabId)||tab.openerTabId!==run.tabId)return;
 run.probeTabIds=Array.isArray(run.probeTabIds)?run.probeTabIds:[];
 if(!run.probeTabIds.includes(tab.id))run.probeTabIds.push(tab.id);
 await saveRun(run);
}
chrome.tabs.onCreated.addListener(tab=>{trackProbeTab(tab).catch(()=>{});});
function isTeamsMeetingUrl(value){
 try{
  const u=new URL(value);
  return u.protocol==="https:" && (u.hostname==="teams.microsoft.com" || u.hostname==="teams.live.com") && u.pathname.length>1;
 }catch(_){return false}
}
async function ensureProbeTab(run){
 if(run?.tabId!=null){try{await chrome.tabs.get(run.tabId);return run.tabId}catch(_){run.tabId=null}}
 const tab=await chrome.tabs.create({url:"about:blank",active:false});
 run.tabId=tab.id;await saveRun(run);return tab.id;
}
function dateAtOffset(anchor,minuteOffset){
 const d=new Date(anchor);d.setHours(0,0,0,0);d.setMinutes(minuteOffset);return d;
}
function schoolDay(date){return date.getDay()!==5&&date.getDay()!==6}
function periodBounds(p,now=new Date(),mode="activeOrNext"){
 const candidates=[];
 for(let dayOffset=-2;dayOffset<=2;dayOffset++){
  const anchor=new Date(now);anchor.setDate(anchor.getDate()+dayOffset);anchor.setHours(0,0,0,0);
  if(!schoolDay(anchor))continue;
  const start=dateAtOffset(anchor,p.startOffset);
  const end=dateAtOffset(anchor,p.endOffset);
  candidates.push({start,end,anchor});
 }
 const active=candidates.find(x=>now>=x.start&&now<x.end);
 if(active)return active;
 if(mode==="future"){
  const future=candidates.filter(x=>x.start>now).sort((a,b)=>a.start-b.start);
  if(future.length)return future[0];
 }
 const past=candidates.filter(x=>x.start<=now).sort((a,b)=>b.start-a.start);
 if(mode==="past"&&past.length)return past[0];
 const future=candidates.filter(x=>x.start>now).sort((a,b)=>a.start-b.start);
 if(future.length)return future[0];
 return past[0]||candidates[0];
}
function periodNow(now=new Date()){
 // If two lesson windows overlap because of timetable boundaries, never let
 // the earlier lesson win merely because it appears first in the array.
 // Select the active window with the latest start time; ties are ambiguous.
 const active=[];
 for(const p of PERIODS){
  const b=periodBounds(p,now,"active");
  if(b&&now>=b.start&&now<b.end)active.push({period:p,bounds:b});
 }
 if(!active.length)return null;
 active.sort((a,b)=>b.bounds.start.getTime()-a.bounds.start.getTime() || b.period.n-a.period.n);
 return active[0].period;
}
function nextPeriod(now=new Date()){
 const candidates=[];
 for(let dayOffset=-1;dayOffset<=8;dayOffset++){
  const anchor=new Date(now);anchor.setDate(anchor.getDate()+dayOffset);anchor.setHours(0,0,0,0);
  if(!schoolDay(anchor))continue;
  for(const p of PERIODS){
   const start=dateAtOffset(anchor,p.startOffset);
   if(start>now)candidates.push({period:p,when:start.getTime()});
  }
 }
 candidates.sort((a,b)=>a.when-b.when);
 if(candidates.length)return candidates[0];
 const d=new Date(now);d.setDate(d.getDate()+1);while(!schoolDay(d))d.setDate(d.getDate()+1);
 return {period:PERIODS[0],when:dateAtOffset(d,PERIODS[0].startOffset).getTime()};
}
async function getScheduleTab(){const tabs=await chrome.tabs.query({url:"https://mirsad-school.onrender.com/*"});const eligible=tabs.filter(t=>t.url&&!t.url.includes("/absence.html")&&!t.url.includes("/automatic-attendance.html")).sort((a,b)=>Number(Boolean(b.active))-Number(Boolean(a.active))||(b.lastAccessed||0)-(a.lastAccessed||0));for(const tab of eligible){try{const result=await chrome.tabs.sendMessage(tab.id,{type:"MIRSAD_GET_SCHEDULE",manualPeriodMapping:true});if(result?.ok&&Array.isArray(result.items)&&result.items.some(item=>item.teacher&&item.hasLesson))return tab}catch(_){}}return null}
async function startMonitoring(immediate=false){
 await refreshScheduleSettings();
 const existing=await getRun();
 // An explicit normal start is a restart command: rebuild the active lesson
 // from its first teacher instead of continuing the saved index. The immediate
 // diagnostic path keeps its separate suspend/restore behavior.
 if(existing?.running&&!immediate){
  await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
  existing.running=false;await closeProbeTab(existing);
  await setStatus("أُعيد تشغيل الرصد؛ سيبدأ من أول رابط في الحصة الجارية.",{period:existing.period,restarted:true});
 }
 if(existing?.running&&immediate&&existing.current){await setStatus("المراقبة تعمل بالفعل؛ لن يُفتح فحص فوري أثناء فحص رابط.",{period:existing.period,waiting:!existing.period});return}
 const suspendedRun=immediate&&existing?.running?existing:null;
 const suspendedAlarm=suspendedRun&&chrome.alarms.get?await chrome.alarms.get(NEXT_ALARM):null;
 const scheduleTab=await getScheduleTab();
 const driveDay=(await chrome.storage.local.get("mirsadDriveDay")).mirsadDriveDay;
 const frozen=driveDay?.date===MirsadMonitorModel.day()?driveDay.snapshot:null;
 if(!scheduleTab&&!frozen){await setStatus("افتح جدول مرصاد أو اضغط بداية اليوم لحفظ جدول اليوم أولًا.");return}
 let loaded;
 try{loaded=frozen?{items:frozen.lessons.map(x=>({...x,teacher:x.teacherName,hasLesson:true,validPeriod:true})),periods:PERIODS}:await loadPeriodsFromSchedule(scheduleTab.id)}catch(error){await setStatus(error?.message||"تعذرت قراءة أسماء المعلمين وربط الحصص من جدول مرصاد.");return}
 if(frozen){scheduleSettings.roundCount=frozen.roundCount;await chrome.storage.local.set({[SCHEDULE_SETTINGS_KEY]:scheduleSettings})}
 const allLessons=loaded.items;
 // Skip teachers/lesson cells without valid Teams URLs without changing period numbering.
 // If teacher 1 has no Teams link, teacher 2's link in period 1 remains period 1.
 const schedule=PERIODS.flatMap(p=>scheduleCore.selectPeriodItems(allLessons,p.n));
 const periodCounts=Array.from({length:PERIODS.length},(_,i)=>allLessons.filter(x=>x.period===i+1).length);
 const validLinkCounts=Array.from({length:PERIODS.length},(_,i)=>scheduleCore.selectPeriodLinks(allLessons,i+1).length);
 if(!schedule.length){await setStatus("لم تُقرأ خلايا المعلمين والحصص. تأكد من ظهور جدول مرصاد ثم أعد المحاولة.",{diagnostic:true,totalItems:allLessons.length,periodCounts,validLinkCounts});return}
 await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
 const run={running:true,autoResume:!immediate,schedule,periods:PERIODS,diagnostic:{totalItems:allLessons.length,periodCounts,validLinkCounts},tabId:null,probeTabIds:[],startedAt:Date.now(),results:[],period:null,periodItems:[],index:0,cycle:1,current:null,backtestMode:immediate,immediateMode:immediate,suspendedRun,suspendedNextAt:suspendedAlarm?.scheduledTime||null};
 await saveRun(run);
 const current=immediate?(periodNow()||PERIODS[0]):periodNow();
 if(current){await beginPeriod(run,current.n)}
 else{const now=new Date();const next=nextPeriod(now);await setStatus("لا توجد حصة نشطة الآن. الوقت الحالي "+now.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+". أقرب موعد: الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,period:next.period.n,now:now.toISOString(),nextAt:next.when,periods:PERIODS});await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:next.when})}
}
async function restoreSuspendedRun(run){if(!run?.immediateMode)return false;await closeProbeTab(run);const previous=run.suspendedRun;if(previous?.running){await saveRun(previous);if(Number.isFinite(run.suspendedNextAt))await chrome.alarms.create(NEXT_ALARM,{when:Math.max(Date.now()+1000,run.suspendedNextAt)});else if(previous.period)await navigateCurrent(previous);else{const active=periodNow(),next=active?null:nextPeriod();if(active)await beginPeriod(previous,active.n);else await chrome.alarms.create(NEXT_ALARM,{when:next.when})}}else{run.running=false;run.current=null;run.immediateMode=false;await saveRun(run)}return true}
async function beginPeriod(run,periodNo){
 if(!run?.running)return;
 const p=PERIODS.find(x=>x.n===periodNo);if(!p)return;
 const now=new Date(), bounds=periodBounds(p,now,"activeOrNext"), start=bounds.start, end=bounds.end;
 if(!run.backtestMode&&now<start){await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:start.getTime()});await setStatus("ينتظر بداية الحصة "+p.n+" عند "+p.start,{waiting:true,period:p.n});return}
 if(!run.backtestMode&&now>=end){await advancePeriod(run,periodNo);return}
 const items=scheduleCore.selectPeriodItems(run.schedule,p.n);
 run.period=p.n;run.periodItems=items;run.index=0;run.current=null;run.cycle=1;run.waitingForCycle2=false;
 await saveRun(run);
  if(!items.length){if(run.immediateMode){await setStatus("لا يوجد رابط Teams صالح للحصة "+p.n+"؛ لم يُفتح رابط حصة أخرى. انتهى الفحص الفوري دون تغيير سجل الحضور.",{diagnostic:true,period:p.n,immediateMode:true,guard:"no-links-for-active-period"});await restoreSuspendedRun(run);return}const next=nextPeriod(now);await setStatus("لا يوجد رابط Teams صالح للحصة الجارية رقم "+p.n+". لم يُفتح رابط حصة أخرى؛ ينتظر مرصاد موعد الحصة التالية عند "+next.period.start+".",{diagnostic:true,period:p.n,totalItems:run.schedule.length,periodCounts:run.diagnostic?.periodCounts||[],validLinkCounts:run.diagnostic?.validLinkCounts||[],guard:"no-links-for-active-period"});await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:next.when});return}
 const delayMinutes=Math.max(1,Math.min(10,Number(scheduleSettings.scanDelay)||1));
 const firstRoundAt=start.getTime()+delayMinutes*60*1000;
 if(!run.backtestMode&&now.getTime()<firstRoundAt){
  await setStatus("الرصد جاهز للحصة "+p.n+". يبدأ الفحص بعد مرور "+delayMinutes+" دقيقة من بداية الحصة.",{period:p.n,waiting:true,cycle:1,total:items.length});
  await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:firstRoundAt});return;
 }
 if(now.getTime()>start.getTime()+10*60*1000){
  await setStatus("بدأ التشغيل بعد نافذة الدورة الأولى؛ يبدأ الرصد الآن حتى لا تُفقد الحصة.",{period:p.n,cycle:1,total:items.length});
 }else{
  await setStatus("بدأت الدورة الأولى للحصة "+p.n+": "+items.length+" رابطًا.",{period:p.n,done:0,total:items.length,cycle:1});
 }
 await navigateCurrent(run);
}
async function navigateCurrent(run){
 if(!run?.running)return;
 // Hard gate: choose the period that is active NOW, never the next/previous
 // period merely because the run state or link order still points to it.
 if(!run.backtestMode){
  const nowDate=new Date();
  const activePeriod=periodNow(nowDate);
  if(!activePeriod){
   run.current=null;await saveRun(run);
   const next=nextPeriod(nowDate);
   await chrome.alarms.clear(NEXT_ALARM);
   await chrome.alarms.create(NEXT_ALARM,{when:Math.max(Date.now()+1000,next.when)});
   await setStatus("حماية الوقت: لا توجد حصة متزامنة الآن؛ لم يُفتح أي رابط. ينتظر الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,guard:"no-active-period",period:next.period.n});
   return;
  }
  if(activePeriod.n!==run.period){
   // Drop the stale period and restart only against the currently active one.
   run.period=activePeriod.n;run.periodItems=scheduleCore.selectPeriodItems(run.schedule,activePeriod.n);
   run.index=0;run.cycle=1;run.waitingForCycle2=false;run.current=null;
   await saveRun(run);
   await setStatus("تغيّر وقت الحصة أثناء الرصد؛ ألغى مرصاد الرابط القديم وانتقل إلى الحصة المتزامنة رقم "+activePeriod.n+" فقط.",{period:activePeriod.n,guard:"period-resync"});
   if(!run.periodItems.length){if(run.immediateMode){await setStatus("لا توجد خلايا مقروءة للحصة "+activePeriod.n+". انتهى الفحص الفوري دون تغيير سجل الحضور.",{period:activePeriod.n,immediateMode:true,guard:"no-items-for-active-period"});await restoreSuspendedRun(run);return}const next=nextPeriod(nowDate);await setStatus("لا توجد خلايا معلمين مقروءة للحصة الجارية رقم "+activePeriod.n+"؛ لم يُفتح أي رابط آخر، وينتظر مرصاد الحصة "+next.period.n+".",{period:activePeriod.n,guard:"no-items-for-active-period",waiting:true});await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:next.when});return;}
  }
 }
 const p=PERIODS.find(x=>x.n===run.period);
 if(!p)return;
 // Verify the active time window again immediately before opening each link.
 if(!run.backtestMode){
  const bounds=periodBounds(p,new Date(),"past");
  const now=Date.now();
  const active=periodNow(new Date(now));
  if(!bounds || now<bounds.start.getTime() || now>=bounds.end.getTime() || !active || active.n!==p.n){
   run.current=null;await saveRun(run);
   const next=nextPeriod(new Date(now));
   await chrome.alarms.clear(NEXT_ALARM);
   await chrome.alarms.create(NEXT_ALARM,{when:Math.max(now+1000,next.when)});
   await setStatus("منع مرصاد فتح الرابط: رقم الحصة لا يطابق الحصة النشطة أو أن الوقت خارج نافذتها.",{period:p.n,waiting:true,guard:"period-time-mismatch",activePeriod:active?.n||null});
   return;
  }
 }
 if(run.index>=run.periodItems.length){
   run.current=null;
   await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
   await chrome.alarms.clear(NEXT_ALARM);
   if(run.backtestMode){
    await setStatus("اكتمل الفحص الفوري التشخيصي للحصة "+p.n+". النتائج لا تغيّر سجل الحضور.",{period:p.n,immediateMode:true,done:run.periodItems.length,total:run.periodItems.length});
    await restoreSuspendedRun(run);
   }else if(run.cycle<scheduleSettings.roundCount){
    // Wait from end of one complete scan to next; never cross the lesson boundary.
    const bounds=periodBounds(p,new Date(),"past");
    const nextAt=Date.now()+scheduleSettings.roundGapMinutes*60000;
    if(bounds&&nextAt<bounds.end.getTime()){
      run.waitingForCycle2=true;run.nextCycleAt=nextAt;await saveRun(run);
      await chrome.alarms.create(NEXT_ALARM,{when:nextAt});
      await setStatus("اكتملت الدورة "+run.cycle+" للحصة "+p.n+"؛ تنتظر الدورة "+(run.cycle+1)+" بعد "+scheduleSettings.roundGapMinutes+" دقائق.",{period:p.n,cycle:run.cycle,waiting:true,nextAt});
    }else{
      await setStatus("انتهى الرصد للحصة "+p.n+"؛ لا تكفي المدة لدورة أخرى داخل الحصة.",{period:p.n,cycle:run.cycle});
      await advancePeriod(run,p.n);
    }
   }else{
    await setStatus("اكتمل الرصد للحصة "+p.n+" بعد "+run.cycle+" دورات.",{period:p.n,done:run.periodItems.length,total:run.periodItems.length});
    await advancePeriod(run,p.n);
   }
   return;
 }
 const item=run.periodItems[run.index];
 if(!item.url){const record={teacher:item.teacher,scheduledTeacher:item.teacher,period:run.period,subject:item.subject||"",className:item.className||"",url:"",status:"no-link",detail:"لا يوجد رابط Teams لهذه الحصة؛ لم يُسجّل غياب.",scannedAt:Date.now(),cycle:run.cycle||0};run.results.push(record);if(!run.testMode&&!run.backtestMode)await appendDailyReport(record);run.index++;run.current=null;await saveRun(run);await setStatus("الحصة "+p.n+" — "+item.teacher+": لا يوجد رابط Teams؛ يتابع مرصاد المعلم التالي.",{period:p.n,teacher:item.teacher,done:run.index,total:run.periodItems.length,cycle:run.cycle,last:record});await navigateCurrent(run);return}
 if(!isTeamsMeetingUrl(item.url)){run.results.push({teacher:item.teacher,scheduledTeacher:item.teacher,period:run.period,subject:item.subject||"",className:item.className||"",status:"unresolved",detail:"تجاوز مرصاد رابطًا لا يطابق نطاقات Teams المسموحة؛ لم يفتحه.",scannedAt:Date.now(),cycle:run.cycle});run.index++;run.current=null;await saveRun(run);await navigateCurrent(run);return}
 run.current={...item,scanId:String(run.period)+"-"+String(run.cycle)+"-"+String(run.index)+"-"+String(Date.now())};await saveRun(run);
 await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await chrome.alarms.create(SCAN_TIMEOUT_ALARM,{when:Date.now()+SCAN_TIMEOUT_MS});
 await setStatus("الحصة "+p.n+" — "+item.teacher+" ("+(run.index+1)+"/"+run.periodItems.length+")، الدورة "+run.cycle,{period:p.n,teacher:item.teacher,done:run.index,total:run.periodItems.length,cycle:run.cycle});
 try{const tabId=await ensureProbeTab(run);await chrome.tabs.update(tabId,{url:item.url,active:true})}
 catch(_){run.results.push({teacher:item.teacher,scheduledTeacher:item.teacher,period:p.n,subject:item.subject||"",className:item.className||"",status:"unresolved",detail:"تعذر فتح الرابط",scannedAt:Date.now(),cycle:run.cycle});run.index++;run.current=null;await saveRun(run);await navigateCurrent(run)}
}
async function advancePeriod(run,after){
 if(!run?.running)return;
 const next=PERIODS.find(p=>p.n>after);
 if(!next){
   const nxt=nextPeriod(new Date(Date.now()+1000));
   await setStatus("انتهت حصص اليوم. ينتظر مرصاد الحصة "+nxt.period.n+" في "+nxt.period.start+" في يوم دراسي قادم.",{waiting:true,period:nxt.period.n});
   await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:nxt.when});
   return
 }
 await beginPeriod(run,next.n)
}
async function receiveResult(message){
 const run=await getRun();if(!run?.running||!run.current)return;
 const item=run.current;
 if(!message.scanId||message.scanId!==item.scanId)return;
 await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
 const scannedAt=Date.now();
 let status=message.result?.status||"unresolved";
 let detail=message.result?.detail||"لم تُرجع واجهة Teams نتيجة واضحة";
 const resultTeacher=message.result?.teacher||item.teacher;
 const evidenceTeacher=message.result?.evidenceTeacher||resultTeacher;
 if(status==="absent"){
  const stored=await chrome.storage.local.get("mirsadEvidenceRecords");
  const verified=Array.isArray(stored.mirsadEvidenceRecords)&&stored.mirsadEvidenceRecords.some(record=>record.status==="absent"&&record.evidenceVerified===true&&record.scanId===message.scanId&&String(record.teacher)===String(evidenceTeacher)&&String(record.period)===String(run.period));
  if(!verified){status="unresolved";detail="لم يُعتمد الغياب لعدم وجود لقطة محفوظة ومتحقق منها لاسم المعلم ضمن المدعوين؛ الحالة غير محسومة."}
 }
 const resultRecord={scanId:item.scanId,teacher:resultTeacher,scheduledTeacher:item.teacher,period:run.period,subject:item.subject||"",className:item.className||"",url:item.url,status,detail,scannedAt,cycle:run.cycle||0};
 run.results.push(resultRecord);
 if(!run.testMode&&!run.backtestMode){await appendDailyReport(resultRecord);await CloudMonitoring.record(run,resultRecord).catch(()=>{})}

 run.index++;run.current=null;
 if(run.testMode&&!run.backtestMode){run.running=false;await saveRun(run);await closeProbeTab(run);await setStatus("اكتمل الاختبار المباشر لرابط واحد: "+item.teacher+" — "+(message.result?.detail||message.result?.status||"غير محسوم")+". أُغلقت صفحة الاختبار تلقائيًا. النتيجة تشخيصية فقط.",{testMode:true,last:run.results[run.results.length-1]});return}
 await saveRun(run);
 await closeProbeTab(run);
 await setStatus("تم فحص "+run.index+" من "+run.periodItems.length+" في الحصة "+run.period+"؛ أُغلق تبويب الفحص.",{period:run.period,done:run.index,total:run.periodItems.length,cycle:run.cycle,last:run.results[run.results.length-1]});
 await navigateCurrent(run)
}
chrome.alarms.onAlarm.addListener(async alarm=>{
 await refreshScheduleSettings();
 const run=await getRun();if(!run?.running)return;
 if(alarm.name===SCAN_TIMEOUT_ALARM){
  if(!run.current)return;
  const item=run.current;
  if(typeof navigator!=="undefined"&&navigator.onLine===false){
   run.current=null;run.waitingForReconnect=true;await saveRun(run);await closeProbeTab(run);
   await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:Date.now()+RECONNECT_RETRY_MS});
   await setStatus("انقطع اتصال الإنترنت أثناء الحصة "+run.period+"؛ أوقف مرصاد تسجيل نتيجة مؤقتة وسيعيد قائمة الحصة من أولها عند عودة الاتصال.",{period:run.period,waiting:true,waitingForReconnect:true});return;
  }
  const timeoutRecord={teacher:item.teacher,scheduledTeacher:item.teacher,period:run.period,subject:item.subject||"",className:item.className||"",url:item.url,status:"unresolved",detail:"انتهت مهلة انتظار Teams دون نتيجة؛ لم يُسجّل غياب.",scannedAt:Date.now(),cycle:run.cycle||0};
  run.results.push(timeoutRecord);
  if(!run.testMode&&!run.backtestMode)await appendDailyReport(timeoutRecord);
  run.index++;run.current=null;
  if(run.testMode&&!run.backtestMode){run.running=false;await saveRun(run);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await closeProbeTab(run);await setStatus("انتهت مهلة الاختبار المباشر دون نتيجة من Teams. أُغلقت صفحة الاختبار تلقائيًا؛ لم يُسجّل غياب.",{testMode:true,last:run.results[run.results.length-1]});return}
  await saveRun(run);
  await closeProbeTab(run);
  await setStatus("انتهت مهلة فحص "+item.teacher+"؛ أُغلق تبويب الفحص وسُجلت غير محسومة.",{period:run.period,teacher:item.teacher,cycle:run.cycle});
  await navigateCurrent(run);return;
 }
 if(alarm.name!==NEXT_ALARM)return;
 if(run.waitingForReconnect){
  if(typeof navigator!=="undefined"&&navigator.onLine===false){await chrome.alarms.create(NEXT_ALARM,{when:Date.now()+RECONNECT_RETRY_MS});return}
  run.waitingForReconnect=false;const active=periodNow(new Date());
  if(active){await setStatus("عاد الاتصال؛ يعيد مرصاد قائمة الحصة "+active.n+" من أول رابط.",{period:active.n,reconnected:true});await beginPeriod(run,active.n);return}
  run.period=null;run.periodItems=[];run.index=0;run.current=null;await saveRun(run);const next=nextPeriod(new Date());await chrome.alarms.create(NEXT_ALARM,{when:next.when});await setStatus("عاد الاتصال بعد انتهاء وقت الحصة؛ ينتظر مرصاد الحصة "+next.period.n+".",{period:next.period.n,waiting:true,reconnected:true});return;
 }
 if(run.period){const p=PERIODS.find(x=>x.n===run.period);if(p&&Date.now()<periodBounds(p,new Date(),"past").end.getTime()){
   if(run.waitingForCycle2){
    const now=new Date(),bounds=periodBounds(p,now,"past"),active=periodNow(now);
    if(!bounds||now.getTime()<bounds.start.getTime()||now.getTime()>=bounds.end.getTime()||!active||active.n!==p.n){run.waitingForCycle2=false;await saveRun(run);await setStatus("أُلغيت الدورة الثانية للحصة "+p.n+" لأن الوقت الحالي لم يعد داخل نافذة الحصة نفسها.",{period:p.n,cycle:1,cycle2Skipped:true});await advancePeriod(run,p.n);return}
    run.waitingForCycle2=false;run.nextCycleAt=null;run.cycle=Math.min(run.cycle+1,scheduleSettings.roundCount);run.index=0;run.periodItems=scheduleCore.selectPeriodItems(run.schedule,run.period);await saveRun(run);await setStatus("بدأت الدورة "+run.cycle+" للحصة "+p.n+" بعد التحقق من رقم الحصة ووقتها.",{period:p.n,cycle:2,done:0,total:run.periodItems.length});await navigateCurrent(run);return}
   if(!run.current&&run.index===0&&(run.cycle||1)===1){await beginPeriod(run,run.period)}else{await navigateCurrent(run)}return
  }await advancePeriod(run,run.period);return}
 const now=new Date();const p=periodNow(now);if(p)await beginPeriod(run,p.n);else{const next=nextPeriod(now);await setStatus("لا توجد حصة نشطة الآن. الوقت الحالي "+now.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})+". أقرب موعد: الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,period:next.period.n,now:now.toISOString(),nextAt:next.when,periods:PERIODS});await chrome.alarms.create(NEXT_ALARM,{when:next.when})}
});
async function recoverPersistedRunAfterBrowserStart(){
 await refreshScheduleSettings();const run=await getRun();if(!run?.running||run.autoResume===false)return;
 await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);run.current=null;run.waitingForReconnect=false;await closeProbeTab(run);
 const active=periodNow(new Date());
 if(active){run.running=true;run.backtestMode=false;run.immediateMode=false;run.suspendedRun=null;run.index=0;run.cycle=1;await setStatus("استعاد مرصاد التشغيل بعد إعادة فتح Chrome؛ يبدأ قائمة الحصة "+active.n+" من أول رابط.",{period:active.n,recovered:true});await beginPeriod(run,active.n);return}
 run.period=null;run.periodItems=[];run.index=0;run.cycle=1;await saveRun(run);const next=nextPeriod(new Date());await chrome.alarms.create(NEXT_ALARM,{when:next.when});await setStatus("استعاد مرصاد التشغيل بعد إعادة فتح Chrome؛ ينتظر موعد الحصة "+next.period.n+".",{period:next.period.n,waiting:true,recovered:true});
}
chrome.runtime.onStartup?.addListener(()=>{recoverPersistedRunAfterBrowserStart().catch(()=>{})});
chrome.runtime.onInstalled?.addListener(details=>{if(details?.reason==="update")recoverPersistedRunAfterBrowserStart().catch(()=>{})});
async function labelEvidenceCapture(dataUrl,teacher,status,period,cycle){
 const bitmap=await createImageBitmap(await (await fetch(dataUrl)).blob());
 try{
  // Append a caption below the original screenshot; never cover the participant list.
  const canvas=new OffscreenCanvas(Math.max(bitmap.width,600),bitmap.height+100);
  const ctx=canvas.getContext("2d");if(!ctx)throw new Error("Unable to annotate evidence");
  ctx.fillStyle="#ffffff";ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0);
  const title=String(teacher||"معلم")+" — "+(status==="absent"?"غائب":"غير محسوم");
  ctx.fillStyle=status==="absent"?"#991b1b":"#854d0e";ctx.fillRect(0,bitmap.height,canvas.width,100);
  ctx.fillStyle="#ffffff";ctx.direction="rtl";ctx.textAlign="right";ctx.textBaseline="top";ctx.font="bold 28px Arial";
  ctx.fillText(title,canvas.width-20,bitmap.height+14,canvas.width-40);
  ctx.font="18px Arial";ctx.fillText("الحصة "+String(period||"")+" — الدورة "+String(cycle||"")+" — "+new Date().toLocaleString("ar-SA"),canvas.width-20,bitmap.height+59,canvas.width-40);
  const bytes=new Uint8Array(await (await canvas.convertToBlob({type:"image/png"})).arrayBuffer());
  let binary="";for(let i=0;i<bytes.length;i+=32768)binary+=String.fromCharCode(...bytes.subarray(i,i+32768));
  return "data:image/png;base64,"+btoa(binary);
 }finally{bitmap.close()}
}

async function waitForEvidenceDownload(downloadId){
 for(let attempt=0;attempt<40;attempt++){
  const [item]=await chrome.downloads.search({id:downloadId});
  if(item?.state==="complete")return item;
  if(item?.state==="interrupted")throw new Error(item.error||"Evidence download interrupted");
  await new Promise(resolve=>setTimeout(resolve,250));
 }
 throw new Error("Evidence download did not complete");
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type==='MIRSAD_DASHBOARD_ROUNDS'){
  (async()=>{const count=Number(message.count),gap=Number(message.gap);if(!Number.isInteger(count)||count<1||count>3||!Number.isInteger(gap)||gap<1||gap>10)throw new Error('الدورات 1–3 والفاصل 1–10 دقائق');const run=await getRun();if(run?.running)throw new Error('أوقف الرصد قبل تغيير الإعدادات');const frozen=(await chrome.storage.local.get('mirsadDriveDay')).mirsadDriveDay;if(frozen?.date===MirsadMonitorModel.day()&&frozen.snapshot.roundCount!==count)throw new Error('عدد الدورات مثبت في أرشيف اليوم؛ غيّره قبل بداية يوم جديد');await refreshScheduleSettings();scheduleSettings={...scheduleSettings,roundCount:count,roundGapMinutes:gap};await chrome.storage.local.set({[SCHEDULE_SETTINGS_KEY]:scheduleSettings});sendResponse({ok:true})})().catch(e=>sendResponse({ok:false,error:e.message}));return true
 }
 if(message?.type==='MIRSAD_DRIVE_CONFIG'){CloudMonitoring.configure(String(message.url||''),String(message.key||'')).then(sendResponse).catch(e=>sendResponse({ok:false,error:e.message}));return true}
 if(message?.type==='MIRSAD_BEGIN_DAY'){CloudMonitoring.beginDay().then(day=>sendResponse({ok:true,day})).catch(e=>sendResponse({ok:false,error:e.message}));return true}
 if(message?.type==='MIRSAD_DRIVE_INFO'){CloudMonitoring.info().then(info=>sendResponse({ok:true,...info}));return true}
 if(message?.type==='MIRSAD_DRIVE_RETRY'){CloudMonitoring.flush().then(()=>sendResponse({ok:true}));return true}

 if(message?.type==="MIRSAD_START"){startMonitoring(false).then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true}
 if(message?.type==="MIRSAD_START_NOW"){startMonitoring(true).then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true}
 if(message?.type==="MIRSAD_STOP"){getRun().then(async run=>{if(run){run.running=false;run.autoResume=false;await saveRun(run);await closeProbeTab(run)}await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await setStatus("تم إيقاف المراقبة بناءً على طلبك؛ لن تُستأنف تلقائيًا.");sendResponse({ok:true})});return true}
 if(message?.type==="MIRSAD_STATUS"){Promise.all([chrome.storage.local.get(STATUS_KEY),getRun()]).then(([s,r])=>sendResponse({status:s[STATUS_KEY]||{text:"لا توجد حالة"},run:r}));return true}
 if(message?.type==="MIRSAD_GET_LIVE_REPORT"){
  (async()=>{
   await refreshScheduleSettings();
   const [run,stored]=await Promise.all([getRun(),chrome.storage.local.get([DAILY_REPORT_KEY,"mirsadManualAttendanceOverrides","mirsadManualMappings",SCHEDULE_SETTINGS_KEY])]);
   let schedule=[],periods=[];
   const tab=await getScheduleTab();
   if(tab){try{const current=await loadPeriodsFromSchedule(tab.id);schedule=current.items;periods=current.periods}catch(_){}}
   sendResponse({ok:true,run:run||{},schedule,dailyReports:stored[DAILY_REPORT_KEY]||{},manualOverrides:stored.mirsadManualAttendanceOverrides||{},manualMappings:stored.mirsadManualMappings||{},scheduleSettings:stored[SCHEDULE_SETTINGS_KEY]||DEFAULT_SCHEDULE_SETTINGS,periods});
  })().catch(()=>sendResponse({ok:false}));
  return true
 }
 if(message?.type==="MIRSAD_SAVE_SCHEDULE_SETTINGS"){
 (async()=>{const settings=message.settings||{},candidate={manualStart:String(settings.manualStart||""),periodDuration:Number(settings.periodDuration),manualGapMinutes:Number(settings.manualGapMinutes),periodCount:7,scanDelay:Number(settings.scanDelay),roundCount:Number(settings.roundCount),roundGapMinutes:Number(settings.roundGapMinutes)};if(parseClock(candidate.manualStart)===null||!Number.isInteger(candidate.periodDuration)||candidate.periodDuration<1||candidate.periodDuration>180||!Number.isInteger(candidate.manualGapMinutes)||candidate.manualGapMinutes<0||candidate.manualGapMinutes>60||!Number.isInteger(candidate.scanDelay)||candidate.scanDelay<1||candidate.scanDelay>10||!Number.isInteger(candidate.roundCount)||candidate.roundCount<1||candidate.roundCount>3||!Number.isInteger(candidate.roundGapMinutes)||candidate.roundGapMinutes<1||candidate.roundGapMinutes>10){sendResponse({ok:false,reason:"invalid"});return}scheduleSettings={...candidate,updatedAt:Date.now()};PERIODS=activePeriods(scheduleSettings);await chrome.storage.local.set({[SCHEDULE_SETTINGS_KEY]:scheduleSettings});const run=await getRun();if(run?.running&&!run.current&&!run.immediateMode){await chrome.alarms.clear(NEXT_ALARM);run.period=null;run.periodItems=[];run.index=0;run.periods=PERIODS;await saveRun(run);const current=periodNow();if(current)await beginPeriod(run,current.n);else{const next=nextPeriod();await setStatus("تم تحديث التوقيت اليدوي. ينتظر مرصاد الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,period:next.period.n});await chrome.alarms.create(NEXT_ALARM,{when:next.when})}}else await setStatus("حُفظت إعدادات التوقيت اليدوي. لا يحتاج حفظها إلى فتح جدول مرصاد.",{scheduleSettings,periods:PERIODS});sendResponse({ok:true,settings:scheduleSettings,periods:PERIODS})})().catch(()=>sendResponse({ok:false}));return true
 } if(message?.type==="MIRSAD_SAVE_MAPPING"){
  (async()=>{
   if(!message.teamsName){sendResponse({ok:false});return}
   const key="mirsadManualMappings",saved=await chrome.storage.local.get(key);
   const mappings=saved[key]&&typeof saved[key]==="object"?saved[key]:{};
   if(message.teacher)mappings[String(message.teamsName)]=String(message.teacher);else delete mappings[String(message.teamsName)];
   await chrome.storage.local.set({[key]:mappings});
   sendResponse({ok:true,mappings});
  })().catch(()=>sendResponse({ok:false}));
  return true
 }
 if(message?.type==="MIRSAD_SET_MANUAL_STATUS"){
  (async()=>{const key="mirsadManualAttendanceOverrides";const saved=await chrome.storage.local.get(key);const overrides=saved[key]&&typeof saved[key]==="object"?saved[key]:{};const k=String(message.day||localDayKey())+"|"+String(message.period||"")+"|"+String(message.teacher||"");if(!message.teacher||!message.period){sendResponse({ok:false});return}if(message.status==="clear")delete overrides[k];else if(["present","absent"].includes(message.status))overrides[k]={status:message.status,updatedAt:Date.now(),updatedBy:"manual"};else{sendResponse({ok:false});return}await chrome.storage.local.set({[key]:overrides});sendResponse({ok:true})})().catch(()=>sendResponse({ok:false}));return true
 }
 if(message?.type==="MIRSAD_PAGE_READY"){getRun().then(run=>sendResponse(run?.running&&run.current?{active:true,teacher:run.current.teacher,period:run.period,index:run.index,scanId:run.current.scanId}:{active:false}));return true}
 if(message?.type==="MIRSAD_CAPTURE_EVIDENCE"){
  (async()=>{
   const proof=message.evidence;
   const isAbsence=message.status==="absent",isDiagnostic=message.status==="unresolved";
   if((!isAbsence&&!isDiagnostic)||!sender.tab?.id||!sender.tab?.windowId||(isAbsence&&(proof?.verified!==true||proof?.teacherInInvitees!==true||proof?.teacherNotPresent!==true||proof?.inviteesReadable!==true))) {sendResponse({ok:false});return}
   try{
    const run=await getRun();
    if(!run?.running||run.current?.scanId!==message.scanId||![run.tabId,...(run.probeTabIds||[])].includes(sender.tab.id)){sendResponse({ok:false,error:"Stale or unrelated scan"});return}
    const [activeTab,sourceTab]=await Promise.all([
     chrome.tabs.query({active:true,windowId:sender.tab.windowId}).then(tabs=>tabs[0]),
     chrome.tabs.get(sender.tab.id)
    ]);
    if(activeTab?.id!==sender.tab.id||!/^https:\/\/(?:teams\.microsoft\.com|teams\.live\.com)\//i.test(sourceTab.url||"")){sendResponse({ok:false,error:"Teams tab is not active"});return}
    const screenshot=await chrome.tabs.captureVisibleTab(sender.tab.windowId,{format:"png"});
    const dataUrl=await labelEvidenceCapture(screenshot,message.teacher,message.status,message.period,run.cycle);
    const now=Date.now();
    const safeName=String(message.teacher||"معلم").replace(/[\\/:*?"<>|]/g,"_").slice(0,70);
    const filename="Data Copy/توثيق غياب "+MirsadMonitorModel.day(new Date(now))+"/"+safeName+"_"+(isAbsence?"غائب":"غير_محسوم")+"_ح"+String(message.period||"").replace(/[^0-9]/g,"")+"_"+new Date(now).toISOString().replace(/[:.]/g,"-")+".png";
    const downloadId=await chrome.downloads.download({url:dataUrl,filename,saveAs:false,conflictAction:"uniquify"});
    const completedDownload=await waitForEvidenceDownload(downloadId);
    const savedFilename=completedDownload.filename||filename;
    const evidenceKey="mirsadEvidenceRecords";
    const saved=await chrome.storage.local.get(evidenceKey);
    const records=Array.isArray(saved[evidenceKey])?saved[evidenceKey]:[];
    records.push({teacher:message.teacher||"",period:message.period||"",status:message.status,detail:message.detail||"",capturedAt:now,filename:savedFilename,downloadId,scanId:message.scanId||"",evidenceVerified:isAbsence,tabId:sender.tab.id,tabUrl:sourceTab.url});
    await chrome.storage.local.set({[evidenceKey]:records.slice(-1000)});
    await CloudMonitoring.capture(run,message,dataUrl,now,savedFilename).catch(()=>{});
    sendResponse({ok:true,filename:savedFilename,downloadId});
   }catch(error){sendResponse({ok:false,error:String(error?.message||error)})}
  })();return true
 }
 if(message?.type==="MIRSAD_SCAN_RESULT"){receiveResult(message).catch(()=>{});sendResponse({ok:true});return false}
});
