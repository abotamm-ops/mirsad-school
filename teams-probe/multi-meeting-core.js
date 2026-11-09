/* One attendance result per lesson/cycle; meeting attempts remain separate evidence. */
var MirsadMultiMeeting=(()=>{
 const day=()=>MirsadMonitorModel.day();
 const scope=run=>[day(),run.scheduleRevision||'',run.startedAt||'',run.period,run.cycle,run.index].join('|');
 function state(run){const group=run.meetingScan;return group&&group.scope===scope(run)?group:null}
 function prepare(run,item){
  let group=state(run);
  if(!group){
   run.meetingScan=null;
   if(!String(item.calendarUrl||'').trim())return null;
   const links=[];
   for(const [source,value] of [['madrasati',item.url],['calendar',item.calendarUrl]]){
    const raw=String(value||'').trim();if(!raw)continue;
    const url=MirsadScheduleCore.normalizeTeamsUrl(raw)||raw;
    if(links.some(link=>MirsadScheduleCore.sameTeamsMeeting(link.url,url)))continue;
    links.push({source,url});
   }
   group={scope:scope(run),aggregateScanId:'meetings-'+run.period+'-'+run.cycle+'-'+run.index+'-'+Date.now()+'-ctl'+(run.controlEpoch||0),lesson:{...item},links,linkIndex:0,linkResults:[]};
   run.meetingScan=group;
  }
  const link=group.links[group.linkIndex];
  return link?{...group.lesson,url:link.url,primaryUrl:group.lesson.url||'',aggregateScanId:group.aggregateScanId,meetingSource:link.source,meetingIndex:group.linkIndex}:null;
 }
 function remember(run,record){
  const group=state(run);if(!group||run.current?.aggregateScanId!==group.aggregateScanId)return null;
  const source=run.current.meetingSource;
  group.linkResults.push({...record,source});group.linkIndex++;
  if(group.linkIndex<group.links.length)return {pending:true};
  return {record:aggregate(run,group)};
 }
 function aggregate(run,group){
  const linkResults=group.linkResults.map(result=>({...result}));
  const selected=linkResults.find(result=>result.status==='present')||linkResults.find(result=>result.status==='absent');
  const status=selected?.status||'unresolved',lesson=group.lesson;
  const label=source=>source==='calendar'?'تقويم Teams':'مدرستي';
  const record={scanId:group.aggregateScanId,teacher:lesson.teacher,scheduledTeacher:lesson.teacher,period:run.period,subject:lesson.subject||'',className:lesson.className||'',url:lesson.url||'',calendarUrl:lesson.calendarUrl||'',status,detail:linkResults.map(result=>label(result.source)+': '+result.detail).join(' | '),scannedAt:Date.now(),cycle:run.cycle||0,retryCount:linkResults.reduce((sum,result)=>sum+(result.retryCount||0),0),linkResults};
  if(status==='absent')record.evidenceScanId=selected.scanId;
  group.finalRecord=record;return record;
 }
 async function publish(run,record){
  if(run.testMode||run.backtestMode)return;
  await appendDailyReport(record);
  await LocalBackup.enqueue(record).catch(error=>setStatus('تعذر تثبيت النسخة المحلية: '+String(error.message)));
  await CloudMonitoring.record(run,record).catch(()=>{});
 }
 async function beforeNavigate(run){
  const group=state(run);if(!group)return false;
  // A pause or browser restart can occur after persisting the aggregate but before advancing.
  if(group.finalRecord){
   if(!(run.results||[]).some(result=>result.scanId===group.aggregateScanId))run.results.push(group.finalRecord);
   if(await saveRun(run)===false)return true;
   await publish(run,group.finalRecord);
   run.index++;run.current=null;run.meetingScan=null;run.scanRetry=null;
   if(await saveRun(run)===false)return true;
   await closeProbeTab(run);await navigateCurrent(run);return true;
  }
  if(run.backtestMode)return false;
  const active=periodNow(new Date());
  if(active?.n===run.period)return false;
  if(run.current){
   const saved=await chrome.storage.local.get('mirsadEvidenceRecords');
   const proof=(saved.mirsadEvidenceRecords||[]).find(record=>record.scanId===run.current.scanId&&record.status==='absent'&&record.evidenceVerified===true&&Number(record.period)===Number(run.period));
   if(proof){await receiveResult({scanId:run.current.scanId,result:{status:'absent',teacher:proof.teacher,evidenceTeacher:proof.teacher,detail:'استعيد إثبات الاجتماع المحفوظ قبل انتهاء وقت الحصة.'}});return true}
  }
  // Preserve completed checks when the lesson ends between meetings; never open a stale link.
  for(let index=group.linkIndex;index<group.links.length;index++){
   const link=group.links[index];group.linkResults.push({scanId:group.aggregateScanId+'-unopened-'+index,source:link.source,url:link.url,status:'unresolved',detail:'انتهى وقت الحصة قبل اكتمال فحص هذا الاجتماع؛ تعذر التحقق فنيًا.',scannedAt:Date.now(),retryCount:0});
  }
  group.linkIndex=group.links.length;aggregate(run,group);run.current=null;
  return beforeNavigate(run);
 }
 async function pageReady(sender){
  const run=await getRun(),tab=sender?.tab;
  if(!run?.running||!run.current||!Number.isInteger(tab?.id)||![run.tabId,...(run.probeTabIds||[])].includes(tab.id))return {active:false};
  let url;try{url=new URL(sender.url||tab.url||'')}catch{return {active:false}}
  if(url.protocol!=='https:'||!['teams.microsoft.com','teams.live.com'].includes(url.hostname)||/(?:^|[\/#?&=])(?:calendar(?:\.v2)?|scheduler)(?:[\/#?&=]|$)/i.test(url.pathname+url.search+url.hash)||!await MirsadTabOwnership.reusable(tab))return {active:false};
  return {active:true,teacher:run.current.teacher,period:run.period,index:run.index,scanId:run.current.scanId};
 }
 async function startTrial(){
  await globalThis.MirsadCalendarLinks?.cancel?.();
  const previous=await getRun();if(previous?.calendarTrial)throw new Error('تجربة روابط التقويم موجودة؛ استأنفها أو أوقفها قبل تجربة أخرى');if(previous?.running)throw new Error('أوقف الرصد مؤقتًا قبل تجربة روابط التقويم');
  await refreshScheduleSettings();
  const selected=await CloudMonitoring.assertSelected(previous),saved=await chrome.storage.local.get(['mirsadDriveDay','mirsadRunControlEpoch']);
  const active=selected||saved.mirsadDriveDay,snapshot=active?.snapshot;
  if(active?.date!==day()||snapshot?.sourceType!=='madrasati')throw new Error('حمّل جدول مدرستي أولًا قبل تجربة روابط التقويم');
  const preview=globalThis.MirsadCalendarPilot?.localOnly?await MirsadCalendarLinks.previewFor(active):[],rows=(snapshot.lessons||[]).map(l=>{const added=preview.find(e=>MirsadMonitorModel.normalize(e.teacherName)===MirsadMonitorModel.normalize(l.teacherName)&&e.period===l.period);return added?{...l,calendarUrl:added.url}:l});
  const lessons=rows.filter(lesson=>MirsadScheduleCore.normalizeTeamsUrl(lesson.calendarUrl)&&!MirsadScheduleCore.sameTeamsMeeting(lesson.url,lesson.calendarUrl)&&Number.isInteger(lesson.period)&&lesson.period>=1&&lesson.period<=7&&!MirsadMonitorModel.isExcludedPeriod(snapshot.date,lesson.period,snapshot)).map(lesson=>({...lesson,teacher:lesson.teacherName||lesson.teacher,hasLesson:true,validPeriod:true}));
  if(!lessons.length)throw new Error('لا توجد حصص لها رابط تقويم إضافي مختلف عن رابط مدرستي');
  PERIODS=makeManualPeriods(scheduleSettings.manualStart,scheduleSettings.manualGapMinutes,scheduleSettings.periodDuration,7,scheduleSettings.scanDelay);
  const run={running:true,autoResume:false,calendarTrial:true,testMode:true,backtestMode:true,controlEpoch:previous?.controlEpoch??saved.mirsadRunControlEpoch??0,scheduleRevision:snapshot.scheduleRevision||null,sourceDate:snapshot.sourceScheduleDate,startedAt:Date.now(),schedule:lessons,periodItems:lessons,period:lessons[0].period,index:0,cycle:1,results:[],current:null,tabId:null,probeTabIds:[],suspendedRun:previous||null};
  await chrome.alarms.clear(NEXT_ALARM);await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);
  await chrome.storage.local.set({mirsadCalendarTrialEvidenceRecords:[],mirsadCalendarTrialResult:{at:Date.now(),date:day(),sourceDate:run.sourceDate,running:true,total:lessons.length,completed:0,results:[]}});
  if(await saveRun(run)===false)throw new Error('تغيرت حالة الرصد؛ أعد تشغيل التجربة');
  await setStatus('تجربة روابط التقويم: '+lessons.length+' حصة لها رابط إضافي؛ النتائج تشخيصية ولا تغيّر التحضير.',{calendarTrial:true,total:lessons.length,done:0});
  await navigateCurrent(run);return {ok:true,started:true,total:lessons.length};
 }
 async function trialNavigation(run){
  if(!run.calendarTrial)return false;
  if(run.index<run.periodItems.length){run.period=Number(run.periodItems[run.index].period);return false}
  return finishTrial(run,false);
 }
 async function finishTrial(run,aborted){
  const latest=await getRun();if(!latest?.calendarTrial||latest.startedAt!==run.startedAt||(latest.controlEpoch??0)!==(run.controlEpoch??0))return true;
  await chrome.alarms.clear(SCAN_TIMEOUT_ALARM);await chrome.alarms.clear(NEXT_ALARM);await closeProbeTab(run);
  const checked=await getRun();if(!checked?.calendarTrial||checked.startedAt!==run.startedAt)return true;
  await chrome.storage.local.set({mirsadCalendarTrialResult:{at:Date.now(),date:day(),sourceDate:run.sourceDate,running:false,aborted,total:run.periodItems.length,completed:run.results.length,results:run.results}});
  const previous=run.suspendedRun;
  if(previous)await saveRun({...previous,controlEpoch:run.controlEpoch});else{run.running=false;run.current=null;run.meetingScan=null;await saveRun(run)}
  await refreshScheduleSettings();
  await setStatus((aborted?'أُوقفت':'اكتملت')+' تجربة روابط التقويم: '+run.results.length+' حصة. حُفظت النتائج التشخيصية دون تغيير سجل الحضور أو صوره.',{calendarTrial:true,complete:!aborted,aborted,done:run.results.length,total:run.periodItems.length});
  return true;
 }
 async function abortTrial(){const run=await getRun();return run?.calendarTrial?finishTrial(run,true):false}
 async function captureTrial(run,message,sender){
  const tab=await MirsadWorkspace.prepareCapture(sender.tab.id),screenshot=await MirsadWorkspace.captureTeams(tab.id,message.scanId),dataUrl=await labelEvidenceCapture(screenshot,message.teacher,message.status,message.period,run.cycle),now=Date.now();
  const latest=await getRun();if(!latest?.running||!latest.calendarTrial||latest.startedAt!==run.startedAt||latest.current?.scanId!==message.scanId)throw Error('تغيرت التجربة أثناء التصوير؛ لم تُحفظ لقطة قديمة');
  const record={scanId:message.scanId,aggregateScanId:run.current.aggregateScanId,meetingSource:run.current.meetingSource,scannedUrl:run.current.url,teacher:message.teacher,period:message.period,status:message.status,detail:message.detail||'',capturedAt:now,evidenceVerified:message.status==='absent',filename:'تجربة_التقويم_'+message.scanId+'.png',dataUrl};
  const key='mirsadCalendarTrialEvidenceRecords',saved=await chrome.storage.local.get(key),records=saved[key]||[];records.push(record);await chrome.storage.local.set({[key]:records});return {ok:true,filename:record.filename,diagnostic:true};
 }
 return {state,prepare,remember,beforeNavigate,pageReady,startTrial,trialNavigation,abortTrial,captureTrial};
})();
