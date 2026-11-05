/* Lesson elapsed time and next start use the saved school timetable, in Riyadh. */
(function(root){'use strict';
function state(data,now=new Date()){
 if(!data?.snapshot||data.snapshot.date!==root.MirsadMonitorModel.day(now))return null;
 const timing={...root.MirsadMonitorModel.defaultSchedule,...data.snapshot.scheduleSettings,...data.reportSchedule};
 const periods=root.MirsadScheduleCore.makeManualPeriods(timing.manualStart,timing.periodDuration,timing.manualGapMinutes,7,1).filter(p=>!root.MirsadMonitorModel.isExcludedPeriod(data.snapshot.date,p.n,data.snapshot)),start=new Date(data.snapshot.date+'T00:00:00+03:00').getTime(),at=now.getTime();
 const current=periods.find(p=>at>=start+p.startOffset*60000&&at<start+p.endOffset*60000),next=periods.find(p=>at<start+p.startOffset*60000);
 return {current:current?current.n:null,elapsed:current?Math.floor((at-start-current.startOffset*60000)/1000):null,next:next?next.n:null,remaining:next?Math.ceil((start+next.startOffset*60000-at)/1000):null,phase:current?'lesson':next?(next.n===1?'before':'gap'):'ended'};
}
function duration(value){return [Math.floor(value/3600),Math.floor(value%3600/60),value%60].map(n=>String(n).padStart(2,'0')).join(':')}
function roundState(h,now=Date.now()){
 if(!h||!Number.isFinite(h.at)||now-h.at>75000||h.at>now+10000)return {phase:'unknown'};
 if(!h.running)return {phase:h.phase==='paused'?'paused':'stopped'};
 if(h.phase==='scanning')return {phase:'scanning',cycle:h.cycle,period:h.period,total:h.totalCycles};
 if(Number.isFinite(h.nextCycleAt)&&h.nextCycleAt>0&&h.nextCycle)return {phase:h.nextCycleAt>now?'waiting':'due',cycle:h.nextCycle,period:h.period,remaining:Math.max(0,Math.ceil((h.nextCycleAt-now)/1000))};
 return {phase:'waiting-lesson',period:h.period};
}
let data=null,heartbeat=null,serverOffset=0;function render(){if(typeof document==='undefined')return;const a=document.getElementById('lessonElapsedLabel'),b=document.getElementById('nextLessonLabel');if(!a||!b)return;const s=state(data);
a.textContent=!s?'توقيت الحصص':s.current?'مضى على الحصة '+s.current:s.phase==='ended'?'انتهت حصص اليوم':s.phase==='gap'?'الفاصل بين الحصص':'لم تبدأ الحصص بعد';
document.getElementById('lessonElapsed').textContent=s?.current?duration(s.elapsed):'—';b.textContent=s?.next?'بقي على بداية الحصة '+s.next:'الحصة المقبلة';document.getElementById('nextLessonCountdown').textContent=s?.next?duration(s.remaining):'—';document.getElementById('lessonClockContext').textContent=!s?'يظهر التوقيت بعد تحميل جدول اليوم.':'وفق توقيت جدول اليوم · بتوقيت الرياض';
const box=document.getElementById('roundCountdown'),label=document.getElementById('roundCountdownLabel'),number=document.getElementById('roundCountdownValue');if(box&&label&&number){const r=roundState(data?.snapshot?.date===root.MirsadMonitorModel.day()&&!root.MirsadMonitorModel.isExcludedPeriod(data.snapshot.date,heartbeat?.period,data.snapshot)?heartbeat:null,Date.now()+serverOffset);box.dataset.phase=r.phase;label.textContent=r.phase==='waiting'?'باقي على الدورة '+r.cycle+' · الحصة '+r.period:r.phase==='scanning'?'جارٍ رصد الدورة '+r.cycle+' · الحصة '+r.period:r.phase==='due'?'حان وقت الدورة '+r.cycle:r.phase==='paused'?'الرصد متوقف مؤقتًا':r.phase==='stopped'?'الرصد متوقف':r.phase==='waiting-lesson'?'بانتظار موعد الرصد التالي':'بانتظار اتصال الإضافة';number.textContent=r.phase==='waiting'?duration(r.remaining):r.phase==='scanning'?'قيد الرصد':r.phase==='due'?'بانتظار بدء الإضافة':'—';}
}
root.MirsadLessonClock={state,roundState,duration,setHeartbeat(value,serverTime){heartbeat=value;serverOffset=Number.isFinite(serverTime)?serverTime-Date.now():0;render()},setDay(value){data=value;if(value?.heartbeat){heartbeat=value.heartbeat;serverOffset=Number.isFinite(value.serverTime)?value.serverTime-Date.now():0}render()}};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();setInterval(render,1000)}
})(globalThis);
