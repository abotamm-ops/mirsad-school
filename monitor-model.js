(function(root){
 'use strict';
 const normalize=s=>String(s||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim();
 const day=(date=new Date())=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);
 function state(rounds,count){if(rounds.length!==count||rounds.some(x=>!['present','absent'].includes(x?.status)))return 'unresolved';const n=rounds.filter(x=>x.status==='absent').length;return n===count?'absent':n===0?'present':'partial'}
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
  const audit=data.adjustments||[],reset=[...audit].reverse().find(a=>a.type==='reset'),cutoff=reset?.at||0;
  return data.snapshot.lessons.map(lesson=>{
   const allScans=(data.records||[]).filter(r=>r.teacherId===lesson.teacherId&&Number(r.period)===lesson.period);
   const scans=allScans.filter(r=>!reset||r.scannedAt>cutoff);
   const rounds=Array.from({length:data.snapshot.roundCount},(_,i)=>scans.filter(r=>r.cycle===i+1).sort((a,b)=>b.scannedAt-a.scannedAt)[0]||{status:'unresolved',pending:true});
   const conclusive=rounds.filter(r=>['present','absent'].includes(r.status));
   const override=[...audit].reverse().find(a=>a.type==='override'&&a.teacherId===lesson.teacherId&&a.period===lesson.period&&(!reset||a.sequence>reset.sequence));
   const ended=lessonEnded(data,lesson.period,options.now||new Date());
   const inferred=!reset&&!conclusive.length&&ended&&(lesson.url===''||!scans.length||scans.every(r=>r.status==='no-link'));
   let finalState=override?override.status:conclusive.length?state(conclusive,conclusive.length):inferred?'absent':scans.some(r=>r.status==='unresolved')?'unresolved':'pending';
   return {...lesson,rounds,state:finalState,displayState:finalState,override:override||null,inferred,ended,reset:!!reset&&!scans.length&&!override,
    pendingRounds:override||inferred?0:rounds.filter(r=>r.pending).length,failedRounds:override?0:rounds.filter(r=>!r.pending&&!['present','absent'].includes(r.status)).length,
    evidence:allScans.filter(r=>r.evidenceUrl&&r.status!=='present'),history:allScans,adjustments:audit.filter(a=>a.type==='reset'||(a.teacherId===lesson.teacherId&&a.period===lesson.period)),
    late:!override&&rounds[0]?.status==='absent'&&rounds.slice(1).some(r=>r.status==='present')};
  });
 }
 function stats(days,options={}){const map=new Map();for(const data of days){const rows=cells(data,options);for(const teacher of data.snapshot?.teachers||[]){let stat=map.get(teacher.id)||{...teacher,scheduled:0,absentLessons:0,absentDays:0,present:0,unknown:0,partial:0,late:0};const lessons=rows.filter(x=>x.teacherId===teacher.id);stat.scheduled+=lessons.length;for(const x of lessons){stat.absentLessons+=Number(x.state==='absent');stat.present+=Number(['present','partial'].includes(x.state));stat.unknown+=Number(x.state==='unresolved');stat.partial+=Number(x.state==='partial');stat.late+=Number(x.late)}stat.absentDays+=Number(lessons.length>0&&lessons.every(x=>x.state==='absent'));stat.percent=stat.scheduled?Math.round(stat.absentLessons/stat.scheduled*1000)/10:0;map.set(teacher.id,stat)}}return [...map.values()]}
 const api={normalize,day,state,cells,stats,lessonEnded,defaultSchedule};if(typeof module!=='undefined')module.exports=api;else root.MirsadMonitorModel=api;
})(globalThis);
