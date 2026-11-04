/* Read-only adapter for the real Madrasati teacher directory, timetable and lesson details. */
(()=>{
 if(globalThis.__mirsadMadrasatiReader)return;globalThis.__mirsadMadrasatiReader=true;
 const ORIGIN='https://schools.madrasati.sa',norm=s=>String(s||'').replace(/\s+/g,' ').trim(),digits=s=>String(s).replace(/[٠-٩]/g,d=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
 const sameUrl=(raw,path)=>{try{const u=new URL(raw,ORIGIN);return u.origin===ORIGIN&&path.test(u.pathname)?u.href:null}catch{return null}};
 const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];
 function displayedDate(doc=document){const text=digits(norm(doc.querySelector('#dategeo')?.textContent)),m=/^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(text);if(!m)throw new Error('تعذر قراءة تاريخ أسبوع مدرستي');const month=months.findIndex(x=>x.replace(/[أإآ]/g,'ا')===m[2].replace(/[أإآ]/g,'ا'));if(month<0)throw new Error('شهر الجدول غير معروف');const base=new Date(Date.UTC(+m[3],month,+m[1])),day=Number(doc.querySelector('.dayIcon:has(a.active)')?.getAttribute('dayindex'));if(!Number.isInteger(day)||day<0||day>6)throw new Error('تعذر تحديد يوم الجدول المختار');if(base.getUTCDay()===0)base.setUTCDate(base.getUTCDate()+day);else if(base.getUTCDay()!==day)throw new Error('تاريخ الجدول لا يطابق اليوم المختار');return base.toISOString().slice(0,10)}
 function directory(doc=document){const links=[...doc.querySelectorAll('a[href]')].filter(a=>sameUrl(a.getAttribute('href'),/^\/SchoolManagment\/Lessons\/TimeTable\/[A-Fa-f0-9]+\/?$/));const seen=new Set(),teachers=[];
 for(const a of links){const url=sameUrl(a.getAttribute('href'),/^\/SchoolManagment\/Lessons\/TimeTable\/[A-Fa-f0-9]+\/?$/),card=a.closest('.card'),name=norm(card?.querySelector('h5')?.textContent),id=new URL(url).pathname.split('/').filter(Boolean).pop();if(!name)throw new Error('تعذر ربط جدول باسم المعلم');if(seen.has(id))continue;seen.add(id);teachers.push({id,name,url})}
 if(!teachers.length)throw new Error('افتح إدارة بيانات المعلمين في مدرستي حتى تظهر بطاقات المعلمين');
 if(doc.querySelector('.pagination .next:not(.disabled) a[href],.pagination [aria-label="Next"]:not([aria-disabled="true"])'))throw new Error('قائمة المعلمين موزعة على صفحات؛ اعرض القائمة كاملة قبل الجمع');return teachers}
 function directMeeting(doc){const urls=[...doc.querySelectorAll('a[href]')].map(a=>MirsadScheduleCore.normalizeTeamsUrl(a.getAttribute('href'))).filter(Boolean),unique=[...new Map(urls.map(url=>[MirsadScheduleCore.teamsMeetingKey(url),url])).values()];if(unique.length>1)throw new Error('وجد أكثر من رابط اجتماع؛ لم يُختَر رابط بالتخمين');return unique[0]||'';}
 function timetable(doc=document){const date=displayedDate(doc),rows=[...doc.querySelectorAll('#divDayLectures tr[id^="hessaNumber"]')],lessons=[];
 if(!doc.querySelector('#divDayLectures'))throw new Error('لم يظهر جدول الحصص؛ تحقق من جلسة مدرستي');
 for(const row of rows){const period=Number(row.id.replace('hessaNumber',''));if(!Number.isInteger(period)||period<1||period>7)throw new Error('رقم حصة غير صالح');const cell=row.querySelector('.event-title'),title=norm(cell?.querySelector('h6')?.textContent);if(!title){if(!norm(cell?.textContent)||/لا توجد (حصة|دروس)|لا يوجد درس/.test(norm(cell?.textContent)))continue;throw new Error('حصة غير مقروءة؛ لم يُرسل جدول ناقص')}
 const detailLinks=[...cell.querySelectorAll('a[href]')].map(a=>sameUrl(a.getAttribute('href'),/^\/Teacher\/Lessons\/viewLectureDetails\/?$/i)).filter(Boolean);if(detailLinks.length>1)throw new Error('يوجد أكثر من درس للحصة نفسها؛ يلزم مراجعة الربط');
 const time=norm(cell.querySelector('.text-black-2')?.textContent),classroom=norm(cell.querySelector('.fs-sm.text-body')?.textContent);if(!time||!classroom)throw new Error('بيانات وقت الحصة أو الفصل ناقصة');
 const teams=directMeeting(cell);
 const explicitUnprepared=/لم يتم (?:إعداد|اعداد|تحضير)|غير معد/.test(norm(cell.textContent));
 // A complete scheduled row can legitimately have no lesson-details action.
 // Retain its period/subject/class as a linkless lesson; never omit the row.
 const complete=doc.readyState==='complete'&&!doc.querySelector('[aria-busy="true"],#divDayLectures .loading');
 const suspicious=[...cell.querySelectorAll('a[href]')].some(a=>/viewLectureDetails/i.test(a.getAttribute('href')||''));
 if(!detailLinks.length&&(!complete||suspicious))throw Object.assign(new Error('الحصة '+period+' · '+(!complete?'جدول مدرستي لم يكتمل تحميله':'رابط تفاصيل الحصة غير صالح؛ يلزم مراجعته')),{retryable:!complete});
 const missingDetails=!teams&&!detailLinks.length&&!explicitUnprepared;
 lessons.push({period,title,lesson:classroom,time,teams,linkSource:teams?'row-direct':'',detailUrl:detailLinks[0]||'',unprepared:!teams&&(explicitUnprepared||missingDetails),missingDetails})}
 return {date,lessons}}
 function meeting(doc=document){const direct=directMeeting(doc);if(direct)return direct;
 // Only a fully rendered lesson detail can establish that no meeting link was supplied.
 const complete=doc.readyState==='complete'&&[...doc.querySelectorAll('.titlesection2')].some(el=>norm(el.textContent)==='تكليفات الحصة')&&!doc.querySelector('[aria-busy="true"],#divDayLectures .loading');
 const suspicious=[...doc.querySelectorAll('a[href]')].some(a=>{try{return /(^|\.)teams\.(microsoft\.com|live\.com)$/.test(new URL(a.getAttribute('href'),ORIGIN).hostname)}catch{return false}});
 if(complete&&!suspicious)return '';
 throw Object.assign(new Error(suspicious?'رابط تيمز في الدرس غير معتمد؛ يلزم مراجعته':'تفاصيل الدرس لم تكتمل بعد'),{retryable:!suspicious})}
 async function meetingBatch(values){
 if(!Array.isArray(values)||values.length>7)throw new Error('عدد روابط الحصص غير صالح');
 const urls=[...new Set(values)];if(urls.some(url=>typeof url!=='string'||!sameUrl(url,/^\/Teacher\/Lessons\/viewLectureDetails\/?$/i)))throw new Error('رابط تفاصيل خارج مدرستي');
 const results=new Array(urls.length);let next=0;
 await Promise.all(Array.from({length:Math.min(4,urls.length)},async()=>{while(next<urls.length){const index=next++,detailUrl=urls[index];try{
 const response=await fetch(detailUrl,{method:'GET',credentials:'same-origin',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('تعذر تحميل تفاصيل الدرس ('+response.status+')');
 if(!sameUrl(response.url,/^\/Teacher\/Lessons\/viewLectureDetails\/?$/i))throw new Error('انتهت جلسة مدرستي؛ سجل الدخول مجددًا');
 const html=await response.text();if(html.length>4000000)throw new Error('حجم صفحة الدرس غير متوقع');
 const doc=new DOMParser().parseFromString(html,'text/html'),url=meeting(doc);results[index]={detailUrl,ok:true,url,unprepared:!url};
 }catch(e){results[index]={detailUrl,ok:false,error:e.message,retryable:!!e.retryable}}}}));return results
 }
 // Read timetable JSON through the user's existing Madrasati session.
 function calendarDate(value){
 const text=digits(norm(value));if(/^\d{4}-\d{2}-\d{2}$/.test(text)&&validDate(text))return text;
 const m=/^(\d{1,2})\s+(\S+)\s+(\d{4})$/.exec(text);if(!m)return '';
 const month=months.findIndex(x=>x.replace(/[أإآ]/g,'ا')===m[2].replace(/[أإآ]/g,'ا'));
 const iso=m[3]+'-'+String(month+1).padStart(2,'0')+'-'+m[1].padStart(2,'0');return month>=0&&validDate(iso)?iso:'';
 }
 async function calendarTimetable(table){
 if(!table.lessons.length)return table;
 const current=new URL(location.href),teacher=current.pathname.split('/').filter(Boolean).pop(),school=[...current.searchParams].find(([k])=>k.toLowerCase()==='schoolid')?.[1];
 const hiddenSchool=document.querySelector('#_hndSchoolId')?.value,hiddenTeacher=document.querySelector('#_hndTeacherId')?.value;
 if(!/^[a-f0-9]{32}$/i.test(teacher||'')||!/^[a-f0-9]{32}$/i.test(school||'')||(hiddenSchool&&hiddenSchool.toLowerCase()!==school.toLowerCase())||(hiddenTeacher&&hiddenTeacher.toLowerCase()!==teacher.toLowerCase()))throw new Error('هوية المدرسة أو المعلم في جدول مدرستي غير مطابقة');
 if(displayedDate()!==table.date)throw new Error('تغير تاريخ الجدول قبل جلب روابط الحصص');
 const date=document.querySelector('#_hndCurrentDate')?.value,index=document.querySelector('.dayIcon:has(a.active)')?.getAttribute('dayindex'),token=document.querySelector('#csrfid')?.value;
 if(!date||!token||!/^\d$/.test(index||'')||Number(index)!==new Date(table.date+'T12:00:00Z').getUTCDay())throw new Error('لم تكتمل بيانات طلب روابط مدرستي؛ حدّث صفحة الجدول ثم أعد التحميل');
 const body=new URLSearchParams({Date:date,index,SchoolId:school,TechearId:teacher});
 const response=await fetch(ORIGIN+'/SchoolManagment/Lessons/GetCal',{method:'POST',credentials:'same-origin',redirect:'error',cache:'no-store',headers:{'Content-Type':'application/x-www-form-urlencoded; charset=UTF-8','X-Requested-With':'XMLHttpRequest','requestverificationtoken':token},body:body.toString(),signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw new Error('تعذر جلب روابط مدرستي من GetCal ('+response.status+')؛ لم يُستبدل الجدول');
 if(!sameUrl(response.url,/^\/SchoolManagment\/Lessons\/GetCal\/?$/i))throw new Error('انتهت جلسة مدرستي أثناء جلب الروابط؛ سجل الدخول مجددًا');
 let data;try{data=await response.json()}catch{throw new Error('رد روابط مدرستي ليس بيانات جدول؛ تحقق من جلسة الدخول')}
 if(!Array.isArray(data?.TimeTable)||calendarDate(data.CurrentSelectedDateString)!==table.date||displayedDate()!==table.date)throw new Error('تاريخ بيانات روابط مدرستي لا يطابق الجدول المختار؛ لم يُرسل جدول مختلف');
 const byPeriod=new Map();for(const item of data.TimeTable){const period=Number(item.SlotNumber);if(!Number.isInteger(period)||period<1||period>7){if(item.PresenterUrl)throw new Error('رقم حصة رابط مدرستي غير صالح');continue}if(byPeriod.has(period))throw new Error('يوجد أكثر من درس للحصة نفسها في بيانات مدرستي');byPeriod.set(period,item)}
 for(const [period,item] of byPeriod)if(item.PresenterUrl&&!table.lessons.some(l=>l.period===period))throw new Error('روابط مدرستي لا تطابق الحصص الظاهرة؛ أعد التحميل');
 const lessons=table.lessons.map(lesson=>{
 const item=byPeriod.get(lesson.period);if(!item)throw new Error('الحصة '+lesson.period+' غير موجودة في بيانات روابط مدرستي');
 if(item.ClassRoomName&&norm(item.ClassRoomName)!==norm(lesson.lesson))throw new Error('فصل الحصة '+lesson.period+' لا يطابق بيانات الروابط');
 // SubjectName is a subject label, not the rendered lesson topic. A
 // difference is not a different lesson when teacher/date/slot/class match.
 // Without a JSON class identity, retain the independent row/details fallback.
 const subjectDiff=item.SubjectName&&norm(item.SubjectName)!==norm(lesson.title);
 if(subjectDiff&&!item.ClassRoomName){
  if(lesson.teams||lesson.detailUrl)return {...lesson,linkResolution:'row-fallback'};
  throw new Error('مادة الحصة '+lesson.period+' تختلف عن عنوان الدرس وبيانات الفصل غير متاحة للتحقق');
 }
 const raw=item.PresenterUrl;if(raw===null||raw===undefined||raw==='')return lesson;
 const teams=MirsadScheduleCore.normalizeTeamsUrl(raw);if(!teams)throw new Error('رابط تيمز في بيانات الحصة '+lesson.period+' غير صالح');
 if(lesson.teams&&!MirsadScheduleCore.sameTeamsMeeting(lesson.teams,teams))throw new Error('رابط الحصة '+lesson.period+' يختلف بين الجدول وبيانات مدرستي');
 return {...lesson,teams:lesson.teams||teams,linkSource:lesson.teams?'row-direct':'calendar',unprepared:false,missingDetails:false};
 });return {...table,lessons};
 }
 function validDate(date){if(!/^\d{4}-\d{2}-\d{2}$/.test(date))return false;const value=new Date(date+'T12:00:00Z');return Number.isFinite(value.getTime())&&value.toISOString().slice(0,10)===date}
 const week=date=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-d.getUTCDay());return d.toISOString().slice(0,10)};
 async function clickAndWait(button,ready){if(!button||button.disabled||button.getAttribute('aria-disabled')==='true')throw new Error('مدرستي لا يتيح الانتقال إلى التاريخ المطلوب');const table=document.querySelector('#divDayLectures');if(!table)throw new Error('جدول مدرستي لم يكتمل');let changed=false,last=0;const started=performance.now(),root=document.querySelector('.hijriSchedule')||table.parentElement;const observer=new MutationObserver(()=>{changed=true;last=Date.now()});observer.observe(root,{subtree:true,childList:true,characterData:true});try{button.click();for(let i=0;i<150;i++){await new Promise(r=>setTimeout(r,200));const completed=performance.getEntriesByType('resource').some(e=>e.startTime>=started&&['xmlhttprequest','fetch'].includes(e.initiatorType)&&/Lesson|Lecture|TimeTable/i.test(e.name));if((changed||completed)&&Date.now()-last>=600){try{if(ready()&&!document.querySelector('#divDayLectures .loading'))return}catch{}}}throw new Error('لم يكتمل تحميل التاريخ المطلوب؛ لن يُرسل جدول مختلف')}finally{observer.disconnect()}}

 async function selectDay(date){if(!validDate(date))throw new Error('تاريخ غير صالح');const targetWeek=week(date);let shown=displayedDate(),steps=0;while(week(shown)!==targetWeek){if(++steps>260)throw new Error('التاريخ بعيد؛ افتح أسبوعه في مدرستي ثم أعد النقل');const before=week(shown),next=before<targetWeek;await clickAndWait(document.querySelector(next?'.nextCalendar':'.prevCalendar'),()=>week(displayedDate())!==before);const after=displayedDate();if(next?week(after)<=before:week(after)>=before)throw new Error('أسبوع مدرستي لم يتحرك في الاتجاه المتوقع');shown=after}
 if(shown!==date){const day=new Date(date+'T12:00:00Z').getUTCDay();await clickAndWait(document.querySelector('.dayIcon[dayindex="'+day+'"] a'),()=>displayedDate()===date)}const result=timetable();if(result.date!==date)throw new Error('الجدول المقروء لا يطابق التاريخ المختار');return result}

 globalThis.MirsadMadrasatiReader={directory,timetable,meeting,displayedDate,meetingBatch,calendarTimetable};
 chrome.runtime.onMessage.addListener((m,_sender,reply)=>{if(m?.type!=='MIRSAD_MADRASATI_READ')return;try{
 if(location.origin!==ORIGIN)throw new Error('هذه ليست صفحة مدرستي');
 if(m.kind==='directory'){if(!/^\/SchoolManagment\/Teachers\/?$/i.test(location.pathname))throw new Error('افتح صفحة إدارة بيانات المعلمين');reply({ok:true,teachers:directory(),sourceUrl:location.href});return}
 if(m.kind==='timetable'){if(!/^\/SchoolManagment\/Lessons\/TimeTable\//i.test(location.pathname))throw new Error('لم تفتح صفحة الجدول؛ تحقق من تسجيل الدخول');selectDay(m.date).then(calendarTimetable).then(data=>reply({ok:true,...data})).catch(e=>reply({ok:false,error:e.message,retryable:!!e.retryable}));return true}
 if(m.kind==='meetings'){if(!/^\/SchoolManagment\/Lessons\/TimeTable\//i.test(location.pathname))throw new Error('لم تفتح صفحة جدول المعلم');meetingBatch(m.urls).then(results=>reply({ok:true,results})).catch(e=>reply({ok:false,error:e.message,retryable:!!e.retryable}));return true}
 if(m.kind==='meeting'){if(!/^\/Teacher\/Lessons\/viewLectureDetails\/?$/i.test(location.pathname))throw new Error('لم تفتح تفاصيل الدرس؛ تحقق من تسجيل الدخول');const url=meeting();reply({ok:true,url,unprepared:!url});return}
 throw new Error('طلب قراءة غير صالح')
 }catch(e){reply({ok:false,error:e.message,retryable:!!e.retryable})}return false});
})();
