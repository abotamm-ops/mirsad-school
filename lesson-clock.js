/* Lesson elapsed time and next start use the saved school timetable, in Riyadh. */
(function(root){'use strict';
function state(data,now=new Date()){
 if(!data?.snapshot||data.snapshot.date!==root.MirsadMonitorModel.day(now))return null;
 const timing={...root.MirsadMonitorModel.defaultSchedule,...data.snapshot.scheduleSettings,...data.reportSchedule};
 const periods=root.MirsadScheduleCore.makeManualPeriods(timing.manualStart,timing.periodDuration,timing.manualGapMinutes,7,1),start=new Date(data.snapshot.date+'T00:00:00+03:00').getTime(),at=now.getTime();
 const current=periods.find(p=>at>=start+p.startOffset*60000&&at<start+p.endOffset*60000),next=periods.find(p=>at<start+p.startOffset*60000);
 return {current:current?current.n:null,elapsed:current?Math.floor((at-start-current.startOffset*60000)/1000):null,next:next?next.n:null,remaining:next?Math.ceil((start+next.startOffset*60000-at)/1000):null,phase:current?'lesson':next?(next.n===1?'before':'gap'):'ended'};
}
function duration(value){return [Math.floor(value/3600),Math.floor(value%3600/60),value%60].map(n=>String(n).padStart(2,'0')).join(':')}
let data=null;function render(){if(typeof document==='undefined')return;const a=document.getElementById('lessonElapsedLabel'),b=document.getElementById('nextLessonLabel');if(!a||!b)return;const s=state(data);
a.textContent=!s?'توقيت الحصص':s.current?'مضى على الحصة '+s.current:s.phase==='ended'?'انتهت حصص اليوم':s.phase==='gap'?'الفاصل بين الحصص':'لم تبدأ الحصص بعد';
document.getElementById('lessonElapsed').textContent=s?.current?duration(s.elapsed):'—';b.textContent=s?.next?'بقي على بداية الحصة '+s.next:'الحصة المقبلة';document.getElementById('nextLessonCountdown').textContent=s?.next?duration(s.remaining):'—';document.getElementById('lessonClockContext').textContent=!s?'يظهر التوقيت بعد تحميل جدول اليوم.':'وفق توقيت جدول اليوم · بتوقيت الرياض';}
root.MirsadLessonClock={state,duration,setDay(value){data=value;render()}};
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();setInterval(render,1000)}
})(globalThis);
