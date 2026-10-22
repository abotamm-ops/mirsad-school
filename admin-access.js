(()=>{
 'use strict';
 const KEY='mirsad_archive_password_v1',READER='mirsad-monitor-reader-key';
 const endpoint='https://script.google.com/macros/s/AKfycbwvkojpc9K_wxKWZhFJj38_OkD5aw18299ceLWdFnKOSMqoGiV3oL74AueuZiKTEHdo/exec';
 let release;const ready=new Promise(resolve=>{release=resolve});window.MirsadAdminAccess={ready};
 const overlay=document.createElement('section');overlay.id='mirsad-admin-access';
 overlay.innerHTML='<form><h1>مرصاد</h1><h2>دخول الإدارة</h2><p>أدخل كلمة مرور الموقع. يبقى الدخول محفوظًا على هذا الجهاز حتى تسجيل الخروج.</p><label for="mirsad-admin-password">كلمة المرور</label><input id="mirsad-admin-password" type="password" autocomplete="current-password" required><button type="submit">دخول</button><p role="status" aria-live="polite"></p></form>';
 document.body.append(overlay);const form=overlay.querySelector('form'),input=overlay.querySelector('input'),button=overlay.querySelector('button'),message=overlay.querySelector('[role=status]');
 let retryTimer;
 function checking(){overlay.style.display='none';document.documentElement.classList.add('mirsad-admin-ready')}
 function credentials(){document.documentElement.classList.remove('mirsad-admin-ready');overlay.style.display='grid';input.hidden=false;input.required=true;overlay.querySelector('label').hidden=false;button.hidden=false;overlay.querySelector('h2').textContent='دخول الإدارة'}
 const logout=()=>{localStorage.removeItem(KEY);localStorage.removeItem(READER);location.reload()};
 async function login(password,fresh){clearTimeout(retryTimer);if(!fresh)checking();button.disabled=true;message.textContent='جارٍ التحقق من الدخول…';try{
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch(endpoint,{signal:controller.signal,method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'adminLogin',key:password})});}finally{clearTimeout(timeout)}if(!response.ok)throw new Error('تعذر الاتصال بخدمة الدخول');const result=await response.json();if(!result.ok||result.role!=='admin'){const error=new Error(result.error||'لم يتم التحقق من صلاحيات الإدارة');error.denied=['غير مصرح بالدخول','أدخل كلمة مرور الموقع الإدارية','كلمة المرور غير صحيحة'].includes(result.error);throw error}
 localStorage.setItem(KEY,password);localStorage.setItem(READER,password);

 overlay.remove();document.documentElement.classList.add('mirsad-admin-ready');
 for(const id of ['resetPin','schedulePin']){const field=document.getElementById(id);if(field){field.required=false;field.closest('label').hidden=true}}
 const archive=document.getElementById('accessCode');if(archive){archive.value=password;archive.closest('div').hidden=true}
 const out=document.createElement('button');out.type='button';out.className='mirsad-admin-logout';out.textContent='تسجيل الخروج';out.onclick=logout;document.body.append(out);release();window.dispatchEvent(new Event('mirsad-admin-login'));
 }catch(error){if(!fresh&&!error.denied){message.textContent='تعذر الاتصال مؤقتًا؛ دخولك محفوظ وستُعاد المحاولة تلقائيًا.';retryTimer=setTimeout(()=>void login(password,false),5000)}else{credentials();message.textContent=error.message;input.focus()}}finally{button.disabled=false}}
 form.onsubmit=event=>{event.preventDefault();void login(input.value.trim(),true)};
 window.addEventListener('storage',event=>{if(event.key===KEY&&!event.newValue)location.reload()});
 const saved=localStorage.getItem(KEY);if(saved)void login(saved,false);
})();
