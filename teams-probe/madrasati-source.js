/* Source selection and sequential collection use the user's Madrasati browser session. */
var MadrasatiSource=(()=>{
 const STATE='mirsadMadrasatiCollection';let collecting=false,worker=null;
 const config=async()=>{const s=await chrome.storage.local.get('mirsadDriveConfig'),c=s.mirsadDriveConfig;if(!c?.url||!c?.key)throw new Error('أكمل ربط خدمة الحفظ في تبويب Drive أولًا');return c};
 async function request(action,extra={}){const c=await config(),response=await fetch(c.url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action,key:c.key,...extra}),signal:AbortSignal.timeout(30000)});if(!response.ok)throw new Error('تعذر الاتصال بخدمة مرصاد');const r=await response.json();if(!r.ok){const legacy=['صلاحية القراءة لا تسمح بالرفع','النتيجة لا تطابق جدول اليوم المحفوظ','جدول اليوم غير محفوظ','لم تبدأ أرشفة هذا اليوم'].includes(r.error);throw new Error(legacy?'حدّث سكربت توثيق مرصاد لتفعيل خيار مدرستي؛ لا تغير الرابط أو الرموز':r.error||'تعذر حفظ الجدول')}return r}
 const status=async(text,extra={})=>chrome.storage.local.set({[STATE]:{text,running:collecting,at:Date.now(),...extra}});
 async function select(mode){if(collecting)throw new Error('انتظر اكتمال جمع مدرستي');const run=await getRun();if(run?.running)throw new Error('أوقف الرصد مؤقتًا قبل تغيير مصدر الجدول');const r=await request('setTimetableSource',{mode});if(!r.saved||r.mode!==mode)throw new Error('حدّث كود سكربت الرصد لتفعيل اختيار المصدر');await chrome.storage.local.set({mirsadTimetableSource:mode});await status(mode==='naqar'?'المصدر نقار — استمر بالطريقة المعتادة':'المصدر مدرستي — افتح قائمة المعلمين ثم اضغط جمع وإرسال');return {ok:true,mode}}
 async function info(){const s=await chrome.storage.local.get([STATE,'mirsadTimetableSource']);return {ok:true,mode:s.mirsadTimetableSource||'naqar',state:s[STATE]||null}}
 function allowed(value,kind){try{const u=new URL(value);if(u.origin!=='https://schools.madrasati.sa')return false;return kind==='directory'?/^\/SchoolManagment\/Teachers\/?$/i.test(u.pathname):kind==='timetable'?/^\/SchoolManagment\/Lessons\/TimeTable\/[a-f0-9]+\/?$/i.test(u.pathname):/^\/Teacher\/Lessons\/viewLectureDetails\/?$/i.test(u.pathname)}catch{return false}}
 async function read(tabId,kind,extra={}){for(let i=0;i<40;i++){const tab=await chrome.tabs.get(tabId);if(tab.pendingUrl||tab.status==='loading'||!allowed(tab.url,kind)){if(tab.status==='complete'&&!tab.pendingUrl&&!allowed(tab.url,kind))throw new Error('مدرستي لم يفتح الصفحة المطلوبة؛ تحقق من تسجيل الدخول');await new Promise(r=>setTimeout(r,500));continue}try{const r=await chrome.tabs.sendMessage(tabId,{type:'MIRSAD_MADRASATI_READ',kind,...extra});if(r?.ok)return r;if(r?.error)throw Object.assign(new Error(r.error),{fatal:true})}catch(e){if(e.fatal)throw e}await new Promise(r=>setTimeout(r,500))}throw new Error('تعذر قراءة صفحة مدرستي؛ حدّث صفحتها بعد تحديث الإضافة')}
 async function navigate(url,kind,extra={}){if(!allowed(url,kind))throw new Error('رفض فتح رابط خارج صفحات قراءة مدرستي');if(!worker){const t=await chrome.tabs.create({url,active:false});worker=t.id}else await chrome.tabs.update(worker,{url});return read(worker,kind,extra)}
 async function collect(){if(collecting)throw new Error('الجمع قيد التنفيذ');collecting=true;try{const run=await getRun();if(run?.running)throw new Error('أوقف الرصد مؤقتًا قبل جمع جدول جديد');const mode=await request('getTimetableSource');if(mode.mode!=='madrasati')throw new Error('احفظ اختيار مصدر مدرستي أولًا');
 const tabs=await chrome.tabs.query({url:'https://schools.madrasati.sa/SchoolManagment/Teachers*'}),tab=tabs.find(t=>t.active)||tabs[0];if(!tab)throw new Error('افتح إدارة بيانات المعلمين في مدرستي، واترك القائمة مفتوحة');
 await status('جارٍ قراءة قائمة المعلمين…');
  const listing=await read(tab.id,'directory'),date=MirsadMonitorModel.day(),schoolUrl=new URL(listing.sourceUrl),schoolId=[...schoolUrl.searchParams].find(([k])=>k.toLowerCase()==='schoolid')?.[1];if(!/^[a-f0-9]{32}$/i.test(schoolId||''))throw new Error('تعذر تحديد المدرسة من صفحة المعلمين');
  const lessons=[],teachers=listing.teachers;if(!Array.isArray(teachers)||!teachers.length)throw new Error('قائمة المعلمين فارغة');
  for(let i=0;i<teachers.length;i++){
   const t=teachers[i];if([...new URL(t.url).searchParams].find(([key])=>key.toLowerCase()==='schoolid')?.[1]?.toLowerCase()!==schoolId.toLowerCase())throw new Error('جدول المعلم يتبع مدرسة مختلفة');
   await status('قراءة جدول '+t.name+' · '+(i+1)+' من '+teachers.length,{done:i,total:teachers.length});const table=await navigate(t.url,'timetable',{date});if(table.date!==date)throw new Error('تاريخ جدول '+t.name+' لا يطابق تاريخ اليوم');
   for(const l of table.lessons){let teams='';if(l.detailUrl){await status('قراءة رابط '+t.name+' · الحصة '+l.period,{done:i,total:teachers.length});teams=(await navigate(l.detailUrl,'meeting')).url}else if(!l.unprepared)throw new Error('تعذر تحديد رابط حصة '+t.name);
    lessons.push({teacher:t.name,cellIndex:l.period+1,lesson:l.lesson,title:l.title,time:l.time,teams,linkState:teams?'linked':'unprepared'})
   }
  }
  if(MirsadMonitorModel.day()!==date)throw new Error('تغير التاريخ أثناء الجمع؛ أعد العملية لليوم الجديد');
  const payload={source:'madrasati',sourceUrl:listing.sourceUrl,schoolId,scheduleDate:date,totalTeachers:teachers.length,teachers:teachers.map(t=>t.name),totalLessons:lessons.length,lessons};
  await status('اكتملت القراءة؛ جارٍ إرسال الجدول إلى مرصاد…');const published=await request('publishMadrasatiTimetable',{payload});if(!published.saved||published.lessons!==lessons.length||published.teachers!==teachers.length||published.date!==date)throw new Error('لم يؤكد الخادم حفظ الجدول كاملًا');
  await chrome.storage.local.set({mirsadMadrasatiLastSuccess:{date,teachers:teachers.length,lessons:lessons.length,updatedAt:published.updatedAt}});collecting=false;await status('تم إرسال '+lessons.length+' حصة لـ '+teachers.length+' معلمًا إلى مرصاد · '+date,{done:teachers.length,total:teachers.length});return {ok:true,...published}
 }catch(e){collecting=false;await status('لم يُستبدل الجدول: '+e.message,{error:true});throw e}finally{collecting=false;if(worker){try{await chrome.tabs.remove(worker)}catch{}worker=null}}}
 chrome.runtime.onMessage.addListener((m,sender,reply)=>{if(!['MIRSAD_SOURCE_INFO','MIRSAD_SOURCE_SELECT','MIRSAD_SOURCE_COLLECT'].includes(m?.type)||sender.tab)return;
 if(m.type==='MIRSAD_SOURCE_INFO'){info().then(reply);return true}
 if(m.type==='MIRSAD_SOURCE_SELECT'){select(m.mode).then(reply).catch(e=>reply({ok:false,error:e.message}));return true}
 if(collecting){reply({ok:false,error:'الجمع قيد التنفيذ'});return false}
 collect().catch(e=>status('لم يُستبدل الجدول: '+e.message,{error:true}));reply({ok:true,started:true});return false;
 });return {info,select,collect};
})();
