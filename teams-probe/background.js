const KEY="mirsadAutoRun", STATUS_KEY="mirsadAutoStatus", NEXT_ALARM="mirsadNextAction", SCAN_TIMEOUT_ALARM="mirsadScanTimeout";
const SCHEDULE_SETTINGS_KEY="mirsadScheduleSettings";
const DEFAULT_SCHEDULE_SETTINGS={mode:"automatic",manualStart:"06:30",cycleMinute:5,basePeriods:[]};
let scheduleSettings={...DEFAULT_SCHEDULE_SETTINGS};
let PERIODS=[];
function parseClock(v){const m=/^(\d{1,2}):(\d{2})$/.exec(String(v||""));return m?Number(m[1])*60+Number(m[2]):null}
function clockText(n){n=((n%1440)+1440)%1440;return String(Math.floor(n/60)).padStart(2,"0")+":"+String(n%60).padStart(2,"0")}
function makePeriods(base,settings){if(!Array.isArray(base)||base.length!==7)return [];const b=[];let previousStart=null;for(let i=0;i<base.length;i++){const p=base[i]||{};let start=parseClock(p.start),end=parseClock(p.end);if(start===null)start=Number(p.startOffset);if(end===null)end=Number(p.endOffset);if(!Number.isFinite(start)||!Number.isFinite(end))return [];start=((start%1440)+1440)%1440;end=((end%1440)+1440)%1440;if(previousStart!==null&&start<previousStart)start+=1440;if(end<=start)end+=1440;if(end-start>180)return [];b.push({n:i+1,startOffset:start,endOffset:end});previousStart=start}let delta=0;if(settings.mode==="manual"){const wanted=parseClock(settings.manualStart);if(wanted===null)return [];delta=wanted-b[0].startOffset}return b.map(p=>({n:p.n,startOffset:p.startOffset+delta,endOffset:p.endOffset+delta,start:clockText(p.startOffset+delta),end:clockText(p.endOffset+delta)}))}
async function refreshScheduleSettings(){const saved=await chrome.storage.local.get(SCHEDULE_SETTINGS_KEY);scheduleSettings={...DEFAULT_SCHEDULE_SETTINGS,...(saved[SCHEDULE_SETTINGS_KEY]||{})};PERIODS=makePeriods(scheduleSettings.basePeriods,scheduleSettings);return scheduleSettings}
refreshScheduleSettings().catch(()=>{});
async function loadPeriodsFromSchedule(tabId){const response=await chrome.tabs.sendMessage(tabId,{type:"MIRSAD_GET_SCHEDULE"});const items=(response?.items||[]).filter(x=>x.teacher&&x.hasLesson&&Number.isFinite(x.period)&&x.period>=1&&x.period<=7);const base=response?.periods;if(!Array.isArray(base)||base.length!==7||base.some(p=>!Number.isFinite(p.startOffset)||!Number.isFinite(p.endOffset)))throw new Error("تعذر قراءة أوقات الحصص السبعة من جدول مرصاد. حدّث صفحة الجدول وتأكد من ظهور الأوقات.");const saved=await chrome.storage.local.get(SCHEDULE_SETTINGS_KEY);scheduleSettings={...DEFAULT_SCHEDULE_SETTINGS,...(saved[SCHEDULE_SETTINGS_KEY]||{}),basePeriods:base};await chrome.storage.local.set({[SCHEDULE_SETTINGS_KEY]:scheduleSettings});PERIODS=makePeriods(base,scheduleSettings);if(PERIODS.length!==7)throw new Error("أوقات الجدول غير صالحة.");return {items,periods:PERIODS}}
const CYCLE_GAP_MS=15000;
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
  const absentCount=conclusive.filter(x=>x.scanStatus==="absent").length;
  const everPresent=presentCount>0;
  const wasAbsentBeforePresent=group.some(x=>x.scanStatus==="absent")&&everPresent;
  const percent=conclusive.length?Math.round(presentCount/conclusive.length*100):0;
  for(const item of group){
   item.attendanceStatus=everPresent?(wasAbsentBeforePresent?"late":"present"):(absentCount?"absent":"unresolved");
   item.attendancePercent=percent;
   item.presentCycles=presentCount;
   item.countedCycles=conclusive.length;
   // status is the summarized status shown by reports; scanStatus preserves
   // the original result for each cycle, including the initial absence.
   item.status=item.attendanceStatus;
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
function schoolDay(date){if(scheduleSettings.mode==="manual")return true;return date.getDay()!==5&&date.getDay()!==6}
function periodBounds(p,now=new Date(),mode="activeOrNext"){
 const candidates=[];
 for(let dayOffset=-2;dayOffset<=2;dayOffset++){
  const anchor=new Date(now);anchor.setDate(anchor.getDate()+dayOffset);anchor.setHours(0,0,0,0);
  if(!schoolDay(anchor))continue;
  const start=dateAtOffset(anchor,p.startOffset);
  const end=dateAtOffset(anchor,p.endOffset);
  candidates.push({start,end,anchor});
 }
 const active=candidates.find(x=>now>=x.start&&now<=x.end);
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
 const active=PERIODS.find(p=>{const b=periodBounds(p,now,"active");return b&&now>=b.start&&now<=b.end});
 return active||null;
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
async function getScheduleTab(){const tabs=await chrome.tabs.query({url:"https://mirsad-school.onrender.com/*"});return tabs.find(t=>t.url&&!t.url.includes("/absence.html")&&!t.url.includes("/automatic-attendance.html"))||null}
async function startOneOffTest(){
 const existing=await getRun();
 if(existing?.running){await setStatus("أوقف المراقبة الحالية أولًا قبل الاختبار المباشر.");return}
 await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
 const scheduleTab=await getScheduleTab();
 if(!scheduleTab){await setStatus("افتح صفحة جدول مرصاد التي تحتوي على روابط Teams أولًا.");return}
 let response;
 try{response=await chrome.tabs.sendMessage(scheduleTab.id,{type:"MIRSAD_GET_SCHEDULE"})}catch(_){await setStatus("تعذرت قراءة الجدول. حدّث صفحة مرصاد ثم أعد المحاولة.");return}
 const items=(response?.items||[]).filter(x=>x.teacher&&x.hasLesson&&Number.isFinite(x.period)&&x.period>=1&&x.period<=7&&isTeamsMeetingUrl(x.url));
 if(!items.length){await setStatus("لم أجد أي رابط Teams صالحًا للاختبار. تحقق من ظهور أزرار Teams في جدول مرصاد وحدّث الصفحة.");return}
 const item=items[0];
 const scanId="test-"+Date.now();
 const run={running:true,testMode:true,schedule:items,tabId:null,probeTabIds:[],startedAt:Date.now(),results:[],period:item.period,periodItems:[item],index:0,cycle:0,current:{...item,scanId}};
 await saveRun(run);
 await setStatus("اختبار مباشر: فتح رابط حصة واحدة للمعلم "+item.teacher+". هذه نتيجة تشخيصية وليست تسجيل حضور رسمي.",{testMode:true,teacher:item.teacher,period:item.period});
 await chrome.alarms.create(SCAN_TIMEOUT_ALARM,{when:Date.now()+30000});
 try{const tabId=await ensureProbeTab(run);await chrome.tabs.update(tabId,{url:item.url,active:false})}catch(_){
   run.running=false;run.current=null;run.results.push({teacher:item.teacher,period:item.period,status:"unresolved",detail:"تعذر فتح رابط الاختبار",scannedAt:Date.now(),cycle:0});await saveRun(run);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await closeProbeTab(run);await setStatus("تعذر فتح رابط الاختبار؛ أُغلقت صفحة الاختبار.");
 }
}
async function startMonitoring(){
 const existing=await getRun();
 if(existing?.running){await setStatus("المراقبة تعمل بالفعل؛ لن تُفتح دورة ثانية.",{period:existing.period,waiting:!existing.period});return}
 await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
 const scheduleTab=await getScheduleTab();
 if(!scheduleTab){await setStatus("افتح صفحة جدول مرصاد التي تعرض أوقات الحصص وروابط Teams، ثم شغّل المراقبة.");return}
 let loaded;
 try{loaded=await loadPeriodsFromSchedule(scheduleTab.id)}catch(error){await setStatus(error?.message||"تعذرت قراءة أوقات الحصص من جدول مرصاد.");return}
 const schedule=loaded.items;
 const periodCounts=Array.from({length:7},(_,i)=>schedule.filter(x=>x.period===i+1).length);
 const validLinkCounts=Array.from({length:7},(_,i)=>schedule.filter(x=>x.period===i+1&&isTeamsMeetingUrl(x.url)).length);
 if(!schedule.length){await setStatus("قرأ مرصاد الجدول لكنه لم يجد حصصًا قابلة للرصد. حدّث صفحة الجدول وتأكد من ظهور بطاقات الدروس.",{diagnostic:true,totalItems:0,periodCounts,validLinkCounts});return}
 const run={running:true,schedule,periods:PERIODS,diagnostic:{totalItems:schedule.length,periodCounts,validLinkCounts},tabId:null,probeTabIds:[],startedAt:Date.now(),results:[],period:null,periodItems:[],index:0,cycle:1,current:null};
 await saveRun(run);
 const current=periodNow();
 if(current){await beginPeriod(run,current.n)}
 else{const next=nextPeriod();await setStatus("الرصد جاهز. ينتظر بداية الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,period:next.period.n});await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:next.when})}
}
async function beginPeriod(run,periodNo){
 if(!run?.running)return;
 const p=PERIODS.find(x=>x.n===periodNo);if(!p)return;
 const now=new Date(), bounds=periodBounds(p,now,"activeOrNext"), start=bounds.start, end=bounds.end;
 if(now<start){await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:start.getTime()});await setStatus("ينتظر بداية الحصة "+p.n+" عند "+p.start,{waiting:true,period:p.n});return}
 if(now>end){await advancePeriod(run,periodNo);return}
 const items=run.schedule.filter(x=>x.period===p.n);
 run.period=p.n;run.periodItems=items;run.index=0;run.current=null;run.cycle=1;
 await saveRun(run);
 if(!items.length){await setStatus("لم يبدأ فحص الحصة "+p.n+": لا توجد دروس مقروءة لهذه الحصة. إجمالي الدروس المقروءة "+run.schedule.length+". أعداد الحصص: "+(run.diagnostic?.periodCounts||[]).join("، ")+".",{diagnostic:true,period:p.n,totalItems:run.schedule.length,periodCounts:run.diagnostic?.periodCounts||[],validLinkCounts:run.diagnostic?.validLinkCounts||[]});await advancePeriod(run,p.n);return}
 const cycleMinute=Math.max(1,Math.min(10,Number(scheduleSettings.cycleMinute)||5));
 const firstRoundAt=start.getTime()+cycleMinute*60*1000;
 if(now.getTime()<firstRoundAt){
  await setStatus("الرصد جاهز للحصة "+p.n+". تبدأ الدورة الأولى بعد مرور "+cycleMinute+" دقيقة من بداية الحصة.",{period:p.n,waiting:true,cycle:1,total:items.length});
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
 const p=PERIODS.find(x=>x.n===run.period);
 if(!p)return;
 if(!run.backtestMode&&Date.now()>periodBounds(p,new Date(),"past").end.getTime()){await advancePeriod(run,run.period);return}
 if(run.index>=run.periodItems.length){
   run.current=null;
   await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
   await chrome.alarms.clear(NEXT_ALARM);
   if((run.cycle||1)===1){
    // Round 2 begins immediately after the last teacher in round 1 finishes.
    // Once round 2 finishes, the scanner rests until the next lesson.
    run.cycle=2;run.index=0;run.periodItems=run.schedule.filter(x=>x.period===run.period);
    await saveRun(run);
    await setStatus("اكتملت الدورة الأولى للحصة "+p.n+". تبدأ الدورة الثانية الآن.",{period:p.n,cycle:2,done:0,total:run.periodItems.length});
    await navigateCurrent(run);
   }else{
    if(run.backtestMode){
     run.running=false;run.current=null;await saveRun(run);await closeProbeTab(run);
     await setStatus("اكتمل الاختبار الرجعي للحصة "+p.n+" بعد دورتين. هذه نتائج اختبار مباشر الآن وليست سجل حضور تاريخيًا.",{period:p.n,cycle:2,backtestMode:true,done:run.periodItems.length,total:run.periodItems.length});
    }else{
     await setStatus("اكتملت الدورتان للحصة "+p.n+". يتوقف الفحص حتى موعد الحصة التالية.",{period:p.n,cycle:2,done:run.periodItems.length,total:run.periodItems.length});
     await advancePeriod(run,p.n);
    }
   }
   return;
 }
 const item=run.periodItems[run.index];
 if(!item.url){const record={teacher:item.teacher,scheduledTeacher:item.teacher,period:run.period,url:"",status:"no-link",detail:"لا يوجد رابط Teams لهذه الحصة؛ لم يُسجّل غياب.",scannedAt:Date.now(),cycle:run.cycle||0};run.results.push(record);if(!run.testMode&&!run.backtestMode)await appendDailyReport(record);run.index++;run.current=null;await saveRun(run);await setStatus("الحصة "+p.n+" — "+item.teacher+": لا يوجد رابط Teams؛ يتابع مرصاد المعلم التالي.",{period:p.n,teacher:item.teacher,done:run.index,total:run.periodItems.length,cycle:run.cycle,last:record});await navigateCurrent(run);return}
 if(!isTeamsMeetingUrl(item.url)){run.results.push({teacher:item.teacher,period:run.period,status:"unresolved",detail:"تجاوز مرصاد رابطًا لا يطابق نطاقات Teams المسموحة؛ لم يفتحه.",scannedAt:Date.now(),cycle:run.cycle});run.index++;run.current=null;await saveRun(run);await navigateCurrent(run);return}
 run.current={...item,scanId:String(run.period)+"-"+String(run.cycle)+"-"+String(run.index)+"-"+String(Date.now())};await saveRun(run);
 await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await chrome.alarms.create(SCAN_TIMEOUT_ALARM,{when:Date.now()+30000});
 await setStatus("الحصة "+p.n+" — "+item.teacher+" ("+(run.index+1)+"/"+run.periodItems.length+")، الدورة "+run.cycle,{period:p.n,teacher:item.teacher,done:run.index,total:run.periodItems.length,cycle:run.cycle});
 try{const tabId=await ensureProbeTab(run);await chrome.tabs.update(tabId,{url:item.url,active:false})}
 catch(_){run.results.push({teacher:item.teacher,period:p.n,status:"unresolved",detail:"تعذر فتح الرابط",scannedAt:Date.now(),cycle:run.cycle});run.index++;run.current=null;await saveRun(run);await navigateCurrent(run)}
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
 const resultRecord={teacher:message.result?.teacher||item.teacher,scheduledTeacher:item.teacher,period:run.period,url:item.url,status:message.result?.status||"unresolved",detail:message.result?.detail||"لم تُرجع واجهة Teams نتيجة واضحة",scannedAt,cycle:run.cycle||0};
 run.results.push(resultRecord);
 if(!run.testMode&&!run.backtestMode)await appendDailyReport(resultRecord);
 
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
  const timeoutRecord={teacher:item.teacher,scheduledTeacher:item.teacher,period:run.period,url:item.url,status:"unresolved",detail:"انتهت مهلة انتظار Teams دون نتيجة؛ لم يُسجّل غياب.",scannedAt:Date.now(),cycle:run.cycle||0};
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
 if(run.period){const p=PERIODS.find(x=>x.n===run.period);if(p&&Date.now()<=periodBounds(p,new Date(),"past").end.getTime()){if(!run.current&&run.index===0){await navigateCurrent(run)}else await navigateCurrent(run);return}await advancePeriod(run,run.period);return}
 const p=periodNow();if(p)await beginPeriod(run,p.n);else{const next=nextPeriod();await setStatus("ينتظر الحصة "+next.period.n+" عند "+next.period.start,{waiting:true,period:next.period.n});await chrome.alarms.create(NEXT_ALARM,{when:next.when})}
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type==="MIRSAD_TEST_ONE"){startOneOffTest().then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true}
 if(message?.type==="MIRSAD_START"){startMonitoring().then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true}
 if(message?.type==="MIRSAD_BACKTEST"){
  (async()=>{
   const existing=await getRun();if(existing?.running){await setStatus("أوقف المراقبة الحالية قبل بدء الاختبار الرجعي.");sendResponse({ok:false,reason:"running"});return}
   const periodNo=Number(message.period);const p=PERIODS.find(x=>x.n===periodNo);if(!p){sendResponse({ok:false,reason:"period"});return}
   const scheduleTab=await getScheduleTab();if(!scheduleTab){await setStatus("افتح صفحة جدول مرصاد التي تحتوي على روابط Teams أولًا.");sendResponse({ok:false});return}
   let response;try{response=await chrome.tabs.sendMessage(scheduleTab.id,{type:"MIRSAD_GET_SCHEDULE"})}catch(_){await setStatus("تعذرت قراءة الجدول. حدّث صفحة مرصاد ثم أعد المحاولة.");sendResponse({ok:false});return}
   const all=(response?.items||[]).filter(x=>x.url&&x.teacher&&Number(x.period)===periodNo&&isTeamsMeetingUrl(x.url));
   const unique=[];const seen=new Set();for(const item of all){const k=item.teacher+"|"+item.url;if(!seen.has(k)){seen.add(k);unique.push(item)}}
   if(!unique.length){await setStatus("لم أجد روابط Teams صالحة للحصة "+periodNo+".");sendResponse({ok:false});return}
   await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
   const run={running:true,testMode:true,backtestMode:true,requestedTime:String(message.requestedTime||""),schedule:unique,tabId:null,probeTabIds:[],startedAt:Date.now(),results:[],period:periodNo,periodItems:unique,index:0,cycle:1,current:null};
   await saveRun(run);await setStatus("بدأ الاختبار الرجعي للحصة "+periodNo+" عند الوقت الذي اخترته ("+run.requestedTime+"). الفحص الفعلي يجري الآن، والوقت المختار لا يعيد حالة Teams التاريخية.",{period:periodNo,cycle:1,backtestMode:true,requestedTime:run.requestedTime,total:unique.length});
   await navigateCurrent(run);sendResponse({ok:true,total:unique.length});
  })().catch(()=>sendResponse({ok:false}));return true
 }
 if(message?.type==="MIRSAD_STOP"){getRun().then(async run=>{if(run){run.running=false;await saveRun(run);await closeProbeTab(run)}await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await setStatus("تم إيقاف المراقبة بناءً على طلبك.");sendResponse({ok:true})});return true}
 if(message?.type==="MIRSAD_STATUS"){Promise.all([chrome.storage.local.get(STATUS_KEY),getRun()]).then(([s,r])=>sendResponse({status:s[STATUS_KEY]||{text:"لا توجد حالة"},run:r}));return true}
 if(message?.type==="MIRSAD_GET_LIVE_REPORT"){
  (async()=>{
   await refreshScheduleSettings();
   const [run,stored]=await Promise.all([getRun(),chrome.storage.local.get([DAILY_REPORT_KEY,"mirsadManualAttendanceOverrides","mirsadManualMappings",SCHEDULE_SETTINGS_KEY])]);
   let schedule=[];
   const tab=await getScheduleTab();
   if(tab){try{const response=await chrome.tabs.sendMessage(tab.id,{type:"MIRSAD_GET_SCHEDULE"});if(response?.ok)schedule=response.items||[]}catch(_){}}
   if(!schedule.length)schedule=Array.isArray(run?.schedule)?run.schedule:[];
   sendResponse({ok:true,run:run||{},schedule,dailyReports:stored[DAILY_REPORT_KEY]||{},manualOverrides:stored.mirsadManualAttendanceOverrides||{},manualMappings:stored.mirsadManualMappings||{},scheduleSettings:stored[SCHEDULE_SETTINGS_KEY]||DEFAULT_SCHEDULE_SETTINGS,periods:PERIODS});
  })().catch(()=>sendResponse({ok:false}));
  return true
 }
 if(message?.type==="MIRSAD_SAVE_SCHEDULE_SETTINGS"){
 (async()=>{const mode=message.settings?.mode==="manual"?"manual":"automatic",manualStart=String(message.settings?.manualStart||"06:30"),cycleMinute=Number(message.settings?.cycleMinute);if((mode==="manual"&&parseClock(manualStart)===null)||!Number.isInteger(cycleMinute)||cycleMinute<1||cycleMinute>10){sendResponse({ok:false,reason:"invalid"});return}let saved=await chrome.storage.local.get(SCHEDULE_SETTINGS_KEY),base=saved[SCHEDULE_SETTINGS_KEY]?.basePeriods;const tab=await getScheduleTab();if(tab){try{await loadPeriodsFromSchedule(tab.id);saved=await chrome.storage.local.get(SCHEDULE_SETTINGS_KEY);base=saved[SCHEDULE_SETTINGS_KEY]?.basePeriods}catch(_){}}if(!Array.isArray(base)||base.length!==7){sendResponse({ok:false,reason:"no-timetable"});return}const settings={mode,manualStart,cycleMinute,basePeriods:base,updatedAt:Date.now()};await chrome.storage.local.set({[SCHEDULE_SETTINGS_KEY]:settings});await refreshScheduleSettings();const run=await getRun();if(run?.running&&!run.current){await chrome.alarms.clear(NEXT_ALARM);run.period=null;run.periodItems=[];run.index=0;await saveRun(run);const current=periodNow();if(current)await beginPeriod(run,current.n);else{const next=nextPeriod();await setStatus("تم تحديث التوقيت. ينتظر مرصاد الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,period:next.period.n});await chrome.alarms.create(NEXT_ALARM,{when:next.when})}}else await setStatus("تم حفظ التوقيت. شغّل المراقبة لتطبيقه.",{scheduleSettings:settings,periods:PERIODS});sendResponse({ok:true,settings,periods:PERIODS})})().catch(()=>sendResponse({ok:false}));return true
 }
 if(message?.type==="MIRSAD_SAVE_MAPPING"){
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
   if(message.status!=="absent"||!sender.tab?.windowId) {sendResponse({ok:false});return}
   try{
    const dataUrl=await chrome.tabs.captureVisibleTab(sender.tab.windowId,{format:"png"});
    const now=Date.now();
    const safeName=String(message.teacher||"معلم").replace(/[\\/:*?"<>|]/g,"_").slice(0,70);
    const filename="MirsadEvidence/"+safeName+"_ح"+String(message.period||"").replace(/[^0-9]/g,"")+"_"+new Date(now).toISOString().replace(/[:.]/g,"-")+".png";
    const downloadId=await chrome.downloads.download({url:dataUrl,filename,saveAs:false,conflictAction:"uniquify"});
    const evidenceKey="mirsadEvidenceRecords";
    const saved=await chrome.storage.local.get(evidenceKey);
    const records=Array.isArray(saved[evidenceKey])?saved[evidenceKey]:[];
    records.push({teacher:message.teacher||"",period:message.period||"",status:"absent",detail:message.detail||"",capturedAt:now,filename,downloadId,scanId:message.scanId||""});
    await chrome.storage.local.set({[evidenceKey]:records.slice(-1000)});
    sendResponse({ok:true,filename,downloadId});
   }catch(error){sendResponse({ok:false,error:String(error?.message||error)})}
  })();return true
 }
 if(message?.type==="MIRSAD_SCAN_RESULT"){receiveResult(message).catch(()=>{});sendResponse({ok:true});return false}
});
