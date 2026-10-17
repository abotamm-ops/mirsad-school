const KEY="mirsadAutoRun", STATUS_KEY="mirsadAutoStatus", NEXT_ALARM="mirsadNextAction", SCAN_TIMEOUT_ALARM="mirsadScanTimeout";
const PERIODS=[
 {n:1,start:"06:30",end:"07:15"},
 {n:2,start:"07:16",end:"08:01"},
 {n:3,start:"08:02",end:"08:47"},
 {n:4,start:"08:48",end:"09:33"},
 {n:5,start:"09:34",end:"10:19"},
 {n:6,start:"10:20",end:"11:05"},
 {n:7,start:"11:06",end:"11:51"}
];
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
 reports[day].push(record);
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
function atToday(hhmm){const [h,m]=hhmm.split(":").map(Number);const d=new Date();d.setHours(h,m,0,0);return d}
function periodNow(now=new Date()){if(now.getDay()===5||now.getDay()===6)return null;const mins=now.getHours()*60+now.getMinutes();return PERIODS.find(p=>{const [sh,sm]=p.start.split(":").map(Number),[eh,em]=p.end.split(":").map(Number);return mins>=sh*60+sm&&mins<=eh*60+em})||null}
function nextPeriod(now=new Date()){
 if(now.getDay()===5||now.getDay()===6){const d=new Date(now);while(d.getDay()===5||d.getDay()===6)d.setDate(d.getDate()+1);const first=PERIODS[0],[h,m]=first.start.split(":").map(Number);d.setHours(h,m,0,0);return {period:first,when:d.getTime()}}
 for(const p of PERIODS){const d=atToday(p.start);if(d>now)return {period:p,when:d.getTime()}}
 // Saudi school week: Sunday through Thursday. Skip Friday and Saturday.
 const d=new Date(now);d.setDate(d.getDate()+1);
 while(d.getDay()===5||d.getDay()===6)d.setDate(d.getDate()+1);
 const first=PERIODS[0], [h,m]=first.start.split(":").map(Number);d.setHours(h,m,0,0);
 return {period:first,when:d.getTime()}
}
async function getScheduleTab(){const tabs=await chrome.tabs.query({url:"https://mirsad-school.onrender.com/*"});return tabs.find(t=>t.url&&!t.url.includes("/absence.html"))||null}
async function startOneOffTest(){
 const existing=await getRun();
 if(existing?.running){await setStatus("أوقف المراقبة الحالية أولًا قبل الاختبار المباشر.");return}
 await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
 const scheduleTab=await getScheduleTab();
 if(!scheduleTab){await setStatus("افتح صفحة جدول مرصاد التي تحتوي على روابط Teams أولًا.");return}
 let response;
 try{response=await chrome.tabs.sendMessage(scheduleTab.id,{type:"MIRSAD_GET_SCHEDULE"})}catch(_){await setStatus("تعذرت قراءة الجدول. حدّث صفحة مرصاد ثم أعد المحاولة.");return}
 const items=(response?.items||[]).filter(x=>x.url&&x.teacher&&Number.isFinite(x.period)&&x.period>=1&&x.period<=7);
 if(!items.length){await setStatus("لم أجد روابط Teams صالحة في الجدول الحالي.");return}
 const item=items[0];
 if(!isTeamsMeetingUrl(item.url)){await setStatus("أوقف الاختبار: الرابط الأول ليس رابط Teams صالحًا؛ لم تُفتح أي صفحة.");return}
 const scanId="test-"+Date.now();
 const run={running:true,testMode:true,schedule:items,tabId:null,probeTabIds:[],startedAt:Date.now(),results:[],period:item.period,periodItems:[item],index:0,cycle:0,current:{...item,scanId}};
 await saveRun(run);
 await setStatus("اختبار مباشر: فتح رابط حصة واحدة للمعلم "+item.teacher+". هذه نتيجة تشخيصية وليست تسجيل حضور رسمي.",{testMode:true,teacher:item.teacher,period:item.period});
 await chrome.alarms.create(SCAN_TIMEOUT_ALARM,{when:Date.now()+90000});
 try{const tabId=await ensureProbeTab(run);await chrome.tabs.update(tabId,{url:item.url,active:false})}catch(_){
   run.running=false;run.current=null;run.results.push({teacher:item.teacher,period:item.period,status:"unresolved",detail:"تعذر فتح رابط الاختبار",scannedAt:Date.now(),cycle:0});await saveRun(run);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await closeProbeTab(run);await setStatus("تعذر فتح رابط الاختبار؛ أُغلقت صفحة الاختبار.");
 }
}
async function startMonitoring(){
 const existing=await getRun();
 if(existing?.running){
  await setStatus("المراقبة تعمل بالفعل؛ لن تُفتح دورة ثانية.",{period:existing.period,waiting:!existing.period});
  return;
 }
 await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
 const scheduleTab=await getScheduleTab();
 if(!scheduleTab){await setStatus("افتح صفحة جدول مرصاد في Chrome أولًا، ثم شغّل المراقبة.");return}
 let response;
 try{response=await chrome.tabs.sendMessage(scheduleTab.id,{type:"MIRSAD_GET_SCHEDULE"})}catch(_){await setStatus("تعذرت قراءة الجدول. حدّث صفحة مرصاد وانتظر تحميل الروابط ثم أعد التشغيل.");return}
 const schedule=(response?.items||[]).filter(x=>x.url&&x.teacher&&Number.isFinite(x.period)&&x.period>=1&&x.period<=7);
 if(!schedule.length){await setStatus("لم أجد روابط Teams صالحة في الجدول الحالي.");return}
 const run={running:true,schedule,tabId:null,probeTabIds:[],startedAt:Date.now(),results:[],period:null,periodItems:[],index:0,cycle:1,current:null};
 await saveRun(run);
 const current=periodNow();
 if(current){await beginPeriod(run,current.n)}
 else{
  const next=nextPeriod();
  await setStatus("الرصد جاهز. ينتظر بداية الحصة "+next.period.n+" عند "+next.period.start+".",{waiting:true,period:next.period.n});
  await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:next.when});
 }
}
async function beginPeriod(run,periodNo){
 if(!run?.running)return;
 const p=PERIODS.find(x=>x.n===periodNo);if(!p)return;
 const now=new Date(), start=atToday(p.start), end=atToday(p.end);
 if(now<start){await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.create(NEXT_ALARM,{when:start.getTime()});await setStatus("ينتظر بداية الحصة "+p.n+" عند "+p.start,{waiting:true,period:p.n});return}
 if(now>end){await advancePeriod(run,periodNo);return}
 const items=run.schedule.filter(x=>x.period===p.n);
 run.period=p.n;run.periodItems=items;run.index=0;run.current=null;run.cycle=run.cycle||1;
 await saveRun(run);
 if(!items.length){await setStatus("لا توجد روابط صالحة للحصة "+p.n+" في الجدول؛ ينتقل مرصاد للحصة التالية.",{period:p.n});await advancePeriod(run,p.n);return}
 await setStatus("بدأ رصد الحصة "+p.n+": "+items.length+" رابطًا. الدورة "+run.cycle+".",{period:p.n,done:0,total:items.length,cycle:run.cycle});
 await navigateCurrent(run);
}
async function navigateCurrent(run){
 if(!run?.running)return;
 const p=PERIODS.find(x=>x.n===run.period);
 if(!p)return;
 if(Date.now()>atToday(p.end).getTime()){await advancePeriod(run,run.period);return}
 if(run.index>=run.periodItems.length){
   run.cycle=(run.cycle||1)+1;run.index=0;run.current=null;await saveRun(run);
   await chrome.alarms.clear(NEXT_ALARM);
   const when=Date.now()+CYCLE_GAP_MS;
   if(when<atToday(p.end).getTime()){
    await setStatus("اكتملت دورة الحصة "+p.n+". سيعيد الفحص تلقائيًا بعد "+(CYCLE_GAP_MS/1000)+" ثانية.",{period:p.n,cycle:run.cycle-1,done:run.periodItems.length,total:run.periodItems.length});
    await chrome.alarms.create(NEXT_ALARM,{when});
   }else await advancePeriod(run,p.n);
   return;
 }
 const item=run.periodItems[run.index];
 if(!isTeamsMeetingUrl(item.url)){run.results.push({teacher:item.teacher,period:run.period,status:"unresolved",detail:"تجاوز مرصاد رابطًا لا يطابق نطاقات Teams المسموحة؛ لم يفتحه.",scannedAt:Date.now(),cycle:run.cycle});run.index++;run.current=null;await saveRun(run);await navigateCurrent(run);return}
 run.current={...item,scanId:String(run.period)+"-"+String(run.cycle)+"-"+String(run.index)+"-"+String(Date.now())};await saveRun(run);
 await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await chrome.alarms.create(SCAN_TIMEOUT_ALARM,{when:Date.now()+90000});
 await setStatus("الحصة "+p.n+" — "+item.teacher+" ("+(run.index+1)+"/"+run.periodItems.length+")، الدورة "+run.cycle,{period:p.n,teacher:item.teacher,done:run.index,total:run.periodItems.length,cycle:run.cycle});
 try{const tabId=await ensureProbeTab(run);await chrome.tabs.update(tabId,{url:item.url,active:false})}
 catch(_){run.results.push({teacher:item.teacher,period:p.n,status:"unresolved",detail:"تعذر فتح الرابط",scannedAt:Date.now(),cycle:run.cycle});run.index++;run.current=null;await saveRun(run);await navigateCurrent(run)}
}
async function advancePeriod(run,after){
 if(!run?.running)return;
 const next=PERIODS.find(p=>p.n>after);
 if(!next){
   const nxt=nextPeriod(new Date(atToday(PERIODS[6].end).getTime()+1000));
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
 if(!run.testMode)await appendDailyReport(resultRecord);
 
 run.index++;run.current=null;
 if(run.testMode){run.running=false;await saveRun(run);await closeProbeTab(run);await setStatus("اكتمل الاختبار المباشر لرابط واحد: "+item.teacher+" — "+(message.result?.detail||message.result?.status||"غير محسوم")+". أُغلقت صفحة الاختبار تلقائيًا. النتيجة تشخيصية فقط.",{testMode:true,last:run.results[run.results.length-1]});return}
 await saveRun(run);
 await closeProbeTab(run);
 await setStatus("تم فحص "+run.index+" من "+run.periodItems.length+" في الحصة "+run.period+"؛ أُغلق تبويب الفحص.",{period:run.period,done:run.index,total:run.periodItems.length,cycle:run.cycle,last:run.results[run.results.length-1]});
 await navigateCurrent(run)
}
chrome.alarms.onAlarm.addListener(async alarm=>{
 const run=await getRun();if(!run?.running)return;
 if(alarm.name===SCAN_TIMEOUT_ALARM){
  if(!run.current)return;
  const item=run.current;
  const timeoutRecord={teacher:item.teacher,scheduledTeacher:item.teacher,period:run.period,url:item.url,status:"unresolved",detail:"انتهت مهلة انتظار Teams دون نتيجة؛ لم يُسجّل غياب.",scannedAt:Date.now(),cycle:run.cycle||0};
  run.results.push(timeoutRecord);
  if(!run.testMode)await appendDailyReport(timeoutRecord);
  run.index++;run.current=null;
  if(run.testMode){run.running=false;await saveRun(run);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await closeProbeTab(run);await setStatus("انتهت مهلة الاختبار المباشر دون نتيجة من Teams. أُغلقت صفحة الاختبار تلقائيًا؛ لم يُسجّل غياب.",{testMode:true,last:run.results[run.results.length-1]});return}
  await saveRun(run);
  await closeProbeTab(run);
  await setStatus("انتهت مهلة فحص "+item.teacher+"؛ أُغلق تبويب الفحص وسُجلت غير محسومة.",{period:run.period,teacher:item.teacher,cycle:run.cycle});
  await navigateCurrent(run);return;
 }
 if(alarm.name!==NEXT_ALARM)return;
 if(run.period){const p=PERIODS.find(x=>x.n===run.period);if(p&&Date.now()<=atToday(p.end).getTime()){await navigateCurrent(run);return}await advancePeriod(run,run.period);return}
 const p=periodNow();if(p)await beginPeriod(run,p.n);else{const next=nextPeriod();await setStatus("ينتظر الحصة "+next.period.n+" عند "+next.period.start,{waiting:true,period:next.period.n});await chrome.alarms.create(NEXT_ALARM,{when:next.when})}
});
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
 if(message?.type==="MIRSAD_TEST_ONE"){startOneOffTest().then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true}
 if(message?.type==="MIRSAD_START"){startMonitoring().then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true}
 if(message?.type==="MIRSAD_STOP"){getRun().then(async run=>{if(run){run.running=false;await saveRun(run);await closeProbeTab(run)}await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await setStatus("تم إيقاف المراقبة بناءً على طلبك.");sendResponse({ok:true})});return true}
 if(message?.type==="MIRSAD_STATUS"){Promise.all([chrome.storage.local.get(STATUS_KEY),getRun()]).then(([s,r])=>sendResponse({status:s[STATUS_KEY]||{text:"لا توجد حالة"},run:r}));return true}
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
