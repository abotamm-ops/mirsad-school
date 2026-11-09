const test=require('node:test'),assert=require('node:assert/strict'),fixture=require('./extension-runtime-fixture.cjs');
const primary='https://teams.microsoft.com/l/meetup-join/test',calendar='https://teams.microsoft.com/meet/calendar';
const make=edition=>fixture({edition,lesson:{calendarUrl:calendar}});
async function send(f,status){
 const current=f.store.mirsadAutoRun.current;
 if(status==='absent')f.store.mirsadEvidenceRecords=[...(f.store.mirsadEvidenceRecords||[]),{scanId:current.scanId,period:7,status:'absent',teacher:current.teacher,evidenceVerified:true}];
 await f.invoke(`receiveResult({scanId:${JSON.stringify(current.scanId)},result:{status:${JSON.stringify(status)},detail:${JSON.stringify(status+' '+current.meetingSource)}}})`);
 return current.scanId;
}
async function terminal(f,status){const source=f.store.mirsadAutoRun.current.meetingSource;do{await send(f,status)}while(status==='unresolved'&&f.store.mirsadAutoRun.current?.meetingSource===source)}
for(const edition of ['teams','schools']){
 for(const a of ['present','absent','unresolved'])for(const b of ['present','absent','unresolved'])test(`${edition}: both meetings ${a}/${b} produce one cycle result`,async()=>{
  const f=make(edition);await f.launch();await terminal(f,a);
  assert.equal(f.store.mirsadAutoRun.index,0);assert.equal(f.store.mirsadAutoRun.results.length,0);assert.equal(f.cloud.filter(value=>value.record).length,0);
  assert.equal(f.store.mirsadAutoRun.current.meetingSource,'calendar');assert.equal(f.store.mirsadAutoRun.current.retryCount,0);
  await terminal(f,b);const run=f.store.mirsadAutoRun,record=run.results[0],expected=[a,b].includes('present')?'present':[a,b].includes('absent')?'absent':'unresolved';
  assert.equal(run.results.length,1);assert.equal(run.index,1);assert.equal(record.scanStatus,expected);assert.equal(record.url,primary);assert.equal(record.linkResults.length,2);
  assert.deepEqual(Array.from(record.linkResults,result=>result.status),[a,b]);assert.equal(f.cloud.filter(value=>value.record).length,1);
  if(expected==='absent')assert.equal(record.evidenceScanId,record.linkResults.find(result=>result.status==='absent').scanId);
 });
 test(`${edition}: retry budget belongs to each link and stale primary replies cannot skip calendar`,async()=>{
  const f=make(edition),first=await f.launch();await send(f,'unresolved');await send(f,'unresolved');assert.equal(f.store.mirsadAutoRun.current.retryCount,2);await send(f,'present');
  const second=f.store.mirsadAutoRun.current.scanId;await f.invoke(`receiveResult({scanId:${JSON.stringify(first)},result:{status:'present'}})`);assert.equal(f.store.mirsadAutoRun.current.scanId,second);
  await send(f,'unresolved');assert.equal(f.store.mirsadAutoRun.current.retryCount,1);await send(f,'absent');assert.equal(f.store.mirsadAutoRun.results[0].retryCount,3);
 });
 test(`${edition}: pause between meetings retains primary outcome and resumes calendar`,async()=>{
  const f=make(edition);await f.launch();let paused=false;
  f.ctx.chrome.tabs.remove=async()=>{if(!paused){paused=true;await f.invoke('pauseMonitoring()')}};
  await send(f,'present');assert.equal(f.store.mirsadAutoRun.paused,true);assert.equal(f.store.mirsadAutoRun.meetingScan.linkResults.length,1);
  f.ctx.chrome.tabs.remove=async()=>{};await f.invoke('resumeMonitoring()');if(!f.store.mirsadAutoRun.current)await f.nextAlarm();
  assert.equal(f.store.mirsadAutoRun.current.meetingSource,'calendar');await send(f,'present');assert.equal(f.store.mirsadAutoRun.results.length,1);
 });
 test(`${edition}: browser recovery between meetings retains the primary result`,async()=>{
  const f=make(edition);await f.launch();let halted=false;
  f.ctx.chrome.tabs.remove=async()=>{if(!halted){halted=true;f.store.mirsadAutoRun.running=false}};
  await send(f,'absent');f.store.mirsadAutoRun.running=true;f.ctx.chrome.tabs.remove=async()=>{};
  await f.invoke('recoverPersistedRunAfterBrowserStart()');assert.equal(f.store.mirsadAutoRun.current.meetingSource,'calendar');await send(f,'present');assert.equal(f.store.mirsadAutoRun.results[0].scanStatus,'present');
 });
 test(`${edition}: a lesson ending between links preserves a conclusive primary result`,async()=>{
  const f=make(edition);await f.launch();f.advance(45*60000);await send(f,'absent');
  const record=f.store.mirsadAutoRun.results[0];assert.equal(record.scanStatus,'absent');assert.equal(record.linkResults[1].status,'unresolved');assert.equal(f.store.mirsadAutoRun.current,null);
 });
 test(`${edition}: equal primary/calendar meetings are scanned once`,async()=>{
  const f=fixture({edition,lesson:{calendarUrl:primary}});await f.launch();await send(f,'present');assert.equal(f.store.mirsadAutoRun.results.length,1);assert.equal(f.store.mirsadAutoRun.results[0].linkResults.length,1);
 });
 test(`${edition}: calendar-only lessons remain in the queue`,async()=>{
  const f=fixture({edition,lesson:{url:'',calendarUrl:calendar}});await f.launch();assert.equal(f.store.mirsadAutoRun.current.meetingSource,'calendar');
  assert.equal(await f.invoke(`MirsadScheduleCore.selectPeriodItems([{teacher:'معلم',period:7,hasLesson:true,url:'',calendarUrl:${JSON.stringify(calendar)}}],7).length`),1);await send(f,'present');assert.equal(f.store.mirsadAutoRun.results[0].url,'');
 });
 test(`${edition}: only owned meeting tabs receive scan instructions; calendar remains inactive`,async()=>{
  const f=make(edition);await f.launch();const ready=sender=>{f.ctx.readySender=sender;return f.invoke('MirsadMultiMeeting.pageReady(readySender)')};
  assert.equal((await ready({tab:{id:99,windowId:1,url:primary}})).active,false);
  assert.equal((await ready({tab:{id:1,windowId:1,url:'https://teams.microsoft.com/v2/#/calendar'}})).active,false);
  assert.equal((await ready({tab:{id:1,windowId:1,url:primary}})).active,true);
 });
}
