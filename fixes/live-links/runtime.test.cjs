const test=require('node:test'),assert=require('assert/strict'),path=require('path');
const fixture=require('../../tests/extension-runtime-fixture.cjs');
for(const consumed of [false,true])for(const kind of ['Teams','Schools'])test(kind+(consumed?' with consumed no-link entry':'')+': manual reload adds missing link and actual navigation opens it after existing teacher',async()=>{
 const f=fixture({edition:kind==='Schools'?'schools':'private',extensionPath:path.relative(path.resolve('tests'),'/tmp/stable-link-'+kind)});
 await f.launch();f.ctx.MirsadLiveSender.sync=async()=>{};f.ctx.CloudMonitoring.assertSelected=async()=>{};f.ctx.MirsadCommercialAccount.identity=async()=>({});f.ctx.LocalBackup.snapshot=async()=>{};
 const run=f.store.mirsadAutoRun;run.scheduleRevision='rev';const date=f.invoke('MirsadMonitorModel.day()');
 const late={teacherId:'late',teacherName:'معلم وصل رابطه أثناء اليوم',period:7,url:'https://teams.microsoft.com/meet/late123'};
 const snapshot={date,scheduleRevision:'rev',sourceType:'madrasati',sourceScheduleDate:date,lessons:[...run.schedule.map(l=>({...l,teacherName:l.teacher})),late]};
 f.store.mirsadDriveConfig={url:'https://fixture.invalid',key:'w'.repeat(40)};
 f.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,exists:true,protection:'explicit-reset-only-v1',snapshot,merged:true,filled:1,completed:[late]})});
 if(consumed){run.periodItems.unshift({teacher:late.teacherName,period:7,url:''});run.index=1;run.results.push({teacher:late.teacherName,period:7,cycle:1,status:'no-link',url:''})}
 const stale=structuredClone(run);
 // The same public API used by MadrasatiSource.collect's direct/manual reload.
 f.ctx.payload={scheduleDate:date};await f.invoke('CloudMonitoring.fillMissingLinks(payload)');
 assert.equal(f.store.mirsadAutoRun.schedule.length,2);assert.equal(f.store.mirsadAutoRun.periodItems.length,consumed?3:2);
 // An in-flight scan completing with its earlier copy cannot erase the new link.
 stale.index+=1;stale.current=null;stale.results.push({teacher:stale.schedule[0].teacher,period:7,cycle:1,status:'present'});f.ctx.stale=stale;
 await f.invoke('saveRun(stale)');assert.equal(f.store.mirsadAutoRun.periodItems.length,consumed?3:2);
 await f.invoke('(async()=>{const r=await getRun();await navigateCurrent(r)})()');
 assert.equal(f.store.mirsadAutoRun.current.url,late.url);assert.equal(f.store.mirsadAutoRun.current.teacher,late.teacherName);
 assert.equal(f.store.mirsadAutoRun.results.length,consumed?2:1);
});
for(const kind of ['Teams','Schools'])test(kind+': saving an individual link after a previous reload supersedes the old cached URL',async()=>{
 const f=fixture({edition:kind==='Schools'?'schools':'private',extensionPath:path.relative(path.resolve('tests'),'/tmp/stable-link-'+kind)});
 await f.launch();f.ctx.MirsadLiveSender.sync=async()=>{};f.ctx.MirsadCommercialAccount.identity=async()=>({});f.ctx.LocalBackup.snapshot=async()=>{};
 const date=f.invoke('MirsadMonitorModel.day()');f.store.mirsadAutoRun.scheduleRevision='rev';
 const name=f.store.mirsadAutoRun.schedule[0].teacher;
 let snapshot={date,scheduleRevision:'rev',sourceType:'madrasati',sourceScheduleDate:date,lessons:[{teacherId:'a',teacherName:name,period:7,url:'https://teams.microsoft.com/meet/old'}]};
 f.ctx.CloudMonitoring.assertSelected=async()=>({date,snapshot});
 f.store.mirsadDriveConfig={url:'https://fixture.invalid',key:'w'.repeat(40)};
 f.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,saved:true,exists:true,protection:'explicit-reset-only-v1',snapshot})});
 await f.invoke('CloudMonitoring.pullRemoteLinks()');f.store.mirsadMadrasatiSelectedDate=date;f.store.mirsadMadrasatiLastSuccess={monitoringPrepared:true,importedForDate:date,date,revision:'rev'};f.store.mirsadLoadIntent={date,status:'verified'};await f.invoke('pauseMonitoring()');
 snapshot=structuredClone(snapshot);snapshot.lessons[0].url='https://teams.microsoft.com/meet/manual-new';
 f.ctx.manual={date,teacherId:'a',period:7,url:snapshot.lessons[0].url,expectedRevision:'rev'};
 await f.invoke('CloudMonitoring.manualLessonLink(manual)');
 assert.equal(f.store.mirsadAutoRun.schedule[0].url,snapshot.lessons[0].url);
 assert.equal(f.store.mirsadAutoRun.periodItems[0].url,snapshot.lessons[0].url);
 await f.invoke('resumeMonitoring()');
 if(kind==='Schools')await f.nextAlarm();
 assert.equal(f.store.mirsadAutoRun.current.url,snapshot.lessons[0].url);
});
