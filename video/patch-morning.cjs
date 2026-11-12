const fs=require('fs');
for(const edition of ['Teams','Schools']){
 const path='/tmp/mirsad-video-'+edition+'/auto-links.js';let s=fs.readFileSync(path,'utf8');
 s=s.replace("if(!await enabled()||!await allowed())throw Error('انتهى وقت تحديث صفحة المعلمين أو أُلغي التحديث');","if(!await allowed())throw Error('انتهى وقت تحديث صفحة المعلمين أو أُلغي التحديث');");
 const marker=' async function selectedMode()';if(!s.includes(marker))throw Error('morning insertion point missing');s=s.replace(marker,'\n'+fs.readFileSync(__dirname+'/morning-helper.inc','utf8')+'\n'+marker);
 const guard='async function beforeCycle(run){await MadrasatiSource.cancelAutomatic?.();if(applying||!await enabled())return;';
 if(!s.includes(guard))throw Error('merge guard missing');
 s=s.replace(guard,"async function beforeCycle(run){await MadrasatiSource.cancelAutomatic?.();const waiting=(await chrome.storage.local.get(STAGED))[STAGED];if(applying)return;if(waiting?.reason==='morning'){if(!await morningAllowed(waiting)){await chrome.storage.local.remove(STAGED);return}}else if(!await enabled())return;");
 s=s.replace('if(pending.mode!==await selectedMode()||pending.date!==today()',"if(pending.reason!=='morning'&&pending.mode!==await selectedMode()||pending.date!==today()");
 s=s.replace("await chrome.storage.local.remove(STAGED);await note(r.filled?", "await chrome.storage.local.remove(STAGED);await note(r.filled?");
 s=s.replace('return {tick,collectGap,completed,','return {tick,collectGap,completed,collectMorning,planMorning,morningWindow,');
 s=s.replace('const current=await getRun();if(!current?.running||current.paused||current.current||current.scheduleRevision!==pending.revision',"const current=pending.reason==='morning'?(await morningWindow())?.run:await getRun();if(!current||(pending.reason!=='morning'&&!current.running)||current.paused||current.current||current.scheduleRevision!==pending.revision");
 // Preclass fills missing links only; daytime enabled/mode policy remains unchanged.
 s=s.replace("automaticRefresh:true,refreshExisting:pending.mode==='continuous'","automaticRefresh:pending.reason!=='morning',refreshExisting:pending.reason!=='morning'&&pending.mode==='continuous'");
 s=s.replace('if(r.filled&&r.day?.snapshot){','if(r.filled&&r.day?.snapshot&&current.running){');
 fs.writeFileSync(path,s);
}
