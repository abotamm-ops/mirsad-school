// Restores an immutable saved copy; the displaced active table is archived first.
function monitorRestoreArchived_(root,p){
 if(p.date!==monitorToday_())throw new Error('إرجاع جدول الرصد النشط متاح لليوم الحالي فقط؛ الأيام السابقة للعرض');
 if(!/^[A-Za-z0-9_-]{8,120}$/.test(p.requestId||''))throw new Error('معرف الاسترجاع غير صالح');
 var folder=monitorScheduleFolder_(root,p.date,false),current=folder?monitorRead_(monitorFile_(folder,'attendance.json'),null):null;if(!current)throw new Error('لا يوجد جدول نشط؛ لم يُغيّر شيء');
 if(current.lastScheduleRestore?.requestId===p.requestId)return {restored:true,snapshot:current.snapshot,folderUrl:folder.getUrl(),previousVersion:current.lastScheduleRestore.previousVersion};
 if(current.snapshot.scheduleRevision!==p.expectedRevision)throw new Error('تغير الجدول النشط؛ حدّث قائمة النسخ قبل الاسترجاع');
 var saved=monitorArchivedData_(folder,p.restoreId);if(saved.snapshot.date!==p.date||saved.snapshot.sourceType!=='madrasati')throw new Error('النسخة لا تخص جدول مدرستي لهذا اليوم');
 var sourceFile=monitorFile_(root,'mirsad-timetable-source.json'),source=monitorRead_(sourceFile,null),schoolId=source?.schoolId||source?.payload?.schoolId;
 if(!/^[a-f0-9]{32}$/i.test(schoolId||''))throw new Error('تعذر التحقق من مدرسة الجدول؛ لم يُسترجع');
 var restored=JSON.parse(JSON.stringify(saved)),previousVersion=Utilities.getUuid();delete restored.archiveId;delete restored.archivedAt;
 restored.lastScheduleRestore={requestId:p.requestId,restoreId:p.restoreId,previousVersion:previousVersion,at:Date.now()};
 var payload={source:'madrasati',schoolId:schoolId,sourceUrl:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId='+schoolId,scheduleDate:restored.snapshot.sourceScheduleDate,importedForDate:p.date,teachers:restored.snapshot.teachers.map(function(t){return t.name}),lessons:restored.snapshot.lessons.map(function(l){return {teacher:l.teacherName,cellIndex:Number(l.period)+1,title:l.subject||'حصة',lesson:l.className||'غير محدد',time:'الحصة '+l.period,teams:l.url||'',linkState:l.url?'linked':'unprepared',...monitorCalendarFields_(l,l.url||'')}})};payload.totalTeachers=payload.teachers.length;payload.totalLessons=payload.lessons.length;payload=monitorMadrasatiPayload_(payload);
 var archive=monitorArchiveFolder_(folder,true);monitorWrite_(archive,previousVersion+'.json',{...current,archiveId:previousVersion,archivedAt:Date.now()});
 try{monitorWrite_(root,'mirsad-timetable-source.json',{...source,mode:'madrasati',schoolId:schoolId,payload:payload,updatedAt:Date.now()});monitorWrite_(folder,'attendance.json',restored)}catch(e){monitorWrite_(folder,'attendance.json',current);if(source)monitorWrite_(root,'mirsad-timetable-source.json',source);throw e}
 return {restored:true,snapshot:restored.snapshot,folderUrl:folder.getUrl(),previousVersion:previousVersion,records:(restored.records||[]).length,images:Object.keys(restored.evidence||{}).length};
}
