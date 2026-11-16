const fs=require('node:fs'),path=require('node:path');
const babel=require(path.join(path.dirname(require.resolve('playwright')),'lib/transform/babelBundle.js'));
const dir=process.argv[2],file=path.join(dir,'drive-sync.js');
function tagRecords(source,filename){return babel.babelTransform(source,filename,false,[[path.resolve(__dirname,'tag-records-plugin.cjs'),{}]],[]).code}
let code=babel.babelTransform(fs.readFileSync(file,'utf8'),file,false,[[path.resolve(__dirname,'../chrome-store/readable-plugin.cjs'),{}]],[]).code;
function replace(pattern,value){if(!pattern.test(code))throw Error('Stable runtime changed; review school-scope patch: '+pattern);code=code.replace(pattern,value)}
replace(/("writerKey": _value133,\n)/,'$1        "workspaceId": _argument62.localSchoolId || (await MirsadMulti.context())?.site?.localId,\n        "siteId": _argument62.siteId || _value132.snapshot?.siteId || (await MirsadMulti.context())?.legacySiteId,\n');
replace(/"scheduleSettings": _value22\(\),\n        "queuedAt"/,'"scheduleSettings": _argument62.multiScheduleSettings || _value22(),\n        "queuedAt"');
replace(/async function _value130\(_argument61, _argument62, _argument63\) \{/,'async function _value130(_argument61, _argument62, _argument63) {if(_argument62.accountId&&_argument62.accountId!==(await MirsadMulti.context())?.account)throw Error("تغير حساب الرصد؛ بقيت النتيجة في أرشيفها المحلي");');
replace(/("record": _value150.record,\n)/,'$1          "workspaceId": _value150.workspaceId,\n          "siteId": _value150.siteId || (await MirsadMulti.context())?.legacySiteId,\n');
replace(/const _value149 = _value147.filter\(/,'const _mirsadAllowed=[];for(const job of _value147)if(await MirsadMulti.jobAllowed(job))_mirsadAllowed.push(job);\n    const _value149 = _mirsadAllowed.filter(');
// Count only jobs belonging to the selected school, even while paused.
replace(/async function _value121\(\) \{/,'async function _value121() {\n    const _mirsadJobs=[];for(const job of await _value1())if(await MirsadMulti.jobInSite(job))_mirsadJobs.push(job);');
replace(/new Set\(\(await _value1\(\)\)\.filter\(_argument55/,'new Set(_mirsadJobs.filter(_argument55');
// A busy read is transient, not evidence that the installed protection API is outdated.
const protectionStart=code.indexOf('  async function _value31() {'),protectionEnd=code.indexOf('  async function _value34(',protectionStart);
if(protectionStart<0||protectionEnd<0)throw Error('Stable protection reader changed');
code=code.slice(0,protectionStart)+`  async function _value31() {
 const writer=(await chrome.storage.local.get(_text))[_text]?.key;
 let value;try{value=await MirsadProtectionRead(()=>_value11("protectedDayState",{},writer),message=>_value10(message))}catch(error){throw new Error("تعذر التحقق من حماية الجدول؛ لم يتغير الجدول. "+String(error?.message||error))}
 if(value.protection!=="explicit-reset-only-v1")throw new Error("الخدمة لا تؤكد حماية الجدول؛ لم يتغير الجدول. راجع إصدار خدمة قوقل.");
 return value;
 }
`+code.slice(protectionEnd);
code=tagRecords(code,file);new(require('node:vm').Script)(code);fs.writeFileSync(file,code);
const background=path.join(dir,'background.js');let worker=babel.babelTransform(fs.readFileSync(background,'utf8'),background,false,[[path.resolve(__dirname,'../chrome-store/readable-plugin.cjs'),{}]],[]).code;
worker=tagRecords(worker,background);const append=/async function appendDailyReport\((\w+)\) \{/;if(!append.test(worker))throw Error('Stable daily report writer changed');worker=worker.replace(append,'async function appendDailyReport($1) {if(await MirsadMulti.appendLateDaily($1))return;');fs.writeFileSync(background,worker);
const backup=path.join(dir,'local-backup.js');let text=fs.readFileSync(backup,'utf8');const pattern=/ async function school\(\)\{[^\n]+\}/;
if(!pattern.test(text))throw Error('Stable native backup scope changed');
text=text.replace(pattern," async function school(){const id=await MirsadMulti.localId();if(!/^[a-f0-9-]{36}$/.test(id))throw Error('حمّل جدول المدرسة لتحديد مجلدها المحلي');return id}");fs.writeFileSync(backup,text);
text=text.replace('const id=await school(),date=MirsadMonitorModel.day(new Date(record.scannedAt||Date.now()))','const id=record.localSchoolId||await school(),date=MirsadMonitorModel.day(new Date(record.scannedAt||Date.now()))');fs.writeFileSync(backup,text);
console.log('Scoped cloud jobs and local snapshot folders to each school');

const video=path.join(dir,'video/controller.js');let media=fs.readFileSync(video,'utf8');
const scope="new TextEncoder().encode(c.url+'|'+c.key)";if(!media.includes(scope))throw Error('Stable video scope changed');
media=media.replace(scope,"new TextEncoder().encode(c.url+'|'+c.key+await MirsadMulti.mediaScopeSuffix())");
const exported='return {beforeScan,poll,completed};';if(!media.includes(exported))throw Error('Stable video interface changed');
media=media.replace(exported,"return {beforeScan,poll,completed,beforeSchoolSwitch:async()=>{uploadAbort?.abort();await finishMeeting('تغيير مدرسة الرصد')},afterSchoolSwitch:async()=>{await patch({scope:await scope(),tail:null,resume:null,active:null})}};");
media=media.replace("filename:'Mirsad-Videos/'+clip.job.date", "filename:'Mirsad-Videos/'+await MirsadMulti.videoSite(clip.job)+'/'+clip.job.date");
media=media.replace("api('videoUploadBegin',{date:job.date","api('videoUploadBegin',{siteId:await MirsadMulti.videoSite(job),date:job.date").replace("api('videoUploadFinish',{date:job.date","api('videoUploadFinish',{siteId:await MirsadMulti.videoSite(job),date:job.date");
new(require('node:vm').Script)(media);fs.writeFileSync(video,media);
const disk=path.join(dir,'video/disk.js');let diskCode=fs.readFileSync(disk,'utf8');
const diskScope="new TextEncoder().encode((config.url||'')+'|'+(config.key||''))";if(!diskCode.includes(diskScope))throw Error('Stable disk scope changed');
diskCode=diskCode.replace(diskScope,"new TextEncoder().encode((config.url||'')+'|'+(config.key||'')+await MirsadMulti.mediaScopeSuffix())");
const schoolId=/const id=\/\^w[\s\S]*?if\(!id\)throw Error\('حساب المدرسة غير مرتبط'\);return \{school:id\}/;
if(!schoolId.test(diskCode))throw Error('Stable disk identity changed');diskCode=diskCode.replace(schoolId,"const id=await MirsadMulti.localId();if(!id)throw Error('حساب المدرسة غير مرتبط');return {school:id}");
new(require('node:vm').Script)(diskCode);fs.writeFileSync(disk,diskCode);
console.log('Scoped video clips, local folders and fallback downloads per school; preserved legacy media scope');
