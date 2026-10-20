// Independent Google Apps Script web app. Never merge with timetable/absence services.
var MONITOR_ROOT='1t6dLow9LsdUtZZFH4CgnUleNMXEBHc2c';
function configureMonitoringService(){var p=PropertiesService.getScriptProperties();if(!p.getProperty('MONITOR_API_KEY'))p.setProperty('MONITOR_API_KEY',Utilities.getUuid()+Utilities.getUuid());if(!p.getProperty('MONITOR_READER_KEY'))p.setProperty('MONITOR_READER_KEY',Utilities.getUuid()+Utilities.getUuid());return 'Set MONITOR_API_KEY and MONITOR_READER_KEY in Script properties. Never paste values into chat.'}
function monitorToday_(){return Utilities.formatDate(new Date(),'Asia/Riyadh','yyyy-MM-dd')}
function monitorName_(v){return String(v||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/\s+/g,' ').trim()}
function monitorEqual_(a,b){a=String(a||'');b=String(b||'');var diff=a.length^b.length;for(var i=0;i<Math.max(a.length,b.length);i++)diff|=(a.charCodeAt(i)||0)^(b.charCodeAt(i)||0);return !!a.length&&diff===0}
function monitorPrivate_(folder){if(PropertiesService.getScriptProperties().getProperty('MONITOR_PUBLIC_READ')==='true')return folder;var access=folder.getSharingAccess();if(access===DriveApp.Access.ANYONE||access===DriveApp.Access.ANYONE_WITH_LINK)throw new Error('الوصول العام غير مقبول: '+folder.getName()+' — '+String(access)+'. إذا كان الوصول موروثًا من مجلد أب، شغّل createPrivateMonitoringFolder بحساب المالك لتجهيز مجلد خاص مستقل.');return folder}
function monitorFile_(folder,name){var it=folder.getFilesByName(name);return it.hasNext()?it.next():null}
function monitorRead_(file,fallback){return file?JSON.parse(file.getBlob().getDataAsString()):fallback}
function monitorWrite_(folder,name,data){var text=JSON.stringify(data),file=monitorFile_(folder,name);if(file)file.setContent(text);else file=folder.createFile(name,text,'application/json');return file}
function monitorDay_(root,date,create){if(!/^\d{4}-\d{2}-\d{2}$/.test(date||''))throw new Error('تاريخ غير صالح');var name='توثيق غياب '+date,it=root.getFoldersByName(name),folder=it.hasNext()?it.next():null;if(!folder&&create)folder=root.createFolder(name);if(!folder)throw new Error('لم تبدأ أرشفة هذا اليوم');return monitorPrivate_(folder)}
function monitorSnapshot_(root,payload,date){
 var registry=monitorRead_(monitorFile_(root,'mirsad-teachers.json'),{}),teachers=[],seen={};
 var names=payload.teachers||[];if(!Array.isArray(names)||!Array.isArray(payload.items)||names.length>500||payload.items.length>3500)throw new Error('جدول غير صالح');
 names=names.concat(payload.items.map(function(x){return x.teacher}));
 names.forEach(function(name){var key=monitorName_(name);if(!key||seen[key])return;seen[key]=true;if(!registry[key])registry[key]={id:'teacher-'+Utilities.getUuid(),name:String(name).trim()};teachers.push(registry[key])});
 if(!teachers.length)throw new Error('جدول المعلمين فارغ');
 var used={},lessons=payload.items.map(function(x){var teacher=registry[monitorName_(x.teacher)],n=Number(x.period);if(!teacher||!Number.isInteger(n)||n<1||n>7)throw new Error('تعذر ربط معلم بحصة');var key=teacher.id+'|'+n;if(used[key])throw new Error('يوجد أكثر من سجل للحصة نفسها؛ راجع ربط أعمدة الجدول');used[key]=true;return {teacherId:teacher.id,teacherName:teacher.name,period:n,subject:String(x.subject||''),className:String(x.className||''),url:String(x.url||'')}});
 var count=Number(payload.roundCount);if(!Number.isInteger(count)||count<1||count>3||!lessons.length)throw new Error('عدد الدورات أو الحصص غير صالح');
 monitorWrite_(root,'mirsad-teachers.json',registry);return {date:date,teachers:teachers,lessons:lessons,roundCount:count,createdAt:Date.now()};
}
function monitorRequest_(p){
 var props=PropertiesService.getScriptProperties(),writeKey=props.getProperty('MONITOR_API_KEY'),readKey=props.getProperty('MONITOR_READER_KEY'),sitePassword=props.getProperty('MONITOR_SITE_PASSWORD');
 var writer=String(writeKey||'').length>=32&&monitorEqual_(p.key,writeKey),reader=String(readKey||'').length>=32&&monitorEqual_(p.key,readKey);
 var siteReader=!!sitePassword&&monitorEqual_(p.key,sitePassword);
 var publicRead=props.getProperty('MONITOR_PUBLIC_READ')==='true';
 if(!writer&&!reader&&!siteReader&&!publicRead)throw new Error('غير مصرح بالدخول');
 var reading=['dates','day'].indexOf(p.action)>=0;if(!reading&&!writer)throw new Error('صلاحية القراءة لا تسمح بالرفع');
 var root=monitorPrivate_(DriveApp.getFolderById(MONITOR_ROOT));
 if(p.action==='dates'){var dates=[],it=root.getFolders();while(it.hasNext()){var f=it.next(),m=/^توثيق غياب (\d{4}-\d{2}-\d{2})$/.exec(f.getName());if(m&&monitorFile_(f,'attendance.json'))dates.push(m[1])}return {dates:dates.sort().reverse(),authMode:publicRead?'public':siteReader?'site-password':'access-key'}}
 var date=p.date||monitorToday_();if(p.action==='startDay'&&date!==monitorToday_())throw new Error('بداية اليوم تكون لتاريخ اليوم في السعودية فقط');var folder=monitorDay_(root,date,p.action==='startDay');
 var file=monitorFile_(folder,'attendance.json'),data=monitorRead_(file,null);
 if(p.action==='startDay'){
  if(date!==monitorToday_())throw new Error('بداية اليوم تكون لتاريخ اليوم في السعودية فقط');
  if(!data){data={snapshot:monitorSnapshot_(root,p,date),records:[],evidence:{}};monitorWrite_(folder,'attendance.json',data)}
  return {snapshot:data.snapshot,folderUrl:folder.getUrl()};
 }
 if(!data)throw new Error('جدول اليوم غير محفوظ');
 if(p.action==='day'){var result=JSON.parse(JSON.stringify(data));result.records.forEach(function(r){r.evidenceUrl=result.evidence[r.scanId]?.url||null});delete result.evidence;return result}
 var record=p.record||{},lesson=data.snapshot.lessons.find(function(l){return monitorName_(l.teacherName)===monitorName_(record.scheduledTeacher)&&l.period===Number(record.period)});
 if(!lesson||typeof record.scanId!=='string'||record.scanId.length>200||!record.scanId)throw new Error('النتيجة لا تطابق جدول اليوم المحفوظ');
 if(!['present','absent','unresolved','no-link'].includes(record.status)||!Number.isInteger(record.cycle)||record.cycle<1||record.cycle>data.snapshot.roundCount)throw new Error('حالة أو دورة غير صالحة');
 if(p.action==='image'){
  if(!['absent','unresolved'].includes(record.status))throw new Error('لا يرفع النظام صور الحاضر');
  if(data.evidence[record.scanId])return data.evidence[record.scanId];
  if(typeof p.image!=='string'||p.image.length>12000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(p.image))throw new Error('صورة PNG غير صالحة');
  var bytes=Utilities.base64Decode(p.image.split(',')[1]),signature=[137,80,78,71,13,10,26,10];if(bytes.length<8||signature.some(function(v,i){return (bytes[i]&255)!==v}))throw new Error('محتوى الصورة غير صالح');
  var safe=function(v){return String(v).replace(/[\\/:*?"<>|\u0000-\u001f]/g,'_').slice(0,100)};
  var name=safe(record.teacher||lesson.teacherName)+'_ح'+record.period+'_د'+record.cycle+'_'+(record.status==='absent'?'غائب':'غير محسوم')+'_'+safe(record.scanId)+'.png';
  if(record.localName){if(typeof record.localName!=='string'||record.localName.length>220||/[\\/:*?"<>|\u0000-\u001f]/.test(record.localName)||!record.localName.endsWith('.png'))throw new Error('اسم ملف غير صالح');name=record.localName;}
  var image=monitorFile_(folder,name)||folder.createFile(Utilities.newBlob(bytes,'image/png',name));
  if(publicRead)image.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);else monitorPrivate_(image);
  var evidence={fileId:image.getId(),url:image.getUrl(),name:name};data.evidence[record.scanId]=evidence;monitorWrite_(folder,'attendance.json',data);return evidence;
 }
 if(p.action==='record'){
  if(!data.records.some(function(r){return r.scanId===record.scanId}))data.records.push({scanId:record.scanId,teacherId:lesson.teacherId,teacherName:lesson.teacherName,observedTeacher:String(record.teacher||''),period:record.period,cycle:record.cycle,status:record.status,detail:String(record.detail||'').slice(0,3000),scannedAt:Number(record.scannedAt)||Date.now()});
  monitorWrite_(folder,'attendance.json',data);return {saved:true};
 }
 throw new Error('طلب غير مدعوم');
}
function doPost(e){var result,lock=LockService.getScriptLock();try{var p=JSON.parse(e.postData.contents);lock.waitLock(30000);result={ok:true,...monitorRequest_(p)}}catch(error){result={ok:false,error:String(error.message||error)}}finally{if(lock.hasLock())lock.releaseLock()}return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)}

// Optional owner-run provisioning. Creates a dedicated My Drive folder, never edits the old folder.
MONITOR_ROOT = PropertiesService.getScriptProperties().getProperty('MONITOR_PRIVATE_ROOT_ID') || MONITOR_ROOT;
function createPrivateMonitoringFolder() {
  var props = PropertiesService.getScriptProperties();
  var existing = props.getProperty('MONITOR_PRIVATE_ROOT_ID');
  var folder = existing ? DriveApp.getFolderById(existing) : DriveApp.createFolder('توثيق غياب مرصاد');
  monitorPrivate_(folder);
  props.setProperty('MONITOR_PRIVATE_ROOT_ID', folder.getId());
  MONITOR_ROOT = folder.getId();
  console.log('مجلد التوثيق الخاص: ' + folder.getUrl());
  return folder.getUrl();
}

// Run once as the owner to enable the link-sharing requested for this monitoring archive.
function enablePublicMonitoringSharing(){
 var props=PropertiesService.getScriptProperties(),root=DriveApp.getFolderById(MONITOR_ROOT);
 root.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
 var folders=root.getFolders(),count=0;
 while(folders.hasNext()){
  var folder=folders.next();if(!/^توثيق غياب \d{4}-\d{2}-\d{2}$/.test(folder.getName()))continue;
  folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);
  var data=monitorRead_(monitorFile_(folder,'attendance.json'),null);
  if(data)Object.keys(data.evidence||{}).forEach(function(id){DriveApp.getFileById(data.evidence[id].fileId).setSharing(DriveApp.Access.ANYONE_WITH_LINK,DriveApp.Permission.VIEW);count++});
 }
 props.setProperty('MONITOR_PUBLIC_READ','true');
 console.log('تم فتح قراءة الرصد والصور لأي شخص لديه الرابط. الصور السابقة: '+count);
 return root.getUrl();
}
