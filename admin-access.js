(()=>{
 'use strict';
 const KEY='mirsad_archive_password_v1',READER='mirsad-monitor-reader-key';
 const endpoint='https://script.google.com/macros/s/AKfycbwvkojpc9K_wxKWZhFJj38_OkD5aw18299ceLWdFnKOSMqoGiV3oL74AueuZiKTEHdo/exec';
 let release;const ready=new Promise(resolve=>{release=resolve});window.MirsadAdminAccess={ready};
 const overlay=document.createElement('section');overlay.id='mirsad-admin-access';
 overlay.innerHTML='<form><h1>مرصاد</h1><h2>دخول الإدارة</h2><p>أدخل كلمة مرور الموقع. يبقى الدخول محفوظًا على هذا الجهاز حتى تسجيل الخروج.</p><label for="mirsad-admin-password">كلمة المرور</label><input id="mirsad-admin-password" type="password" autocomplete="current-password" required><button type="submit">دخول</button><p role="status" aria-live="polite"></p></form>';
 document.body.append(overlay);const form=overlay.querySelector('form'),input=overlay.querySelector('input'),button=overlay.querySelector('button'),message=overlay.querySelector('[role=status]');
 const logout=()=>{localStorage.removeItem(KEY);localStorage.removeItem(READER);location.reload()};
 async function login(password,fresh){button.disabled=true;message.textContent='جارٍ التحقق من الدخول…';try{
 const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'adminLogin',key:password})});if(!response.ok)throw new Error('تعذر الاتصال بخدمة الدخول');const result=await response.json();if(!result.ok||result.role!=='admin')throw new Error(result.error||'لم يتم التحقق من صلاحيات الإدارة');
 localStorage.setItem(KEY,password);localStorage.setItem(READER,password);
 if(fresh){location.reload();return}
 overlay.remove();document.documentElement.classList.add('mirsad-admin-ready');
 for(const id of ['resetPin','schedulePin']){const field=document.getElementById(id);if(field){field.required=false;field.closest('label').hidden=true}}
 const archive=document.getElementById('accessCode');if(archive){archive.value=password;archive.closest('div').hidden=true}
 const out=document.createElement('button');out.type='button';out.className='mirsad-admin-logout';out.textContent='تسجيل الخروج';out.onclick=logout;document.body.append(out);release();
 }catch(error){message.textContent=error.message;input.focus()}finally{button.disabled=false}}
 form.onsubmit=event=>{event.preventDefault();void login(input.value.trim(),true)};
 window.addEventListener('storage',event=>{if(event.key===KEY&&!event.newValue)location.reload()});
 const saved=localStorage.getItem(KEY);if(saved)void login(saved,false);
})();
