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
// Append verified scheduled lessons omitted by older readers; existing lessons and evidence stay intact.
function monitorMergeMissingLessons_(data,items,source){
 if(!Array.isArray(items)||data.snapshot.date!==monitorToday_())return 0;
 var added=[],existing={};data.snapshot.lessons.forEach(function(l){existing[l.teacherId+'|'+l.period]=true});
 items.forEach(function(item){if(!item||typeof item!=='object')return;var teacher=data.snapshot.teachers.find(function(t){return monitorName_(t.name)===monitorName_(item.teacher)}),period=Number(item.period);if(!teacher||!Number.isInteger(period)||period<1||period>7||String(item.url||'').trim()||(!String(item.subject||'').trim()&&!String(item.className||'').trim()))return;var key=teacher.id+'|'+period;if(existing[key])return;existing[key]=true;var lesson={teacherId:teacher.id,teacherName:teacher.name,period:period,subject:String(item.subject||''),className:String(item.className||''),url:''};data.snapshot.lessons.push(lesson);added.push(key)});
 if(added.length){data.snapshot.repairs=data.snapshot.repairs||[];data.snapshot.repairs.push({type:'missing-linkless-lessons',at:Date.now(),source:String(source||''),added:added})}return added.length;
}
// Owner runs once to repair today's omitted linkless lessons from today's published timetable.
function repairMissingMonitoringLessons(){
 var lock=LockService.getScriptLock();lock.waitLock(30000);try{
 var props=PropertiesService.getScriptProperties(),root=monitorPrivate_(DriveApp.getFolderById(props.getProperty('MONITOR_PRIVATE_ROOT_ID')||MONITOR_ROOT)),date=monitorToday_(),folder=monitorDay_(root,date,false),data=monitorRead_(monitorFile_(folder,'attendance.json'),null);if(!data)throw new Error('لا يوجد سجل لهذا اليوم');
 var response=UrlFetchApp.fetch('https://script.google.com/macros/s/AKfycbznAVdLw5KVYmESB6Dx4av84-UQi3lewoK2Si59UNf_03y9keQf3CNxtXu0KhGbudX7Ng/exec',{muteHttpExceptions:true});if(response.getResponseCode()!==200)throw new Error('تعذر قراءة جدول اليوم');var envelope=JSON.parse(response.getContentText()),payload=envelope.payload;if(!envelope.ok||!payload||!Array.isArray(payload.lessons)||!payload.updatedAt||Utilities.formatDate(new Date(payload.updatedAt),'Asia/Riyadh','yyyy-MM-dd')!==date)throw new Error('يجب رفع جدول اليوم إلى مرصاد قبل إصلاح سجل اليوم');
 var match=/[?&]dayindex=(\d+)/.exec(payload.sourceUrl||'');if(!match||Number(match[1])!==new Date(date+'T12:00:00+03:00').getUTCDay())throw new Error('يوم جدول نقار لا يطابق يوم الرصد');
 var items=payload.lessons.filter(function(l){return !String(l.teams||l.teamsUrl||'').trim()}).map(function(l){return {teacher:l.teacher,period:Number(l.cellIndex)-1,subject:l.title||l.subject||l.lessonTitle||'حصة',className:l.class||l.lesson||l.className||'',url:''}});var count=monitorMergeMissingLessons_(data,items,payload.updatedAt);if(count)monitorWrite_(folder,'attendance.json',data);console.log('أُضيفت '+count+' حصة مفقودة إلى سجل '+date+' مع حفظ جميع النتائج والصور');return count;
 }finally{lock.releaseLock()}
}
function monitorSchedule_(value){
 if(!value)return null;var m=/^(\d{2}):(\d{2})$/.exec(value.manualStart||''),duration=Number(value.periodDuration),gap=Number(value.manualGapMinutes);
 if(!m||Number(m[1])>23||Number(m[2])>59||!Number.isInteger(duration)||duration<1||duration>180||!Number.isInteger(gap)||gap<0||gap>60)throw new Error('توقيت الرصد غير صالح');
 return {manualStart:value.manualStart,periodDuration:duration,manualGapMinutes:gap};
}
function monitorIsTrial_(value){return !!value&&(value.testMode===true||value.backtestMode===true||value.immediateMode===true||['trial','test','experiment'].indexOf(value.environment||value.mode)>=0)}
function monitorTeacherToken_(props){var token=props.getProperty('MONITOR_TEACHER_VIEW_KEY')||'';if(token&&(token.length<32||['MONITOR_API_KEY','MONITOR_READER_KEY','MONITOR_SITE_PASSWORD'].some(function(k){return monitorEqual_(token,props.getProperty(k))})))throw new Error('رمز رابط المعلمين يجب أن يكون مستقلًا عن رموز الإدارة');return token}
function monitorTeacherAccess_(p,props){
 if(props.getProperty('MONITOR_EVIDENCE_PRIVATE')!=='true')throw new Error('صفحة المعلمين بانتظار إكمال تهيئتها لدى الإدارة');
 var token=monitorTeacherToken_(props);if(token){if(token.length<32||!monitorEqual_(p.viewToken,token))throw new Error('رابط المشاهدة غير مصرح أو انتهت صلاحيته')}else if(props.getProperty('MONITOR_PUBLIC_READ')!=='true')throw new Error('مشاهدة المعلمين غير مفعّلة');
 var domain=String(props.getProperty('MONITOR_TEACHERS_DOMAIN')||'').trim().toLowerCase();if(domain){var email=String(Session.getActiveUser().getEmail()||'').toLowerCase();if(!email||email.split('@')[1]!==domain)throw new Error('يلزم الدخول بحساب المدرسة للمشاهدة')}
}
function monitorTeachersLive_(p){
 var props=PropertiesService.getScriptProperties();monitorTeacherAccess_(p,props);var cache=typeof CacheService!=='undefined'?CacheService.getScriptCache():null,cacheKey='teachers-live-'+monitorToday_();if(cache)try{var cached=cache.get(cacheKey);if(cached){var stored=JSON.parse(cached);stored.serverTime=Date.now();return stored}}catch(ignore){}var date=monitorToday_(),now=new Date(),root=monitorPrivate_(DriveApp.getFolderById(MONITOR_ROOT)),folders=root.getFoldersByName('توثيق غياب '+date),folder=folders.hasNext()?folders.next():null,data=folder?monitorRead_(monitorFile_(folder,'attendance.json'),null):null;
 var result={feed:'teachers-live-v1',source:'official',date:date,serverTime:now.getTime(),updatedAt:null,schedule:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1},currentPeriod:null,rows:[],summary:{present:0,partial:0,partialAbsence:0,absent:0,unresolved:0}};
 if(!data||!data.snapshot||data.snapshot.date!==date||monitorIsTrial_(data)||monitorIsTrial_(data.snapshot))return result;
 data=JSON.parse(JSON.stringify(data));data.records=(data.records||[]).filter(function(r){return !monitorIsTrial_(r)});Object.keys(data.evidence||{}).forEach(function(id){var proof=data.evidence[id];if(proof.record&&!monitorIsTrial_(proof.record)&&!data.records.some(function(r){return r.scanId===id}))data.records.push(proof.record)});data.adjustments=(data.adjustments||[]).filter(function(a){return !monitorIsTrial_(a)});
 result.schedule=monitorSchedule_(data.reportSchedule||data.snapshot.scheduleSettings)||result.schedule;var active=MONITOR_TEACHER_MODEL_.live(data,{now:now});result.currentPeriod=active.period;
 var cells=MONITOR_TEACHER_MODEL_.cells(data,{now:now});result.rows=cells.map(function(c){return {teacherId:c.teacherId,teacher:c.teacherName,period:c.period,status:['present','partial','partial-absence','absent'].indexOf(c.state)>=0?c.state:'unresolved',pending:c.state==='pending',lastResultAt:c.override?c.override.at:Math.max(0,...c.history.map(function(r){return Number(r.scannedAt)||0}))||null}});
 var times=result.rows.map(function(r){return r.lastResultAt||0});result.updatedAt=Math.max(0,...times)||null;result.rows.forEach(function(r){var key=r.status==='partial-absence'?'partialAbsence':r.status;result.summary[key]++});if(cache)try{cache.put(cacheKey,JSON.stringify(result),2)}catch(ignore){}return result;
}
function monitorRequest_(p){
 if(p.audience==='teachers'&&p.action!=='teachersLive')throw new Error('رابط المعلمين للمشاهدة فقط');
 if(p.action==='teachersLive')return monitorTeachersLive_(p);
 if(monitorIsTrial_(p)||monitorIsTrial_(p.record))throw new Error('لا يجوز إرسال بيانات التجربة إلى السجل الرسمي');
 var props=PropertiesService.getScriptProperties(),writeKey=props.getProperty('MONITOR_API_KEY'),readKey=props.getProperty('MONITOR_READER_KEY'),sitePassword=props.getProperty('MONITOR_SITE_PASSWORD');
 var writer=String(writeKey||'').length>=32&&monitorEqual_(p.key,writeKey),reader=String(readKey||'').length>=32&&monitorEqual_(p.key,readKey);
 var siteReader=!!sitePassword&&monitorEqual_(p.key,sitePassword);
 var publicRead=props.getProperty('MONITOR_PUBLIC_READ')==='true';
 if(!writer&&!reader&&!siteReader)throw new Error('غير مصرح بالدخول');
 var administrative=['override','resetReport','purgeDay','reportSchedule'].indexOf(p.action)>=0;
 if(administrative){var supplied=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(p.adminPin||''),Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2)}).join('');var expected=props.getProperty('MONITOR_ADMIN_PIN_HASH')||'0e3dc69daef679ae76ca56039591a2002c71041a945a57db4460ee22db2259e5';if(!monitorEqual_(supplied,expected))throw new Error('الرقم السري للإدارة غير صحيح')}
 var reading=['dates','day','teacherLink'].indexOf(p.action)>=0;if(!reading&&!writer&&!administrative)throw new Error('صلاحية القراءة لا تسمح بالرفع');
 var root=monitorPrivate_(DriveApp.getFolderById(MONITOR_ROOT));
 if(p.action==='teacherLink'){var token=monitorTeacherToken_(props);return {url:'https://mirsad-school.onrender.com/teachers-live.html'+(token?'?view='+encodeURIComponent(token):'')}}
 if(p.action==='dates'){var dates=[],it=root.getFolders();while(it.hasNext()){var f=it.next(),m=/^توثيق غياب (\d{4}-\d{2}-\d{2})$/.exec(f.getName());if(m&&monitorFile_(f,'attendance.json'))dates.push(m[1])}return {dates:dates.sort().reverse(),authMode:siteReader?'site-password':'access-key'}}
 if(administrative&&(typeof p.requestId!=='string'||!/^[A-Za-z0-9_-]{8,120}$/.test(p.requestId)))throw new Error('معرّف العملية غير صالح');
 if(p.action==='purgeDay'){
  if(typeof p.date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(p.date))throw new Error('حدد تاريخ اليوم المطلوب حذفه');
  var markerKey='MONITOR_PURGED_DAY_'+p.date,previous=props.getProperty(markerKey),marker=previous?JSON.parse(previous):null;
  if(marker&&marker.requestId===p.requestId)return {deleted:true,date:p.date};
  var matches=root.getFoldersByName('توثيق غياب '+p.date);
  while(matches.hasNext()){
   var doomed=matches.next();if(doomed.getId()===root.getId())throw new Error('تعذر تحديد مجلد اليوم بأمان');
   var response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/files/'+encodeURIComponent(doomed.getId()),{method:'delete',headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
   var code=response.getResponseCode();if(code!==204&&code!==404)throw new Error('تعذر حذف مجلد اليوم نهائيًا؛ شغّل authorizeMonitoringMaintenance بحساب المالك لمنح الصلاحيات ثم أعد المحاولة');
  }
  props.setProperty(markerKey,JSON.stringify({at:Date.now(),requestId:p.requestId}));
  return {deleted:true,date:p.date};
 }
 if(['record','image'].includes(p.action)){
  var purged=props.getProperty('MONITOR_PURGED_DAY_'+(p.date||monitorToday_()));
  if(purged&&(!Number.isFinite(Number(p.record?.scannedAt))||Number(p.record.scannedAt)<=JSON.parse(purged).at))return {discarded:true,reason:'أُلغي هذا الفحص عند تصفير اليوم'};
 }
 var date=p.date||monitorToday_();if(p.action==='startDay'&&date!==monitorToday_())throw new Error('بداية اليوم تكون لتاريخ اليوم في السعودية فقط');var folder=monitorDay_(root,date,p.action==='startDay');
 var file=monitorFile_(folder,'attendance.json'),data=monitorRead_(file,null);
 if(p.action==='startDay'){
  if(date!==monitorToday_())throw new Error('بداية اليوم تكون لتاريخ اليوم في السعودية فقط');
  if(!data){data={snapshot:monitorSnapshot_(root,p,date),records:[],evidence:{}};monitorWrite_(folder,'attendance.json',data)}
  if(monitorMergeMissingLessons_(data,p.items,'extension'))monitorWrite_(folder,'attendance.json',data);
  var actual=monitorSchedule_(p.scheduleSettings);if(actual){data.snapshot.scheduleSettings=actual;monitorWrite_(folder,'attendance.json',data)}
  return {snapshot:data.snapshot,folderUrl:folder.getUrl()};
 }
 if(!data)throw new Error('جدول اليوم غير محفوظ');
 if(administrative){
  if(typeof p.requestId!=='string'||!/^[A-Za-z0-9_-]{8,120}$/.test(p.requestId))throw new Error('معرّف العملية غير صالح');
  data.adjustments=data.adjustments||[];
  if(data.adjustments.some(function(a){return a.id===p.requestId}))return {saved:true};
  var entry={id:p.requestId,sequence:data.adjustments.length+1,at:Date.now(),type:p.action==='resetReport'?'reset':p.action};
  if(p.action==='override'){
   var selected=data.snapshot.lessons.find(function(l){return l.teacherId===p.teacherId&&l.period===Number(p.period)});
   if(!selected||!['present','absent','unresolved'].includes(p.status))throw new Error('اختر حصة وحالة صحيحتين');
   entry.teacherId=selected.teacherId;entry.period=selected.period;entry.status=p.status;entry.note=String(p.note||'').slice(0,1000);
  }
  if(p.action==='reportSchedule'){
   var schedule=p.schedule||{},start=/^(\d{2}):(\d{2})$/.exec(schedule.manualStart||''),duration=Number(schedule.periodDuration),gap=Number(schedule.manualGapMinutes);
   if(!start||Number(start[1])>23||Number(start[2])>59||!Number.isInteger(duration)||duration<1||duration>180||!Number.isInteger(gap)||gap<0||gap>60)throw new Error('توقيت الحصص غير صالح');
   entry.schedule={manualStart:schedule.manualStart,periodDuration:duration,manualGapMinutes:gap};data.reportSchedule=entry.schedule;
  }
  data.adjustments.push(entry);monitorWrite_(folder,'attendance.json',data);return {saved:true,adjustment:entry};
 }
 if(['record','image'].includes(p.action)&&purged&&Number(p.record?.scannedAt)<Math.max(JSON.parse(purged).at,Number(data.snapshot.createdAt)||0))return {discarded:true,reason:'هذا الفحص يخص التجربة المحذوفة'};
 if(['record','image'].includes(p.action)&&p.scheduleSettings){data.snapshot.scheduleSettings=monitorSchedule_(p.scheduleSettings)}
 if(p.action==='day'){var result=JSON.parse(JSON.stringify(data));Object.keys(result.evidence||{}).forEach(function(id){var image=result.evidence[id];if(image.record&&!result.records.some(function(r){return r.scanId===id}))result.records.push(image.record)});result.records.forEach(function(r){r.evidenceUrl=result.evidence[r.scanId]?.url||null});delete result.evidence;return result}
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
  image.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);
  var evidence={fileId:image.getId(),url:image.getUrl(),name:name,record:{scanId:record.scanId,teacherId:lesson.teacherId,teacherName:lesson.teacherName,observedTeacher:String(record.teacher||''),period:record.period,cycle:record.cycle,status:record.status,detail:String(record.detail||'').slice(0,3000),scannedAt:Number(record.scannedAt)||Date.now()}};data.evidence[record.scanId]=evidence;monitorWrite_(folder,'attendance.json',data);return evidence;
 }
 if(p.action==='record'){
  if(!data.records.some(function(r){return r.scanId===record.scanId}))data.records.push({scanId:record.scanId,teacherId:lesson.teacherId,teacherName:lesson.teacherName,observedTeacher:String(record.teacher||''),period:record.period,cycle:record.cycle,status:record.status,detail:String(record.detail||'').slice(0,3000),scannedAt:Number(record.scannedAt)||Date.now()});
  monitorWrite_(folder,'attendance.json',data);return {saved:true};
 }
 throw new Error('طلب غير مدعوم');
}
function doPost(e){var result,lock=LockService.getScriptLock();try{var p=JSON.parse(e.postData.contents);if(p.action!=='teachersLive')lock.waitLock(30000);result={ok:true,...monitorRequest_(p)}}catch(error){result={ok:false,error:String(error.message||error)}}finally{if(lock.hasLock())lock.releaseLock()}return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON)}

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

// Owner-run privacy migration: revoke public archive/image links before enabling the redacted teacher feed.
function secureMonitoringEvidence(){
 var props=PropertiesService.getScriptProperties(),root=DriveApp.getFolderById(props.getProperty('MONITOR_PRIVATE_ROOT_ID')||MONITOR_ROOT),stack=[root],count=0;
 while(stack.length){var folder=stack.pop();folder.setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);var files=folder.getFiles();while(files.hasNext()){files.next().setSharing(DriveApp.Access.PRIVATE,DriveApp.Permission.NONE);count++}var children=folder.getFolders();while(children.hasNext())stack.push(children.next())}
 props.setProperty('MONITOR_EVIDENCE_PRIVATE','true');props.setProperty('MONITOR_PUBLIC_READ','true');console.log('الصور والأرشيف مقيدان؛ صفحة المعلمين تعرض الحالات الرسمية فقط. الملفات المؤمنة '+count);return root.getUrl();
}
function enablePublicMonitoringSharing(){return secureMonitoringEvidence()}

// Owner runs this read-only check once to grant the permanent-delete service scopes.
function authorizeMonitoringMaintenance(){
 var folder=DriveApp.getFolderById(MONITOR_ROOT);
 var response=UrlFetchApp.fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName)',{headers:{Authorization:'Bearer '+ScriptApp.getOAuthToken()},muteHttpExceptions:true});
 if(response.getResponseCode()!==200)throw new Error('تعذر تفعيل صلاحية إدارة مجلد التوثيق');
 console.log('صلاحية إدارة مجلد التوثيق جاهزة: '+folder.getName());
}

// BEGIN SHARED TEACHER MODEL — generated from monitor-model.js; keep in sync.
var MONITOR_TEACHER_MODEL_=(function(){var module={exports:{}};
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
  const audit=data.adjustments||[],reset=[...audit].reverse().find(a=>a.type==='reset'),cutoff=reset?.at||0;
  return data.snapshot.lessons.map(lesson=>{
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

return module.exports})();
// END SHARED TEACHER MODEL
