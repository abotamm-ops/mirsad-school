async function mergeRemoteSnapshot(state){
 const latest=await getRun();if(!latest||latest.scheduleRevision!==state.snapshot.scheduleRevision)return null;
 const same=(item,row)=>Number(item.period??latest.period)===Number(row.period)&&MirsadMonitorModel.normalize(item.scheduledTeacher||item.teacher)===MirsadMonitorModel.normalize(row.teacherName);
 const itemFor=row=>({...row,period:Number(row.period),teacher:row.teacherName,hasLesson:true,validPeriod:true});
 const update=(list,activePeriod=false)=>Array.isArray(list)?list.map((item,index)=>{
  if(activePeriod&&((latest.current&&index===latest.index)||index<latest.index))return item;
  const row=state.snapshot.lessons.find(row=>same(item,row));return row?{...item,url:row.url||''}:item;
 }):list;
 const next={...latest,schedule:update(latest.schedule),periodItems:update(latest.periodItems,true)};
 // Initial selection excluded empty links. Admit newly supplied lessons for future cycles/periods.
 if(Array.isArray(next.schedule))for(const row of state.snapshot.lessons){
  if(!MirsadScheduleCore.validTeamsUrl(row.url)||next.schedule.some(item=>same(item,row)))continue;
  next.schedule.push(itemFor(row));
 }
 if(latest.running&&latest.current&&!latest.waitingForCycle2&&Array.isArray(next.periodItems))for(const row of state.snapshot.lessons){
  if(Number(row.period)!==Number(latest.period)||!MirsadScheduleCore.validTeamsUrl(row.url)||next.periodItems.some(item=>same(item,row))||(latest.results||[]).some(item=>same(item,row)&&Number(item.cycle)===Number(latest.cycle)))continue;
  next.periodItems.push(itemFor(row));
 }
 if(await saveRun(next)===false)return null;return next;
}
