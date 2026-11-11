/* Shared deterministic safety rules; no attendance mutation or timer ownership. */
var MirsadVideoCore=(()=>{
 const SAFETY_MS=30000,MIN_CLIP_MS=5000,MAX_CLIP_MS=600000;
 const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 function gap(run,now,minBudget=MIN_CLIP_MS,tail=null){
  if(!run?.running||run.paused||run.testMode||run.backtestMode||run.immediateMode||run.calendarTrial||run.current||run.meetingScan||!Number.isInteger(run.cycle)||run.cycle<1||run.cycle>3)return null;
  if(run.waitingForCycle2&&run.cycle===3)return null;const final= !run.waitingForCycle2;if(final&&(!tail||tail.startedAt!==run.startedAt||(tail.controlEpoch||0)!==(run.controlEpoch||0)||tail.period!==run.period||tail.cycle!==run.cycle||!run.periodItems?.length||run.index<run.periodItems.length))return null;const boundary=final?tail.endAt:run.nextCycleAt;if(!Number.isFinite(boundary))return null;const deadline=boundary-SAFETY_MS,budget=deadline-now;
  if(budget<minBudget||budget>12*60*60*1000)return null;
  return {period:Number(run.period),afterCycle:run.cycle,nextCycleAt:boundary,boundary:final?'lessonEnd':'nextCycle',deadline,budget,key:[run.startedAt,run.controlEpoch||0,run.period,run.cycle,boundary].join('|')};
 }
 function settings(input,roundCount){
  if(!Number.isInteger(input.minutes)||input.minutes<1||input.minutes>10)throw Error('اختر مدة من دقيقة إلى 10 دقائق');
  if(!Array.isArray(input.cycles)||input.cycles.some(c=>!Number.isInteger(c)||c<1||c>roundCount))throw Error('اختر دورة من الدورات المتاحة للحصة');
  return {...input,cycles:[...new Set(input.cycles)].sort(),enabled:input.cycles.length>0};
 }
 function budget(run,job,now,tail=null){const g=gap(run,now,0,tail);if(!g||g.key!==job.gapKey||g.period!==job.period||g.afterCycle!==job.afterCycle)return 0;return Math.max(0,Math.min(job.minutes*60000,g.deadline-now,Number(job.deadline)-now,MAX_CLIP_MS))}
 function shouldStop(run,job,now){return budget(run,job,now)<1}
 function safeName(value){return normalize(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/[ .]+$/g,'').slice(0,90)||'معلم'}
 function fileName(job){return safeName(job.teacherName)+'_ح'+job.period+'_بعد'+job.afterCycle+'_'+job.date+'_'+job.id+'.webm'}
 return {SAFETY_MS,MIN_CLIP_MS,MAX_CLIP_MS,gap,settings,budget,shouldStop,safeName,fileName};
})();
