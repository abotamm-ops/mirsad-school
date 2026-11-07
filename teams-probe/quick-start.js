(async()=>{
 const status=document.getElementById('quick-status'),day=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const school=chrome.runtime.getManifest().name.includes('المدارس');document.getElementById('open-dashboard').href='https://mirsad-school.onrender.com/'+(school?'schools/':'')+'automatic-monitoring.html';
 const send=async(type,extra={})=>{const r=await chrome.runtime.sendMessage({type,...extra});if(r?.ok===false)throw Error(r.error||r.detail||'تعذر تنفيذ الخطوة');return r};
 const mark=(id,s)=>document.getElementById('step-'+id).dataset.state=s;
 try{await navigator.locks.request('mirsad-daily-start',{ifAvailable:true},async lock=>{
  if(!lock)throw Error('البدء اليومي السريع يعمل في صفحة أخرى؛ لم يبدأ تسلسل ثانٍ');
  const key='mirsadQuickStart:'+location.hash.slice(1),stored=(await chrome.storage.local.get(key))[key];await chrome.storage.local.remove(key);
  if(!stored||Date.now()-stored.at>120000)throw Error('انتهى طلب البدء؛ افتحه من الإضافة مجددًا');
  if((await send('MIRSAD_STATUS')).run?.running)throw Error('الرصد يعمل بالفعل؛ لم تُعدّل الجلسة الحالية');
  const today=day();mark('source','busy');status.textContent='جارٍ تحميل جدول اليوم '+today+'…';
  await chrome.storage.local.set({mirsadMadrasatiSelectedDate:today});
  const before=await send('MIRSAD_SOURCE_INFO');if(before.state?.running||before.pending)throw Error('يوجد جمع أو قرار جدول معلّق؛ أكمله من الإضافة أولًا');
  await send('MIRSAD_SOURCE_SELECT',{mode:'madrasati'});await send('MIRSAD_SOURCE_COLLECT',{date:today});
  const deadline=Date.now()+10*60*1000;let verified=false;
  while(Date.now()<deadline){await new Promise(r=>setTimeout(r,1000));const info=await send('MIRSAD_SOURCE_INFO');
   if(day()!==today)throw Error('تغير التاريخ؛ أعد البدء لليوم الجديد');
   if(info.pending){status.textContent='حفظ الجدول السابق وتطبيق جدول اليوم…';await send('MIRSAD_SOURCE_CONFIRM_IMPORT',{keepPrevious:true});continue}
   if(info.state?.running){status.textContent=info.state.text;continue}
   if(info.state?.error)throw Error(info.state.text||'تعذر تحميل جدول اليوم');
   const last=info.lastSuccess;
   if(last?.updatedAt!==before.lastSuccess?.updatedAt&&last?.date===today&&last.importedForDate===today&&last.activeVerified===true&&last.monitoringPrepared===true&&last.lessons>0){verified=true;break}
  }
  if(!verified)throw Error('لم يتأكد تحميل جدول اليوم ضمن المهلة؛ لم يبدأ الرصد');mark('source','done');mark('timing','busy');status.textContent='جارٍ تثبيت التوقيت والدورات…';
  await send('MIRSAD_SAVE_SCHEDULE_SETTINGS',{settings:stored.settings});mark('timing','done');mark('day','busy');
  const ready=await send('MIRSAD_BEGIN_DAY');if(ready.day?.date!==today||!ready.day?.snapshot?.scheduleRevision||!ready.day.snapshot.lessons?.length)throw Error('لم تتأكد جاهزية يوم الرصد');
  mark('day','done');mark('run','busy');await send('MIRSAD_START');const started=await send('MIRSAD_STATUS');if(!started.run?.running||started.run.immediateMode||started.run.backtestMode)throw Error(started.status?.text||'لم يتأكد تشغيل الرصد الموقّت');mark('run','done');status.textContent='اكتمل التجهيز. شُغّل الرصد حسب توقيت الحصص والدورات؛ يمكنك إغلاق صفحة التجهيز.';
 })}catch(e){status.textContent='توقف البدء السريع: '+e.message+'\nلم تُحذف النتائج أو الصور السابقة.'}
})();
