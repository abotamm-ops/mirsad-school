const test=require('node:test'),assert=require('assert/strict'),path=require('path');
const fixture=require('../../tests/extension-runtime-fixture.cjs');
for(const outcome of ['present','absent'])for(const consumed of [false,true])for(const kind of ['Teams','Schools'])test(kind+' '+outcome+(consumed?' with consumed no-link entry':'')+': manual reload adds missing link and actual navigation opens it after existing teacher',async()=>{
 const f=fixture({edition:kind==='Schools'?'schools':'private',extensionPath:path.relative(path.resolve('tests'),(kind==='Schools'&&process.env.MIRSAD_SCHOOLS_FIX_DIR?process.env.MIRSAD_SCHOOLS_FIX_DIR:(kind==='Teams'&&process.env.MIRSAD_TEAMS_FIX_DIR?process.env.MIRSAD_TEAMS_FIX_DIR:'/tmp/stable-link-'+kind)))});
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
 await verifyResultRecorded(f,outcome);
});
for(const outcome of ['present','absent'])for(const kind of ['Teams','Schools'])test(kind+' '+outcome+': saving an individual link after a previous reload supersedes the old cached URL',async()=>{
 const f=fixture({edition:kind==='Schools'?'schools':'private',extensionPath:path.relative(path.resolve('tests'),(kind==='Schools'&&process.env.MIRSAD_SCHOOLS_FIX_DIR?process.env.MIRSAD_SCHOOLS_FIX_DIR:(kind==='Teams'&&process.env.MIRSAD_TEAMS_FIX_DIR?process.env.MIRSAD_TEAMS_FIX_DIR:'/tmp/stable-link-'+kind)))});
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
 await verifyResultRecorded(f,outcome);
});
for(const outcome of ['present','absent'])for(const kind of ['Teams','Schools'])test(kind+' '+outcome+': automatic gap merge admits its links into the next cycle without changing the wait',async()=>{
 const f=fixture({edition:kind==='Schools'?'schools':'private',extensionPath:path.relative(path.resolve('tests'),(kind==='Schools'&&process.env.MIRSAD_SCHOOLS_FIX_DIR?process.env.MIRSAD_SCHOOLS_FIX_DIR:(kind==='Teams'&&process.env.MIRSAD_TEAMS_FIX_DIR?process.env.MIRSAD_TEAMS_FIX_DIR:'/tmp/stable-link-'+kind)))});
 await f.launch();f.ctx.MirsadLiveSender.sync=async()=>{};f.ctx.MirsadCommercialAccount.identity=async()=>({});f.ctx.LocalBackup.snapshot=async()=>{};f.ctx.TextEncoder=TextEncoder;
 f.ctx.chrome.storage.local.remove=async key=>delete f.store[key];
 const run=f.store.mirsadAutoRun,date=f.invoke('MirsadMonitorModel.day()'),now=f.invoke('Date.now()');
 Object.assign(run,{scheduleRevision:'rev',current:null,waitingForCycle2:true,nextCycleAt:now+60000});
 const late={teacherId:'late',teacherName:'أسامة',period:7,url:'https://teams.microsoft.com/meet/new-gap'};
 const snapshot={date,scheduleRevision:'rev',sourceType:'madrasati',sourceScheduleDate:date,lessons:[...run.schedule.map(l=>({...l,teacherName:l.teacher})),late]};
 f.store.mirsadDriveConfig={url:'https://fixture.invalid',key:'w'.repeat(40)};
 f.store.mirsadDriveDay={date,snapshot:{...snapshot,lessons:snapshot.lessons.map(l=>l.teacherId==='late'?{...l,url:''}:l)}};
 f.ctx.fetch=async()=>({ok:true,json:async()=>({ok:true,exists:true,protection:'explicit-reset-only-v1',snapshot,merged:true,filled:1,completed:[late]})});
 f.store.mirsadMadrasatiSelectedDate=date;f.store.mirsadMadrasatiLastSuccess={monitoringPrepared:true,importedForDate:date,date,revision:'rev'};f.store.mirsadLoadIntent={date,status:'verified'};
 const scope=await f.ctx.MirsadAutoLinks.remoteScope();
 f.store.mirsadAutoLinksEnabled=true;f.store.mirsadAutoLinksRemote={scope,revision:1,enabled:true,mode:'missing',seenAt:now};
 f.store.mirsadAutoLinksStaged={date,revision:'rev',scope,payload:{scheduleDate:date},mode:'missing',startPeriod:7};
 await f.ctx.MirsadAutoLinks.beforeCycle(run);
 assert.equal(f.store.mirsadAutoRun.schedule.find(l=>l.teacher===late.teacherName)?.url,late.url);
 assert.equal(f.store.mirsadAutoRun.nextCycleAt,now+60000);
 assert.equal(f.store.mirsadAutoRun.waitingForCycle2,true);
 f.ctx.nextCycle=structuredClone(f.store.mirsadAutoRun);
 await f.invoke('nextCycle.periodItems=scheduleCore.selectPeriodItems(nextCycle.schedule,7);nextCycle.index=1;nextCycle.waitingForCycle2=false;nextCycle.cycle=2;navigateCurrent(nextCycle)');
 assert.equal(f.store.mirsadAutoRun.current.url,late.url);
 await verifyResultRecorded(f,outcome);
});

async function verifyResultRecorded(f,status){
 const current=structuredClone(f.store.mirsadAutoRun.current),cycle=f.store.mirsadAutoRun.cycle,period=f.store.mirsadAutoRun.period;
 if(status==='absent')f.store.mirsadEvidenceRecords=[...(f.store.mirsadEvidenceRecords||[]),{scanId:current.scanId,teacher:current.teacher,period,status:'absent',evidenceVerified:true}];
 f.ctx.updatedScanResult={scanId:current.scanId,result:{status,teacher:current.teacher,evidenceTeacher:current.teacher,detail:'fixture verified '+status}};
 await f.invoke('receiveResult(updatedScanResult)');
 const sent=f.cloud.find(event=>event.record?.scanId===current.scanId)?.record;
 assert.ok(sent,'updated-link scan result must be submitted to cloud recording');
 assert.equal(sent.status,status);assert.equal(sent.url,current.url);assert.equal(sent.scheduledTeacher,current.teacher);assert.equal(sent.period,period);assert.equal(sent.cycle,cycle);
 assert.ok(f.local.some(event=>event.record.scanId===current.scanId),'local backup must receive updated-link result');
 assert.ok(f.store.mirsadAutoRun.results.some(record=>record.scanId===current.scanId&&record.status===status),'run must retain updated-link result');
}
