const KEY = "mirsadAutoRun";
const STATUS_KEY = "mirsadAutoStatus";

async function setStatus(text, extra={}) {
  await chrome.storage.local.set({[STATUS_KEY]: {text, at:Date.now(), ...extra}});
}
async function getRun() {
  const x = await chrome.storage.local.get(KEY);
  return x[KEY] || null;
}
async function saveRun(run) {
  await chrome.storage.local.set({[KEY]:run});
}
async function getScheduleTab() {
  const tabs = await chrome.tabs.query({url:"https://mirsad-school.onrender.com/*"});
  return tabs.find(t => t.url && !t.url.includes("/absence.html")) || null;
}
async function startMonitoring() {
  const scheduleTab = await getScheduleTab();
  if (!scheduleTab) {
    await setStatus("افتح صفحة جدول مرصاد في Chrome أولًا، ثم اضغط تشغيل المراقبة من الإضافة.");
    return;
  }
  let response;
  try { response = await chrome.tabs.sendMessage(scheduleTab.id,{type:"MIRSAD_GET_SCHEDULE"}); }
  catch (_) {
    await setStatus("لم أستطع قراءة الجدول. حدّث صفحة مرصاد وانتظر تحميل أسماء المعلمين وروابط Teams، ثم أعد التشغيل.");
    return;
  }
  const all=(response?.items||[]).filter(x=>x.url&&x.teacher&&Number.isFinite(x.period));
  if(!all.length){await setStatus("لم أجد روابط Teams في الجدول الحالي. تأكد أن جدول اليوم ظاهر وأن روابط الحصص محمّلة.");return;}
  // Timetable columns 2..8 represent lessons 1..7. Preserve that order.
  const queue=all.sort((a,b)=>a.period-b.period||a.teacher.localeCompare(b.teacher,"ar"));
  const existing=await chrome.tabs.query({url:["https://teams.microsoft.com/*","https://teams.live.com/*"]});
  const tab=existing.find(t=>t.id!=null)||await chrome.tabs.create({url:queue[0].url,active:false});
  const run={running:true,queue,index:0,tabId:tab.id,startedAt:Date.now(),results:[],phase:"opening",current:null};
  await saveRun(run);
  await setStatus("بدأت الدورة: "+queue.length+" رابطًا من جدول مرصاد. يفتح مرصاد الروابط بالتتابع.",{done:0,total:queue.length});
  await navigateCurrent(run);
}
async function navigateCurrent(run) {
  if(!run?.running)return;
  if(run.index>=run.queue.length){
    run.running=false;run.finishedAt=Date.now();await saveRun(run);
    await setStatus("انتهت الدورة. تمت محاولة فحص "+run.results.length+" رابطًا. الحالات غير المحسومة ليست غيابًا.",{done:run.results.length,total:run.queue.length,finished:true});
    return;
  }
  const item=run.queue[run.index];
  run.phase="opening";run.current=item;await saveRun(run);
  await setStatus("يفتح الحصة "+(item.period-1)+" — "+item.teacher+" ("+(run.index+1)+"/"+run.queue.length+")",{done:run.index,total:run.queue.length,teacher:item.teacher,period:item.period-1});
  try { await chrome.tabs.update(run.tabId,{url:item.url,active:false}); }
  catch(_){
    run.results.push({teacher:item.teacher,period:item.period-1,url:item.url,status:"unresolved",detail:"تعذر فتح الرابط",scannedAt:Date.now()});
    run.index++;run.current=null;await saveRun(run);await navigateCurrent(run);
  }
}
async function receiveResult(message) {
  const run=await getRun();
  if(!run?.running||!run.current)return;
  const item=run.current;
  run.results.push({teacher:item.teacher,period:item.period-1,url:item.url,status:message.result?.status||"unresolved",detail:message.result?.detail||"لم تُرجع واجهة Teams نتيجة واضحة",scannedAt:Date.now()});
  run.index++;run.current=null;await saveRun(run);
  await setStatus("تم فحص "+run.index+" من "+run.queue.length+". الحالة التالية تُفتح تلقائيًا.",{done:run.index,total:run.queue.length,last:run.results[run.results.length-1]});
  await navigateCurrent(run);
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(message?.type==="MIRSAD_START"){startMonitoring().then(()=>sendResponse({ok:true})).catch(()=>sendResponse({ok:false}));return true;}
  if(message?.type==="MIRSAD_STOP"){
    getRun().then(async run=>{if(run){run.running=false;await saveRun(run);}await setStatus("تم إيقاف المراقبة بناءً على طلبك.");sendResponse({ok:true});});return true;
  }
  if(message?.type==="MIRSAD_STATUS"){
    Promise.all([chrome.storage.local.get(STATUS_KEY),getRun()]).then(([s,r])=>sendResponse({status:s[STATUS_KEY]||{text:"لا توجد حالة"},run:r}));return true;
  }
  if(message?.type==="MIRSAD_PAGE_READY"){
    getRun().then(run=>{
      if(run?.running&&run.current)sendResponse({active:true,teacher:run.current.teacher,period:run.current.period-1,index:run.index});
      else sendResponse({active:false});
    });return true;
  }
  if(message?.type==="MIRSAD_SCAN_RESULT"){receiveResult(message).catch(()=>{});sendResponse({ok:true});return false;}
});
