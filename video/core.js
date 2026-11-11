/* Shared deterministic safety rules; no attendance mutation or timer ownership. */
var MirsadVideoCore=(()=>{
 const SAFETY_MS=30000,MIN_CLIP_MS=5000,MAX_CLIP_MS=600000;
 const normalize=s=>String(s||'').normalize('NFKC').replace(/\s+/g,' ').trim();
 function gap(run,now,minBudget=MIN_CLIP_MS){
  if(!run?.running||run.paused||run.testMode||run.backtestMode||run.immediateMode||run.calendarTrial||run.current||run.meetingScan||!run.waitingForCycle2||!Number.isInteger(run.cycle)||run.cycle<1||run.cycle>2||!Number.isFinite(run.nextCycleAt))return null;
  const deadline=run.nextCycleAt-SAFETY_MS,budget=deadline-now;
  if(budget<minBudget||budget>12*60*60*1000)return null;
  return {period:Number(run.period),afterCycle:run.cycle,nextCycleAt:run.nextCycleAt,deadline,budget,key:[run.startedAt,run.controlEpoch||0,run.period,run.cycle,run.nextCycleAt].join('|')};
 }
 function settings(input,roundCount){
  if(!Number.isInteger(input.minutes)||input.minutes<1||input.minutes>10)throw Error('اختر مدة من دقيقة إلى 10 دقائق');
  if(!Array.isArray(input.cycles)||input.cycles.some(c=>!Number.isInteger(c)||c<1||c>=roundCount))throw Error('التسجيل متاح بعد الدورات التي تليها دورة أخرى فقط');
  return {...input,cycles:[...new Set(input.cycles)].sort(),enabled:input.cycles.length>0};
 }
 function budget(run,job,now){const g=gap(run,now,0);if(!g||g.key!==job.gapKey||g.period!==job.period||g.afterCycle!==job.afterCycle)return 0;return Math.max(0,Math.min(job.minutes*60000,g.deadline-now,Number(job.deadline)-now,MAX_CLIP_MS))}
 function shouldStop(run,job,now){return budget(run,job,now)<1}
 function safeName(value){return normalize(value).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').replace(/[ .]+$/g,'').slice(0,90)||'معلم'}
 function fileName(job){return safeName(job.teacherName)+'_ح'+job.period+'_بعد'+job.afterCycle+'_'+job.date+'_'+job.id+'.webm'}
 return {SAFETY_MS,MIN_CLIP_MS,MAX_CLIP_MS,gap,settings,budget,shouldStop,safeName,fileName};
})();
