/* School website authentication. A missing profile never redirects extension customers in a loop. */
(()=>{'use strict';
 const C=window.MirsadCommercialConfig,simple=localStorage.getItem('mirsad-simple-view')==='true';let resolveReady,generation=0,authenticated=false,activityTimer=null;
 window.MirsadAdminAccess={ready:new Promise(resolve=>resolveReady=resolve)};
 const panel=document.createElement('section');panel.id='mirsad-admin-access';panel.setAttribute('aria-label','حالة فتح حساب المدرسة');
 const box=document.createElement('div');box.className='school-access-card';const heading=document.createElement('h2');heading.textContent='جارٍ فتح حسابك في راصد…';
 const status=document.createElement('p');status.setAttribute('role','status');status.textContent='نتحقق من الجلسة؛ لا تحتاج إعادة الاشتراك.';
 const retry=document.createElement('button');retry.type='button';retry.textContent='إعادة المحاولة';retry.hidden=true;
 box.append(heading,status,retry);panel.append(box);document.body.append(panel);
 function fail(message){document.documentElement.classList.remove('mirsad-admin-ready');panel.hidden=false;heading.textContent='تعذر فتح حساب المدرسة الآن';status.textContent=message;retry.hidden=false}
 function deadline(promise){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('تأخر رد الخدمة. حسابك محفوظ؛ أعد المحاولة.')),25000)})]).finally(()=>clearTimeout(timer))}
 async function authenticate(){const request=++generation,key=localStorage.getItem(C.sessionKey);retry.hidden=true;heading.textContent='جارٍ فتح حسابك في راصد…';status.textContent='نتحقق من الجلسة؛ لا تحتاج إعادة الاشتراك.';panel.hidden=false;
  if(!key){if(!simple){location.replace('school-settings.html');return}fail('افتح موقع راصد من زر «راصد» داخل الإضافة لاستعادة دخولك. لا تحتاج إنشاء حساب جديد.');return}
  try{const value=await deadline(C.api('adminLogin'));if(request!==generation||localStorage.getItem(C.sessionKey)!==key)return;
   C.saveSchool(value.school);if(!value.school?.profile?.school&&!simple){location.replace('school-settings.html');return}
   for(const id of ['resetPin','schedulePin']){const input=document.getElementById(id);if(input){input.required=false;input.disabled=true;const label=input.closest('label');if(label)label.hidden=true}}
   localStorage.setItem('mirsad-schools-admin-session-v2',key);document.documentElement.classList.add('mirsad-admin-ready');panel.hidden=true;
   if(!authenticated){authenticated=true;resolveReady();window.dispatchEvent(new Event('mirsad-admin-login'));void C.api('commercialWebsiteActivity').catch(()=>{});activityTimer=setInterval(()=>{if(!document.hidden)void C.api('commercialWebsiteActivity').catch(()=>{})},60000)}
   const main=document.querySelector('main');document.getElementById('school-profile-reminder')?.remove();if(simple&&!value.school?.profile?.school){const note=document.createElement('p');note.id='school-profile-reminder';note.className='subscription-expired';note.textContent='حسابك جاهز. أكمل اسم المدرسة وبياناتها من الإضافة ← الإعدادات ← الحساب.';main?.prepend(note)}
   if(!simple&&!document.querySelector('.mirsad-admin-logout')){const link=document.createElement('a');link.className='mirsad-admin-logout';link.textContent='إعدادات المدرسة';link.href='school-settings.html';document.body.append(link)}
   if(!value.school.active&&!document.getElementById('school-subscription-status')){const note=document.createElement('p');note.id='school-subscription-status';note.className='subscription-expired';note.textContent=value.school.subscriptionMessage||'الاشتراك غير نشط. بياناتك محفوظة؛ راجع حالة الاشتراك في الإضافة.';main?.prepend(note)}
  }catch(error){if(request!==generation)return;if(!simple&&['invalid-session','school-disabled'].includes(error.code)){location.replace('school-settings.html');return}fail(['invalid-session','device-revoked'].includes(error.code)?'افتح موقع راصد من الإضافة لتجديد جلسة الموقع. حسابك وبياناتك محفوظة.':error.message)}
 }
 retry.onclick=()=>void authenticate();window.addEventListener('storage',event=>{if(event.key===C.sessionKey){document.documentElement.classList.remove('mirsad-admin-ready');if(activityTimer)clearInterval(activityTimer);location.reload()}});window.addEventListener('pageshow',event=>{if(event.persisted)location.reload()});
 void authenticate();
})();
