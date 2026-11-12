var MirsadScheduleRestore=(()=>{
 const popup=chrome.runtime.getURL('popup.html');
 async function command(p){const run=await getRun(),capture=(await chrome.storage.session.get('mirsadVideoCapture')).mirsadVideoCapture;if(run?.running||run?.current||capture?.active)throw Error('أوقف الرصد مؤقتًا وانتظر انتهاء التسجيل قبل استرجاع الجدول');
  const config=(await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig;const sameAccount=async()=>{const c=(await chrome.storage.local.get('mirsadDriveConfig')).mirsadDriveConfig;return !!config&&c?.url===config.url&&c?.key===config.key};
  const date=MirsadMonitorModel.day(),state=await CloudMonitoring.video('protectedDayState');if(!state.exists)throw Error('لا يوجد جدول نشط لليوم');
  if(p.type==='MIRSAD_SCHEDULE_VERSIONS')return {ok:true,...await CloudMonitoring.video('scheduleVersions',{date}),date,revision:state.snapshot.scheduleRevision};
  
  const r=await CloudMonitoring.video('restoreArchivedSchedule',{date,restoreId:p.id,expectedRevision:p.expectedRevision,requestId:p.requestId});if(!r.restored||!r.snapshot?.scheduleRevision)throw Error('لم يتأكد الاسترجاع؛ حدّث سكربت الاسترجاع ونشره الحالي');
  if(!await sameAccount())throw Error('تغير الحساب؛ أُوقف تطبيق النسخة محليًا');const verified=await CloudMonitoring.video('protectedDayState');if(!await sameAccount())throw Error('تغير الحساب؛ أُوقف تطبيق النسخة محليًا');if(verified.snapshot?.scheduleRevision!==r.snapshot.scheduleRevision)throw Error('تعذر تأكيد الجدول المسترجع؛ لا تشغّل الرصد قبل التحقق');
  const latest=await getRun();if(latest?.running||latest?.current){await pauseMonitoring();throw Error('بدأ الرصد أثناء الاسترجاع؛ أُوقف مؤقتًا. اعرض النسخ وتحقق من الجدول قبل تشغيله')}
  const snap=verified.snapshot,sourceDate=snap.sourceScheduleDate,proof={date:sourceDate,importedForDate:date,monitoringPrepared:true,activeVerified:true,revision:snap.scheduleRevision,updatedAt:Date.now(),lessons:snap.lessons.length};
  await chrome.alarms.clear('mirsadNextAction');await chrome.alarms.clear('mirsadScanTimeout');
  await chrome.storage.local.set({mirsadDriveDay:{date,snapshot:snap,folderUrl:verified.folderUrl},mirsadMadrasatiSelectedDate:sourceDate,mirsadMadrasatiLastSuccess:proof,mirsadLoadIntent:{date,sourceDate,status:'verified'},mirsadPopupWorkflow:{date,prepared:snap.scheduleRevision},mirsadPendingImport:null,mirsadScheduleSettings:{...scheduleSettings,...snap.scheduleSettings,roundCount:snap.roundCount,configuredRoundCount:snap.roundCount}});
  // Discard only the displaced local execution cursor, never cloud results or media.
  await chrome.storage.local.remove('mirsadAutoRun');await refreshScheduleSettings();await setStatus('تم استرجاع الجدول بنتائجه وصوره؛ شغّل الرصد عند الحاجة');return {ok:true,...r};
 }
 chrome.runtime.onMessage.addListener((p,sender,reply)=>{if(!['MIRSAD_SCHEDULE_VERSIONS','MIRSAD_SCHEDULE_RESTORE'].includes(p?.type)||sender.url?.split('?')[0]!==popup)return;command(p).then(reply).catch(e=>reply({ok:false,error:e.message}));return true});return {command};
})();
