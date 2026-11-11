function monitorVideoRequest_(p,props,attendanceRoot,writer,admin){
 if(!writer&&!admin)throw new Error('الفيديو خاص بإدارة الموقع وجهاز الرصد');
 var date=p.date||monitorToday_();if(!monitorDateValid_(date))throw new Error('تاريخ الفيديو غير صالح');
 if(['videoConfigure','videoPoll'].includes(p.action)&&date!==monitorToday_())throw new Error('التسجيل خاص بجدول اليوم فقط');
 var school=typeof COMMERCIAL_CONTEXT_!=='undefined'&&COMMERCIAL_CONTEXT_?COMMERCIAL_CONTEXT_.school:null,drive=DriveApp,root=attendanceRoot,link=null;
 if(school){link=schoolDriveLink_(school.id);if(!link||!link.rootId||link.revoked){if(p.action==='videoStatus')return {supported:true,canManage:admin,driveRequired:true,revision:0,configs:[],jobs:[],device:null,serverTime:Date.now()};throw new Error('اربط Google Drive المدرسة أولًا لحفظ الفيديو في حسابها')}drive=schoolDriveAdapter_(school);root=drive.getFolderById(link.rootId)}
 var stateName='mirsad-video-'+date+'.json',deviceKey='MONITOR_VIDEO_DEVICE_'+date;
 function token(){return school?schoolDriveToken_(school):ScriptApp.getOAuthToken()}
 function folder(){var name='فيديو حصص '+date,it=root.getFoldersByName(name),f=it.hasNext()?it.next():root.createFolder(name);var access=f.getSharingAccess();if(access===DriveApp.Access.ANYONE||access===DriveApp.Access.ANYONE_WITH_LINK)throw new Error('مجلد الفيديو يجب أن يكون خاصًا');return f}
 function google(url,options){options.headers={...(options.headers||{}),Authorization:'Bearer '+token()};options.muteHttpExceptions=true;return UrlFetchApp.fetch(url,options)}
 var service=createMirsadVideoService({date:date,admin:admin,writer:writer,now:Date.now,id:function(){return Utilities.getUuid()},load:function(){return monitorRead_(monitorFile_(root,stateName),null)},save:function(s){monitorWrite_(root,stateName,s)},deviceRead:function(){try{return JSON.parse(props.getProperty(deviceKey)||'null')}catch(e){return null}},deviceWrite:function(s){props.setProperty(deviceKey,JSON.stringify(s))},snapshot:function(){var f=monitorScheduleFolder_(attendanceRoot,date,false),data=f?monitorRead_(monitorFile_(f,'attendance.json'),null):null;if(!data||!data.snapshot)throw new Error('حمّل جدول اليوم أولًا');return data.snapshot},uploadBegin:function(job){
  var parent=folder();job.folderId=parent.getId();
  var metadata={name:MirsadVideoCore.fileName(job),mimeType:'video/webm',parents:[job.folderId],appProperties:{mirsadVideoJob:job.id,...school?{mirsadSchool:school.id}:{}}};
  var response=google('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink',{method:'post',contentType:'application/json',headers:{'X-Upload-Content-Type':'video/webm','X-Upload-Content-Length':String(job.size)},payload:JSON.stringify(metadata)});
  var location=response.getAllHeaders().Location||response.getAllHeaders().location;
  if(response.getResponseCode()<200||response.getResponseCode()>=300||!/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/.test(String(location||'')))throw new Error('تعذر تجهيز رفع الفيديو إلى Drive');return String(location);
 },uploadVerify:function(job,id){
  if(!/^[A-Za-z0-9_-]{10,200}$/.test(id))throw new Error('معرف ملف الفيديو غير صالح');
  var response=google('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(id)+'?fields=id,size,mimeType,parents,appProperties,webViewLink,trashed',{method:'get'}),file;
  try{file=JSON.parse(response.getContentText())}catch(e){throw new Error('تعذر التحقق من ملف الفيديو')}
  if(response.getResponseCode()!==200||file.trashed||Number(file.size)!==job.size||file.mimeType!=='video/webm'||!file.parents?.includes(job.folderId)||file.appProperties?.mirsadVideoJob!==job.id||school&&file.appProperties?.mirsadSchool!==school.id)throw new Error('ملف الفيديو لا يطابق تسجيل الحصة');
  return {url:'https://drive.google.com/file/d/'+id+'/view'};
 }});
 return service.request(p.action,p);
}
