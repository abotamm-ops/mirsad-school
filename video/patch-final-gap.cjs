const fs=require('fs');
for(const edition of ['Teams','Schools']){
 const root='/tmp/mirsad-video-'+edition+'/';let s=fs.readFileSync(root+'auto-links.js','utf8');
 s=s.replace("const REMOTE=", "const TAIL='mirsadAutoLinksFinalGap';const REMOTE=");
 const anchor=' async function collectGap()';if(!s.includes(anchor))throw Error('missing auto-links collector');
 const helpers=`
 async function gapWindow(run){
  if(!run?.running||run.paused||run.current)return null;
  if(run.waitingForCycle2&&run.nextCycleAt>Date.now()+2000)return {endAt:run.nextCycleAt,startPeriod:Math.max(1,run.period||1),kind:'cycle'};
  const tail=(await chrome.storage.local.get(TAIL))[TAIL];
  if(tail&&tail.date===today()&&tail.scope===await scope()&&tail.startedAt===run.startedAt&&tail.epoch===(run.controlEpoch||0)&&tail.period===run.period&&tail.cycle===run.cycle&&tail.endAt>Date.now()+2000&&run.index>=run.periodItems?.length)return {...tail,kind:'final'};
  return null;
 }
 async function completed(run,after,nextPeriodNumber){
  if(!run?.running||run.paused||run.current||run.waitingForCycle2||run.period!==after||!run.periodItems?.length||run.index<run.periodItems.length||run.testMode||run.backtestMode||run.immediateMode||run.calendarTrial)return;
  if(run.cycle!==Number(scheduleSettings.roundCount))return;
  const next=PERIODS.find(p=>p.n===nextPeriodNumber);if(!next)return;
  const bounds=periodBounds(next,new Date(),'activeOrNext'),endAt=bounds?.start.getTime();if(!endAt||endAt<=Date.now()+2000)return;
  const live=await getRun();if(!live?.running||live.paused||live.current||live.period!==after||live.startedAt!==run.startedAt||(live.controlEpoch||0)!==(run.controlEpoch||0))return;
  await chrome.storage.local.set({[TAIL]:{date:today(),scope:await scope(),startedAt:run.startedAt,epoch:run.controlEpoch||0,period:after,cycle:run.cycle,endAt,startPeriod:after+1}});
  void collectGap();
 }
`;
 s=s.replace(anchor,helpers+anchor);
 const old="const run=await getRun();if(!run?.running||run.paused||run.current||!run.waitingForCycle2||!(run.nextCycleAt>Date.now()+2000))return;";
 if(!s.includes(old))throw Error('missing original gap guard');s=s.replace(old,"const run=await getRun(),window=await gapWindow(run);if(!window)return;");
 // Only the collection function uses this startPeriod expression; tick retains its current health policy.
 const pos=s.indexOf(' async function collectGap()'),end=s.indexOf(' async function beforeCycle',pos);let body=s.slice(pos,end);
 body=body.replace('startPeriod=Math.max(1,run.period||1)','startPeriod=window.startPeriod');
 body=body.replace("const r=await getRun();return r?.running&&!r.paused&&!r.current&&r.waitingForCycle2&&r.nextCycleAt===run.nextCycleAt&&r.startedAt===run.startedAt&&(r.controlEpoch??0)===(run.controlEpoch??0)&&Date.now()<run.nextCycleAt-1000", "const r=await getRun(),activeWindow=await gapWindow(r);return !!activeWindow&&activeWindow.kind===window.kind&&activeWindow.endAt===window.endAt&&r.period===run.period&&r.cycle===run.cycle&&r.startedAt===run.startedAt&&(r.controlEpoch??0)===(run.controlEpoch??0)&&Date.now()<window.endAt-1000");
 body=body.replace('run.cycle,run.nextCycleAt,mode','run.cycle,window.kind,window.endAt,mode').replace('health(tab,run.nextCycleAt-1000','health(tab,window.endAt-1000');
 s=s.slice(0,pos)+body+s.slice(end);s=s.replace('return {tick,collectGap,','return {tick,collectGap,completed,');fs.writeFileSync(root+'auto-links.js',s);
 let bg=fs.readFileSync(root+'background.js','utf8');const acorn=require('/tmp/mirsad-review-tools/node_modules/acorn'),tree=acorn.parse(bg,{ecmaVersion:'latest'}),fn=tree.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name==='advancePeriod');let target;function visit(n){if(!n||typeof n!=='object')return;if(n.type==='AwaitExpression'&&n.argument?.callee?.name==='beginPeriod')target=n;for(const v of Object.values(n))if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v)}visit(fn);if(!target)throw Error('missing advance scheduling');const run=fn.params[0].name,after=fn.params[1].name,next=bg.slice(target.argument.arguments[1].start,target.argument.arguments[1].end);bg=bg.slice(0,target.end)+';void MirsadAutoLinks.completed('+run+','+after+','+next+').catch(()=>{})'+bg.slice(target.end);fs.writeFileSync(root+'background.js',bg);
}
