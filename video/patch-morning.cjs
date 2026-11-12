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
 fs.writeFileSync(path,s);
}
