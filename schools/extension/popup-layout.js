/* Schools presentation only: keep the existing commands and account binding. */
(()=>{
 'use strict';
 const $=id=>document.getElementById(id),main=document.querySelector('main');
 const run=document.querySelector('[data-panel="run"]'),timing=document.querySelector('[data-panel="timing"]'),drive=document.querySelector('[data-panel="drive"]'),tools=document.querySelector('[data-panel="tools"]');
 const advanced=document.createElement('details');advanced.id='advanced-settings';
 const summary=document.createElement('summary');summary.textContent='⚙ الإعدادات المتقدمة';advanced.append(summary);
 const advancedTiming=document.createElement('section');advancedTiming.className='settings timing-grid';
 const title=document.createElement('h3');title.textContent='نطاق الحصص وخيارات الرصد';advancedTiming.append(title);
 for(const id of ['startPeriod','endPeriod','scanDelay']){
  advancedTiming.append(document.querySelector('label[for="'+id+'"]'),$(id));
 }
 const rangeHint=document.createElement('p');rangeHint.className='hint';rangeHint.textContent='لتخصيص الرصد لحصة واحدة، اخترها في «من الحصة» و«إلى الحصة». تُحفظ الخيارات بزر حفظ الإعدادات.';advancedTiming.append(rangeHint);
 // These controls stay in the DOM for existing status/command handlers, but
 // preparing a day is an internal part of starting monitoring, not a user step.
 $('begin-day').hidden=true;
 const diagnostic=$('start-now');tools.prepend(diagnostic);
 const dateLabel=$('madrasatiDateLabel');advancedTiming.append(dateLabel);
 const sourceLabel=document.querySelector('label[for="scheduleSource"]');advancedTiming.append(sourceLabel,$('scheduleSource'));
 const source=run.querySelector('.settings');
 const open=document.createElement('button');open.id='open-teachers';open.type='button';open.textContent='افتح صفحة المعلمين';
 open.onclick=async()=>{try{
  const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/SchoolManagment/Teachers*'}),tab=tabs[0];
  if(tab){await chrome.tabs.update(tab.id,{active:true});if(tab.windowId!=null)await chrome.windows.update(tab.windowId,{focused:true})}
  else await chrome.tabs.create({url:'https://schools.madrasati.sa/SchoolManagment/Teachers',active:true});
 }catch{ $('status').textContent='تعذر فتح مدرستي؛ افتح صفحة المعلمين من المتصفح.' }};
 const instruction=document.createElement('p');instruction.className='hint';instruction.textContent='تأكد من فتح صفحة المعلمين في منصة مدرستي لتحميل الجدول وتحديثه أثناء الرصد. أبقِ صفحة المعلمين وصفحة الرصد مفتوحتين طوال الرصد.';
 source.prepend(instruction,open);
 source.querySelector('h3').textContent='جدول اليوم';
 $('collectMadrasati').textContent='حمّل جدول اليوم';
 $('collectMadrasati').removeAttribute('data-step');
 $('collectMadrasati').title='تحميل جدول اليوم من صفحة المعلمين إلى الرصد';
 $('collectMadrasati').removeAttribute('aria-description');
 // Replace obsolete testing/archiving help with instructions for daily use.
 for(const hint of source.querySelectorAll('.hint'))if(hint!==instruction&&hint.id!=='scheduleSourceStatus')hint.remove();
 const timingCard=timing.querySelector('.settings');
 const timingDetails=document.createElement('details');timingDetails.className='settings school-timing';
 const timingSummary=document.createElement('summary');timingSummary.textContent='توقيت المدرسة وإعدادات الجدول';timing.append(timingDetails);timingDetails.append(timingSummary,timingCard);
 for(const hint of timingCard.querySelectorAll('.hint'))hint.remove();
 const cycleHelp=document.createElement('p');cycleHelp.className='hint';cycleHelp.textContent='دورة الرصد هي مرور على روابط الحصة وفحصها. بعد اكتمالها تبدأ الدورة التالية حسب الفاصل المحدد، ولا تبدأ دورة بعد انتهاء الحصة.';
 const savedHelp=document.createElement('p');savedHelp.className='hint';savedHelp.textContent='تُحفظ هذه الإعدادات وتُستخدم يوميًا، ويمكنك تعديلها في أي وقت.';
 timingCard.insertBefore(cycleHelp,$('preview'));timingCard.append(savedHelp);
 $('save-time').textContent='حفظ الإعدادات';$('save-time').removeAttribute('data-step');
 $('save-time').title='حفظ توقيت المدرسة والدورات ونطاق الحصص';
 $('start').textContent='رصد';$('start').removeAttribute('data-step');$('start').title='رصد الحصة الحالية والحصص القادمة فقط';
 const controlsHelp=document.createElement('div');controlsHelp.className='settings run-help';
 const heading=document.createElement('h3');heading.textContent='قبل بدء الرصد';
 const pauseHelp=document.createElement('p');pauseHelp.textContent='إيقاف مؤقت: عند الاستئناف يكمل من مكان التوقف.';
 const resetHelp=document.createElement('p');resetHelp.textContent='إيقاف وإعادة ضبط: عند تشغيل الرصد مجددًا يبدأ فحص الحصة الحالية من جديد، حتى لو كانت في منتصف وقتها، ثم يكمل الحصص القادمة. لا يرجع للحصص الماضية.';
 controlsHelp.append(heading,pauseHelp,resetHelp);
 run.querySelector('.intro')?.remove();
 run.insertBefore(controlsHelp,$('start'));
 const account=$('school-login')?.closest('section');
 const logout=$('school-logout');if(logout)advanced.append(logout);
 if(account){account.id='school-account';account.querySelector('h3').textContent='حساب المدرسة';
  account.querySelector('.commercial-password-help')?.remove();account.querySelector('.commercial-session-note')?.remove();}
 const accountLink=document.querySelector('.commercial-account-link');accountLink.textContent='ربط Drive المدرسة وإعدادات الحساب';
 const storage=document.createElement('section');storage.className='settings';
 const storageTitle=document.createElement('h3');storageTitle.textContent='حفظ المدرسة';storage.append(storageTitle,accountLink);
 advanced.append(advancedTiming,tools,drive,$('local-backup-summary'));
 // Local file controls may be installed after this script; keep their parent.
 document.addEventListener('DOMContentLoaded',()=>{const calendar=$('calendarPilot');if(calendar)advanced.append(calendar)},{once:true});
 const statusLabel=document.querySelector('.status-label'),status=$('status');
 main.replaceChildren(...(account?[account]:[]),storage,timingDetails,run,advanced,statusLabel,status);
 // Source must remain before the controls and below saved school timing.
 document.querySelector('.brand span').textContent='خطوات بسيطة لرصد الحصة الحالية والقادمة';
 const state=document.createElement('p');state.id='simple-run-state';state.className='simple-state';state.setAttribute('role','status');$('start').before(state);
 function runState(){const icon=$('brand-icon'),active=icon?.src.includes('/on-');state.dataset.active=String(!!active);state.textContent=active?'● الرصد شغّال':'● الرصد متوقف';}
 new MutationObserver(runState).observe($('brand-icon'),{attributes:true,attributeFilter:['src']});runState();
 // Existing status refreshes also render labels. Keep the commercial wording
 // stable while preserving their disabled states and verified step state.
 for(const [id,label] of [['start','رصد'],['collectMadrasati','حمّل جدول اليوم'],['save-time','حفظ الإعدادات']]){
  const node=$(id),render=()=>{if(node.textContent!==label)node.textContent=label};
  new MutationObserver(render).observe(node,{childList:true,characterData:true,subtree:true});render();
 }
})();
