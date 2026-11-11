function monitorVideoRequest_(p,props,attendanceRoot,writer,admin){
 if(!writer&&!admin)throw new Error('الفيديو خاص بإدارة الموقع وجهاز الرصد');
 var date=p.date||monitorToday_();if(!monitorDateValid_(date))throw new Error('تاريخ الفيديو غير صالح');
 if(['videoConfigure','videoPoll'].includes(p.action)&&date!==monitorToday_())throw new Error('التسجيل خاص بجدول اليوم فقط');
 var school=typeof COMMERCIAL_CONTEXT_!=='undefined'&&COMMERCIAL_CONTEXT_?COMMERCIAL_CONTEXT_.school:null,drive=DriveApp,root=attendanceRoot,link=null;
 if(school){link=schoolDriveLink_(school.id);if(!link||!link.rootId||link.revoked){if(p.action==='videoStatus')return {supported:true,canManage:admin,driveRequired:true,revision:0,configs:[],jobs:[],device:null,serverTime:Date.now()};throw new Error('اربط Google Drive المدرسة أولًا لحفظ الفيديو في حسابها')}drive=schoolDriveAdapter_(school);root=drive.getFolderById(link.rootId)}
 var stateName='mirsad-video-'+date+'.json',deviceKey='MONITOR_VIDEO_DEVICE_'+date;
 function token(){return school?schoolDriveToken_(school):ScriptApp.getOAuthToken()}
 function folder(){var parents=root.getFoldersByName('Videos'),parent=parents.hasNext()?parents.next():root.createFolder('Videos'),it=parent.getFoldersByName(date),f=it.hasNext()?it.next():parent.createFolder(date);var access=f.getSharingAccess();if(access===DriveApp.Access.ANYONE||access===DriveApp.Access.ANYONE_WITH_LINK)throw new Error('مجلد الفيديو يجب أن يكون خاصًا');return f}
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
 var result=service.request(p.action,p);if(p.action==='videoPoll')result.resets=monitorVideoResets_(props);return result;
}
function monitorVideoResets_(props){try{return JSON.parse(props.getProperty('MONITOR_VIDEO_RESETS')||'{}')}catch(e){return {}}}
function monitorVideoReset_(date,props,attendanceRoot,requestId){
 if(!monitorDateValid_(date))throw new Error('تاريخ تصفير الفيديو غير صالح');
 var root=attendanceRoot,school=typeof COMMERCIAL_CONTEXT_!=='undefined'&&COMMERCIAL_CONTEXT_?COMMERCIAL_CONTEXT_.school:null;
 if(school){var link=schoolDriveLink_(school.id);if(link&&link.rootId){root=schoolDriveAdapter_(school).getFolderById(link.rootId)}else return}
 var resets=monitorVideoResets_(props),key='MONITOR_VIDEO_RESET_REQUEST_'+date;
 if(props.getProperty(key)!==requestId){resets[date]=(resets[date]||0)+1;var keys=Object.keys(resets);while(keys.length>200)delete resets[keys.shift()];props.setProperty('MONITOR_VIDEO_RESETS',JSON.stringify(resets));props.setProperty(key,requestId)}
 var stateName='mirsad-video-'+date+'.json',old=monitorRead_(monitorFile_(root,stateName),{});monitorWrite_(root,stateName,{revision:(old.revision||0)+1,generation:resets[date],configs:[],jobs:[]});
 function remove(folder){if(folder.getId()===root.getId())throw new Error('تعذر تحديد مجلد الفيديو');var response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(folder.getId()),{method:'delete',headers:{Authorization:'Bearer '+(school?schoolDriveToken_(school):ScriptApp.getOAuthToken())},muteHttpExceptions:true});if(![204,404].includes(response.getResponseCode()))throw new Error('لم يتأكد حذف فيديو اليوم من Drive؛ أعد التصفير')}
 var parents=root.getFoldersByName('Videos');while(parents.hasNext()){var dates=parents.next().getFoldersByName(date);while(dates.hasNext())remove(dates.next())}
 var legacy=root.getFoldersByName('فيديو حصص '+date);while(legacy.hasNext())remove(legacy.next());
}
