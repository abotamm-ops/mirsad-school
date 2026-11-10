let runLinkSnapshot=null;
function reconcileRunLinks(latest,snapshot=runLinkSnapshot){
 if(!latest||!snapshot||latest.scheduleRevision!==snapshot.scheduleRevision)return latest;
 const same=(item,row)=>Number(item.period??latest.period)===Number(row.period)&&MirsadMonitorModel.normalize(item.scheduledTeacher||item.teacher)===MirsadMonitorModel.normalize(row.teacherName);
 const itemFor=row=>({...row,period:Number(row.period),teacher:row.teacherName,hasLesson:true,validPeriod:true});
 const update=(list,activePeriod=false)=>Array.isArray(list)?list.map((item,index)=>{
  if(activePeriod&&((latest.current&&index===latest.index)||index<latest.index))return item;
  const row=snapshot.lessons.find(row=>same(item,row));return row?{...item,url:row.url||''}:item;
 }):list;
 const next={...latest,schedule:update(latest.schedule),periodItems:update(latest.periodItems,true)};
 // Initial selection excluded empty links. Admit newly supplied lessons for future cycles/periods.
 if(Array.isArray(next.schedule))for(const row of snapshot.lessons){
  if(!MirsadScheduleCore.validTeamsUrl(row.url)||next.schedule.some(item=>same(item,row)))continue;
  next.schedule.push(itemFor(row));
 }
 if((latest.running||latest.paused)&&!latest.waitingForCycle2&&Array.isArray(next.periodItems))for(const row of snapshot.lessons){
  if(Number(row.period)!==Number(latest.period)||!MirsadScheduleCore.validTeamsUrl(row.url))continue;
  // A consumed no-link placeholder is not a completed Teams check. Queue it again once a link exists.
  if(next.periodItems.some((item,index)=>index>=Number(latest.index||0)&&same(item,row)))continue;
  const history=(latest.results||[]).filter(item=>same(item,row)&&Number(item.cycle)===Number(latest.cycle));
  if(history.some(item=>(item.scanStatus||item.status)!=='no-link'))continue;
  const consumed=next.periodItems.filter((item,index)=>index<Number(latest.index||0)&&same(item,row));
  if(consumed.some(item=>MirsadScheduleCore.validTeamsUrl(item.url))&&!history.some(item=>(item.scanStatus||item.status)==='no-link'))continue;
  next.periodItems.push(itemFor(row));
 }
 return Object.assign(latest,next);
}
async function mergeRemoteSnapshot(state){
 const latest=await getRun();if(!latest||latest.scheduleRevision!==state.snapshot.scheduleRevision)return null;
 runLinkSnapshot=state.snapshot;
 reconcileRunLinks(latest);
 if(await saveRun(latest)===false)return null;return latest;
}
