const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const date='2026-11-09',sourceDate='2026-10-18',calendar='https://teams.microsoft.com/meet/calendar',primary='https://teams.microsoft.com/meet/primary';
const clone=value=>value===undefined?undefined:structuredClone(value);
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}}
function fixture(edition){
 const config={url:'https://service-A.invalid/exec',key:'A'.repeat(40)},otherConfig={url:'https://service-B.invalid/exec',key:'B'.repeat(40)},snapshot={date,sourceType:'madrasati',sourceScheduleDate:sourceDate,scheduleRevision:'revision-A',teachers:[{id:'teacher',name:'معلم أول'}],lessons:[{teacherId:'teacher',teacherName:'معلم أول',period:1,subject:'علوم من مدرستي',className:'الأول أ',url:primary}]};
 const state={mirsadDriveConfig:clone(config),mirsadDriveDay:{date,snapshot:clone(snapshot)},mirsadMadrasatiSelectedDate:sourceDate,mirsadMadrasatiLastSuccess:{date:sourceDate,importedForDate:date,monitoringPrepared:true,revision:snapshot.scheduleRevision}},calls=[],cacheWrites=[],backupSnapshots=[];
 let onRequest=null,onIdentity=null,identityCalls=0;
 const saved={...clone(snapshot),lessons:snapshot.lessons.map(lesson=>({...lesson,calendarUrl:calendar}))};
 const context=vm.createContext({Date,URL,AbortSignal,setTimeout,clearTimeout,console,getRun:async()=>null,MirsadMonitorModel:{day:()=>date,normalize:value=>String(value||''),isExcludedPeriod:()=>false},MirsadCommercialAccount:{identity:async()=>{identityCalls++;if(onIdentity)await onIdentity(identityCalls);return {}},remember:async()=>{},denied:async()=>{}},LocalBackup:{snapshot:async value=>backupSnapshots.push(clone(value))},
  fetch:async(url,options)=>{const body=JSON.parse(options.body);calls.push({url,body,signal:options.signal});if(onRequest)await onRequest(body.action,options);return {ok:true,json:async()=>body.action==='protectedDayState'?{ok:true,protection:'explicit-reset-only-v1',exists:true,snapshot:clone(snapshot)}:{ok:true,saved:true,added:1,snapshot:clone(saved)}}},
  chrome:{storage:{local:{get:async keys=>Object.fromEntries((Array.isArray(keys)?keys:[keys]).map(key=>[key,clone(state[key])])),set:async value=>{if(value.mirsadDriveDay)cacheWrites.push(clone(value.mirsadDriveDay));Object.assign(state,clone(value))}}},tabs:{query:async()=>[]},alarms:{create(){},onAlarm:{addListener(){}}}}});
 vm.runInContext(fs.readFileSync(path.join(__dirname,'..',edition==='schools'?'schools/extension':'teams-probe','drive-sync.js'),'utf8'),context);
 return {api:context.CloudMonitoring,state,calls,cacheWrites,backupSnapshots,config,otherConfig,snapshot,saved,set onRequest(value){onRequest=value},set onIdentity(value){onIdentity=value},save(signal){return context.CloudMonitoring.addCalendarLinks([{teacherName:'معلم أول',period:1,url:calendar}],{date,sourceDate,expectedRevision:snapshot.scheduleRevision,signal})}};
}
for(const edition of ['private','schools']){
 test(edition+': optional Calendar save leaves scan-start lock clear and still serializes Calendar saves',async()=>{
  const f=fixture(edition),started=deferred(),release=deferred();f.onRequest=async action=>{if(action==='addCalendarLinks'){started.resolve();await release.promise}};
  const pending=f.save();await started.promise;assert.equal(f.api.linksBusy(),false);await assert.rejects(f.save(),/حفظ الروابط/);release.resolve();const result=await pending;
  assert.equal(result.added,1);assert.equal(f.cacheWrites.length,1);assert.equal(f.state.mirsadDriveDay.snapshot.lessons[0].calendarUrl,calendar);assert.equal(f.state.mirsadDriveDay.snapshot.lessons[0].subject,'علوم من مدرستي');assert.equal(f.api.linksBusy(),false);
 });
 test(edition+': changing services during protected-state read prevents the Calendar write',async()=>{
  const f=fixture(edition),before=clone(f.state.mirsadDriveDay);f.onRequest=async action=>{if(action==='protectedDayState')f.state.mirsadDriveConfig=clone(f.otherConfig)};
  await assert.rejects(f.save(),error=>error.cancelled===true);assert.deepEqual(f.calls.map(call=>call.body.action),['protectedDayState']);assert.deepEqual(f.state.mirsadDriveDay,before);assert.equal(f.cacheWrites.length,0);
 });
 test(edition+': changing services while Calendar save is in flight cannot cache the old-school response',async()=>{
  const f=fixture(edition),before=clone(f.state.mirsadDriveDay);f.onRequest=async action=>{if(action==='addCalendarLinks')f.state.mirsadDriveConfig=clone(f.otherConfig)};
  await assert.rejects(f.save(),error=>error.cancelled===true);assert.equal(f.calls.length,2);assert.ok(f.calls.every(call=>call.url===f.config.url&&call.body.key===f.config.key));assert.equal(f.cacheWrites.length,0);assert.deepEqual(f.state.mirsadDriveDay,before);assert.ok(f.backupSnapshots.every(value=>!value.snapshot.lessons[0].calendarUrl));
 });
 test(edition+': cancelling protected-state read prevents saving, even if the transport returns a late response',async()=>{
  const f=fixture(edition),controller=new AbortController();f.onRequest=async action=>{if(action==='protectedDayState')controller.abort(Object.assign(Error('scan priority'),{cancelled:true}))};
  await assert.rejects(f.save(controller.signal),/scan priority/);assert.equal(f.calls.length,1);assert.equal(f.calls[0].signal.aborted,true);assert.equal(f.cacheWrites.length,0);
 });
 test(edition+': cancelling an in-flight save ignores late results and releases the Calendar lock',async()=>{
  const f=fixture(edition),controller=new AbortController();f.onRequest=async action=>{if(action==='addCalendarLinks')controller.abort(Object.assign(Error('scan priority'),{cancelled:true}))};
  await assert.rejects(f.save(controller.signal),/scan priority/);assert.equal(f.cacheWrites.length,0);assert.equal(f.calls.at(-1).signal.aborted,true);f.onRequest=null;assert.equal((await f.save()).added,1);
 });
 test(edition+': explicit lesson edits retain the existing scan-start lock',async()=>{
  const f=fixture(edition),started=deferred(),release=deferred();f.onRequest=async action=>{if(action==='manualLessonLink'){started.resolve();await release.promise}};
  const pending=f.api.manualLessonLink({date,teacherId:'teacher',period:1,url:primary,expectedUrl:primary,expectedRevision:'revision-A'});await started.promise;assert.equal(f.api.linksBusy(),true);await assert.rejects(f.save(),/حفظ الروابط/);release.resolve();await pending;assert.equal(f.api.linksBusy(),false);
 });
}
test('schools: switching service while device identity is loading prevents a write with the replacement key',async()=>{
 const f=fixture('schools');f.onIdentity=async call=>{if(call===2)f.state.mirsadDriveConfig=clone(f.otherConfig)};await assert.rejects(f.save(),error=>error.cancelled===true);assert.deepEqual(f.calls.map(call=>call.body.action),['protectedDayState']);assert.equal(f.cacheWrites.length,0);
});
