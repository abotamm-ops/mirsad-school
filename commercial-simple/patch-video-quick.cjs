/* Schools-only video preparation and frame checks. Personal runtime is untouched. */
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),dir=process.argv[2];
const p=path.join(dir,'video/controller.js');let s=fs.readFileSync(p,'utf8');
function replace(a,b){if(!s.includes(a))throw Error('Stable video quick-start anchor changed: '+a.slice(0,80));s=s.replace(a,b)}
replace('async function setup(){','async function setup(requestedTabId=null){');
replace('async function release(){', 'async function release(){if(setupWork)await setupWork.catch(()=>{});');
replace('setupWork=performSetup().finally','setupWork=performSetup(requestedTabId).finally');
replace('async function performSetup(){','async function performSetup(requestedTabId=null){');
replace('if(status.ready)return info()}',"if(status.ready)return info();await patch({ready:false,active:null,message:'انتهت تهيئة الفيديو؛ جارٍ تجديدها'})}");
replace('return {ok:true,ready:!!s.ready,resumeAvailable:', 'return {ok:true,ready:!!s.ready&&s.scope===await scope(),resumeAvailable:');
replace("const tab=(await chrome.tabs.query({active:true,currentWindow:true}))[0];if(!tab?.id)throw Error('افتح صفحة مرصاد ثم اضغط تهيئة الفيديو');", "const tab=requestedTabId?await chrome.tabs.get(requestedTabId):(await chrome.tabs.query({active:true,currentWindow:true}))[0];if(!tab?.id)throw Error('افتح صفحة مرصاد ثم اضغط تهيئة الفيديو');");
replace('const durationMs=MirsadVideoCore.budget(await getRun(),job,Date.now(),(await get()).tail);', "const frame=await chrome.tabs.sendMessage(s.tabId,{type:'MIRSAD_VIDEO_VALIDATE',id:job.id});if(frame?.ready!==true||!await allowed(job))throw Error('صفحة الحصة غير جاهزة للتسجيل؛ لم يبدأ تصوير صفحة الدخول أو التحميل');const durationMs=MirsadVideoCore.budget(await getRun(),job,Date.now(),(await get()).tail);");
replace("return {allowed:!!s.active&&s.active.id===p.id&&await allowed(s.active)}", "if(!s.active||s.active.id!==p.id||!await allowed(s.active))return {allowed:false};const frame=await chrome.tabs.sendMessage(s.tabId,{type:'MIRSAD_VIDEO_VALIDATE',id:p.id});return {allowed:frame?.ready===true}");
replace('return {beforeScan,poll,completed,beforeSchoolSwitch:', "return {beforeScan,poll,completed,quickReady:async()=>{const s=await get();if(!s.ready||s.scope!==await scope())return false;const live=await off('status');if(!live.ready){await patch({ready:false,message:'انتهت تهيئة الفيديو؛ اضغط تفعيل الفيديو'});return false}return true},setupQuick:setup,releaseQuick:release,beforeSchoolSwitch:");
new vm.Script(s);fs.writeFileSync(p,s);
const q=path.join(dir,'video/meeting.js');s=fs.readFileSync(q,'utf8');
replace(' async function enter(p){', " async function validate(p){return {ready:await authorized(p)&&!!people()&&panelOpen()}}\n async function enter(p){");
replace("['MIRSAD_VIDEO_ENTER','MIRSAD_VIDEO_LEAVE']", "['MIRSAD_VIDEO_ENTER','MIRSAD_VIDEO_LEAVE','MIRSAD_VIDEO_VALIDATE']");
replace("(p.type==='MIRSAD_VIDEO_ENTER'?enter(p):leave(p))", "(p.type==='MIRSAD_VIDEO_ENTER'?enter(p):p.type==='MIRSAD_VIDEO_VALIDATE'?validate(p):leave(p))");
new vm.Script(s);fs.writeFileSync(q,s);console.log('Schools quick video: explicit target, truthful readiness and meeting-only frame validation');
