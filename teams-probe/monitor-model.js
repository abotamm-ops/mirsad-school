(function(root){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
 const day=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 function state(rounds,count){if(rounds.length!==count||rounds.some(x=>!['present','absent'].includes(x?.status)))return 'unresolved';const n=rounds.filter(x=>x.status==='absent').length;return n===count?'absent':n===0?'present':count===3&&n===2?'partial-absence':'partial'}
 const defaultSchedule={manualStart:'06:30',periodDuration:45,manualGapMinutes:1};
 function lessonEnded(data,period,now=new Date()){
  const date=data.snapshot.date,today=day(now);if(date<today)return true;if(date>today)return false;
  const settings={...defaultSchedule,...data.snapshot.scheduleSettings,...data.reportSchedule};
  const match=/^(\d{2}):(\d{2})$/.exec(settings.manualStart||'');if(!match)return false;
  const duration=Number(settings.periodDuration),gap=Number(settings.manualGapMinutes);if(!Number.isFinite(duration)||duration<1||!Number.isFinite(gap)||gap<0)return false;
  const end=Number(match[1])*60+Number(match[2])+(period-1)*(duration+gap)+duration;
  return now.getTime()>=new Date(date+'T00:00:00+03:00').getTime()+end*60000;
 }
 function cells(data,options={}){
  if(!data?.snapshot)return [];
  const audit=data.adjustments||[];
  return data.snapshot.lessons.map(lesson=>{
   const reset=[...audit].reverse().find(a=>a.type==='reset'||(a.type==='range-reset'&&a.teacherId===lesson.teacherId&&a.period===lesson.period)),cutoff=reset?.at||0;
   const allScans=(data.records||[]).filter(r=>r.teacherId===lesson.teacherId&&Number(r.period)===lesson.period);
   const scans=allScans.filter(r=>!reset||r.scannedAt>cutoff);
   const rounds=Array.from({length:data.snapshot.roundCount},(_,i)=>scans.filter(r=>r.cycle===i+1).sort((a,b)=>b.scannedAt-a.scannedAt)[0]||{status:'unresolved',pending:true});
   const conclusive=rounds.filter(r=>['present','absent'].includes(r.status));
   const override=[...audit].reverse().find(a=>a.type==='override'&&a.teacherId===lesson.teacherId&&a.period===lesson.period&&(!reset||a.sequence>reset.sequence));
   const ended=lessonEnded(data,lesson.period,options.now||new Date());
   const inferred=!reset&&!conclusive.length&&ended&&(lesson.url===''||!scans.length||scans.every(r=>r.status==='no-link'));
   const complete=rounds.every(r=>['present','absent'].includes(r.status));
   const finalState=override?override.status:inferred?'absent':data.snapshot.roundCount===3?(complete?state(rounds,3):rounds.some(r=>!r.pending&&!['present','absent'].includes(r.status))?'unresolved':'pending'):conclusive.length?state(conclusive,conclusive.length):scans.some(r=>r.status==='unresolved')?'unresolved':'pending';
   return {...lesson,rounds,state:finalState,displayState:finalState,override:override||null,inferred,ended,reset:!!reset&&!scans.length&&!override,
    pendingRounds:override||inferred?0:rounds.filter(r=>r.pending).length,failedRounds:override?0:rounds.filter(r=>!r.pending&&!['present','absent'].includes(r.status)).length,
    evidence:allScans.filter(r=>r.evidenceUrl&&r.status!=='present'),history:allScans,adjustments:audit.filter(a=>a.type==='reset'||(a.teacherId===lesson.teacherId&&a.period===lesson.period)),
    late:!override&&finalState==='partial'&&rounds[0]?.status==='absent'&&rounds.slice(1).some(r=>r.status==='present')};
  });
 }
 function stats(days,options={}){const map=new Map();for(const data of days){const rows=cells(data,options);for(const teacher of data.snapshot?.teachers||[]){let stat=map.get(teacher.id)||{...teacher,scheduled:0,absentLessons:0,absentDays:0,present:0,unknown:0,partial:0,partialAbsence:0,late:0};const lessons=rows.filter(x=>x.teacherId===teacher.id);stat.scheduled+=lessons.length;for(const x of lessons){stat.absentLessons+=Number(x.state==='absent');stat.present+=Number(['present','partial'].includes(x.state));stat.unknown+=Number(x.state==='unresolved');stat.partial+=Number(x.state==='partial');stat.partialAbsence+=Number(x.state==='partial-absence');stat.late+=Number(x.late)}stat.absentDays+=Number(lessons.length>0&&lessons.every(x=>x.state==='absent'));stat.percent=stat.scheduled?Math.round(stat.absentLessons/stat.scheduled*1000)/10:0;map.set(teacher.id,stat)}}return [...map.values()]}
 function live(data,options={}){
  const now=options.now||new Date(),date=day(now),empty={date,period:null,alerts:[],cycles:[],latestScanAt:null};
  if(!data?.snapshot||data.snapshot.date!==date)return empty;
  const schedule={...defaultSchedule,...data.snapshot.scheduleSettings,...data.reportSchedule},match=/^(\d{2}):(\d{2})$/.exec(schedule.manualStart||'');
  if(!match)return empty;const duration=Number(schedule.periodDuration),gap=Number(schedule.manualGapMinutes);if(!Number.isFinite(duration)||duration<1||!Number.isFinite(gap)||gap<0)return empty;
  const base=new Date(date+'T00:00:00+03:00').getTime()+(Number(match[1])*60+Number(match[2]))*60000;
  if(!data.reportSchedule&&!data.snapshot.scheduleSettings&&(data.records||[]).some(r=>{
   if(!Number.isInteger(r.period)||r.period<1||r.period>7||!Number.isFinite(r.scannedAt)||day(new Date(r.scannedAt))!==date)return false;
   const start=base+(r.period-1)*(duration+gap)*60000;return r.scannedAt<start-120000||r.scannedAt>start+duration*60000+120000;
  }))return {...empty,timingMismatch:true};
  let period=null,startedAt,endAt;for(let p=1;p<=7;p++){const start=base+(p-1)*(duration+gap)*60000,end=start+duration*60000;if(now.getTime()>=start&&now.getTime()<end){period=p;startedAt=start;endAt=end;break}}
  if(!period)return empty;
  const reset=[...(data.adjustments||[])].reverse().find(a=>a.type==='reset'),cutoff=reset?.at||0;
  const scans=(data.records||[]).filter(r=>Number(r.period)===period&&r.scannedAt>=startedAt&&r.scannedAt<=now.getTime()&&r.scannedAt>cutoff);
  const cycles=Array.from({length:data.snapshot.roundCount},(_,i)=>{const rows=scans.filter(r=>r.cycle===i+1);return {cycle:i+1,count:rows.length,firstResultAt:rows.length?Math.min(...rows.map(r=>r.scannedAt)):null,lastResultAt:rows.length?Math.max(...rows.map(r=>r.scannedAt)):null}});
  const alerts=[];for(const cell of cells(data,{now}).filter(c=>c.period===period)){
   const history=scans.filter(r=>r.teacherId===cell.teacherId).sort((a,b)=>a.scannedAt-b.scannedAt||a.cycle-b.cycle),conclusive=history.filter(r=>['present','absent'].includes(r.status)),latest=conclusive[conclusive.length-1];
   if(cell.override?cell.override.status!=='absent':latest?.status!=='absent')continue;
   alerts.push({teacherId:cell.teacherId,teacher:cell.teacherName,period,cycle:cell.override?null:latest.cycle,scannedAt:cell.override?cell.override.at:latest.scannedAt,manual:!!cell.override,evidenceUrl:latest?.status==='absent'?(latest.evidenceUrl||null):null,evidenceCycle:latest?.status==='absent'?latest.cycle:null,evidenceAt:latest?.status==='absent'?latest.scannedAt:null,cycles:cycles.map(c=>{const rows=history.filter(r=>r.cycle===c.cycle),last=rows[rows.length-1];return {cycle:c.cycle,status:last?.status||'pending',scannedAt:last?.scannedAt||null}})});
  }
  alerts.sort((a,b)=>a.scannedAt-b.scannedAt);
  return {date,period,startedAt,endAt,minutesIntoPeriod:Math.floor((now.getTime()-startedAt)/60000),alerts,cycles,latestScanAt:scans.length?Math.max(...scans.map(r=>r.scannedAt)):null};
 }
 const api={normalize,day,state,cells,stats,lessonEnded,defaultSchedule,live};if(typeof module!=='undefined')module.exports=api;else root.MirsadMonitorModel=api;
})(globalThis);
