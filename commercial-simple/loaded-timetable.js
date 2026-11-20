/* Reuse only a server-confirmed import for this account, school visit and day.
   This reads no new timetable and grants no authorization or write permission. */
var MirsadLoadedTimetable=(()=>{'use strict';
 async function get(){
  const s=await chrome.storage.local.get(['mirsadDriveConfig','mirsadCommercialSchool','mirsadDriveDay','mirsadMadrasatiSelectedDate','mirsadMadrasatiLastSuccess','mirsadLoadIntent','mirsadPendingImport','mirsadSimpleOperation']);
  const day=s.mirsadDriveDay,snapshot=day?.snapshot,today=MirsadMonitorModel.day(),last=s.mirsadMadrasatiLastSuccess,selected=s.mirsadMadrasatiSelectedDate,intent=s.mirsadLoadIntent,operation=s.mirsadSimpleOperation;
  if(!s.mirsadDriveConfig?.key||s.mirsadPendingImport||!snapshot?.scheduleRevision||!Array.isArray(snapshot.lessons)||!snapshot.lessons.length||day.date!==today||snapshot.date!==today||snapshot.sourceType!=='madrasati'||!selected||snapshot.sourceScheduleDate!==selected)return null;
  if(!last?.monitoringPrepared||last.importedForDate!==today||last.date!==selected||last.revision!==snapshot.scheduleRevision)return null;
  if(intent?.date===today&&!['verified','cancelled'].includes(intent.status))return null;
  if(operation?.kind==='RESET'&&['running','failed','uncertain'].includes(operation.phase))return null;
  if(typeof MirsadMulti==='undefined')return null;
  const ctx=await MirsadMulti.context();
  if(!ctx?.site?.id||!ctx.site.localId||ctx.writer!==s.mirsadDriveConfig.key||ctx.account!==s.mirsadCommercialSchool?.id||snapshot.siteId!==ctx.site.id)return null;
  // A school switch clears the scoped cache before installing its new visit.
  // Recheck after the asynchronous context lookup so an old read cannot cross it.
  const latest=await chrome.storage.local.get(['mirsadDriveConfig','mirsadDriveDay','mirsadMultiSchool','mirsadPendingImport','mirsadMadrasatiSelectedDate']);
  if(latest.mirsadDriveConfig?.key!==ctx.writer||latest.mirsadMultiSchool?.site?.localId!==ctx.site.localId||latest.mirsadDriveDay?.snapshot?.scheduleRevision!==snapshot.scheduleRevision||latest.mirsadPendingImport||latest.mirsadMadrasatiSelectedDate!==selected)return null;
  return day;
 }
 return {get};
})();
