/* The extension login activates the existing school account directly. */
(()=>{
 'use strict';
 const panel=document.createElement('section');panel.className='settings';
 panel.innerHTML='<h3>حساب المدرسة</h3><p id="commercial-binding-status" role="status"></p><form id="school-login"><label for="school-email">اسم المستخدم / إيميل المدرسة</label><input id="school-email" type="email" autocomplete="username" required><label for="school-password">كلمة المرور</label><input id="school-password" type="password" autocomplete="current-password" required><button type="submit">تسجيل الدخول</button></form><button id="school-logout" type="button" hidden>تسجيل الخروج</button><p id="school-login-feedback" role="status"></p>';
 document.querySelector('header').after(panel);
 const $=id=>document.getElementById(id);let busy=false,version=0;
 async function refreshAccount(){const request=++version;try{
  const s=await chrome.storage.local.get(['mirsadDriveConfig','mirsadCommercialSchool']);if(request!==version)return;
  const school=s.mirsadCommercialSchool,active=!!s.mirsadDriveConfig?.key&&!!school?.id;
  document.body.dataset.accountActive=String(active);
  $('commercial-binding-status').textContent=active?'تم التفعيل وربط حسابك بنجاح — '+(school.profile?.school||school.email||'حساب المدرسة'):'سجّل الدخول لتفعيل الإضافة وربطها بحساب المدرسة مباشرة.';
  $('commercial-binding-status').dataset.active=String(active);
  $('school-login').hidden=active;$('school-logout').hidden=!active;
 }catch{$('school-login-feedback').textContent='تعذر التحقق من الحساب؛ أعد فتح الإضافة.'}}
 $('school-login').onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;const button=event.submitter;button.disabled=true;$('school-login-feedback').textContent='جارٍ تسجيل الدخول…';try{
  const r=await chrome.runtime.sendMessage({type:'MIRSAD_SCHOOL_LOGIN',email:$('school-email').value,password:$('school-password').value});if(!r?.ok)throw Error(r?.error||'تعذر تسجيل الدخول');
  $('school-password').value='';$('school-login-feedback').textContent='تم التفعيل وربط الحساب بنجاح.';await refreshAccount();
 }catch(error){$('school-login-feedback').textContent=error.message}finally{busy=false;button.disabled=false}};
 $('school-logout').onclick=async()=>{if(busy)return;busy=true;$('school-logout').disabled=true;try{
  const r=await chrome.runtime.sendMessage({type:'MIRSAD_SCHOOL_LOGOUT'});if(!r?.ok)throw Error(r?.error||'تعذر تسجيل الخروج');$('school-login-feedback').textContent=r.warning||'تم تسجيل الخروج.';await refreshAccount();
 }catch(error){$('school-login-feedback').textContent=error.message}finally{busy=false;$('school-logout').disabled=false}};
 void refreshAccount();chrome.storage.onChanged.addListener((changes,area)=>{if(area==='local'&&(changes.mirsadDriveConfig||changes.mirsadCommercialSchool))void refreshAccount()});
})();
