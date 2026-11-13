/* Google consent happens only on accounts.google.com; Gmail passwords never enter Mirsad. */
(()=>{'use strict';
 const config=globalThis.MirsadCommercialConfig;if(!config)return;
 const profile=document.getElementById('profilePanel');
 const button=document.getElementById('connectSchoolDrive'),state=document.getElementById('schoolDriveState'),folder=document.getElementById('schoolDriveFolder'),reminder=document.getElementById('schoolDriveReminder');
 let poll=null,popup=null,loading=null,linking=false,drive=null,school=null,prompted='',dialog=null,banner=null,activeSession='',flowMessage='';
 const session=()=>localStorage.getItem(config.sessionKey)||'';
 const authenticated=()=>!!session()&&(!profile||!profile.hidden);
 const gmail=email=>/^[^\s@]+@gmail\.com$/i.test(email||'');
 function stopPoll(){if(poll){clearInterval(poll);poll=null}}
 function message(text){if(state)state.textContent=text;if(banner)banner.querySelector('[data-drive-status]').textContent=text;if(dialog)dialog.querySelector('[data-drive-error]').textContent=text}
 function notice(){if(banner)return banner;banner=document.createElement('section');banner.id='schoolDriveLoginNotice';banner.className='card';banner.setAttribute('aria-label','حفظ صور المدرسة في Google Drive');banner.style.cssText='margin:16px 0;padding:16px;border:2px solid #d49a22;border-radius:12px;background:#fff7df;color:#553b00';
  banner.innerHTML='<strong data-drive-status></strong><p data-drive-help>اربط حساب Google تملكه المدرسة لحفظ صور الغياب والملفات المهمة في حسابها والوصول إليها من الجوال أو أي جهاز. الحفظ في حساب المدرسة لا يُفعّل إلا بعد موافقة Google.</p><button type="button" data-drive-open>اربط حساب Google الآن</button>';
  banner.querySelector('button').onclick=()=>showPrompt();(document.querySelector('main')||document.body).prepend(banner);return banner;
 }
 function closePrompt(){if(dialog?.open)dialog.close()}
 function showPrompt(){if(!authenticated()||!drive||drive.connected)return;
  if(!dialog){dialog=document.createElement('dialog');dialog.id='schoolDriveWelcome';dialog.setAttribute('aria-labelledby','schoolDriveWelcomeTitle');dialog.dir='rtl';dialog.style.cssText='width:min(520px,calc(100vw - 40px));box-sizing:border-box;border:0;border-radius:16px;padding:24px;color:#102a43;max-height:85dvh;overflow:auto';
   dialog.innerHTML='<h2 id="schoolDriveWelcomeTitle">فعّل حفظ صور المدرسة وملفاتها</h2><p data-drive-account></p><p style="padding:14px;background:#fff3d2;border-right:4px solid #c28500"><strong>مهم: الحفظ في حساب Google الخاص بمدرستك لم يُفعّل.</strong> اربطه الآن ليكون أرشيف صور الغياب والملفات المهمة في حساب المدرسة، وتستطيع الوصول إليه من أي مكان.</p><p>الاشتراك في راصد وحده لا يربط Drive. اختر حساب المدرسة وأكمل موافقة Google مرة واحدة. لا تدخل كلمة مرور Gmail في راصد.</p><p data-drive-error role="status"></p><div style="display:flex;flex-wrap:wrap;gap:10px"><button type="button" data-drive-same></button><button type="button" data-drive-other class="secondary"></button><button type="button" data-drive-later class="secondary">لاحقًا — الحفظ في حساب المدرسة غير مفعّل</button></div>';
   dialog.querySelector('[data-drive-same]').onclick=()=>begin(school.email);
   dialog.querySelector('[data-drive-other]').onclick=()=>begin();
   dialog.querySelector('[data-drive-later]').onclick=closePrompt;
   document.body.append(dialog);
  }
  const email=school?.email||'',isGmail=gmail(email),same=dialog.querySelector('[data-drive-same]'),other=dialog.querySelector('[data-drive-other]');
  dialog.querySelector('[data-drive-account]').textContent=isGmail?'بريد اشتراكك '+email+'. هل تريد ربط هذا البريد بـ Google Drive أو استخدام حساب Google آخر؟':'بريد اشتراكك '+email+'. اختر حساب Google تملكه المدرسة لحفظ صورها وملفاتها.';
  same.hidden=!isGmail;same.textContent='اربط هذا البريد بـ Google Drive';other.textContent=isGmail?'استخدم حساب Google آخر':'اربط حساب Google الآن';same.disabled=other.disabled=!drive.configured||linking;
  dialog.querySelector('[data-drive-error]').textContent=drive.configured?'':'الربط غير جاهز لدى مالك راصد؛ تواصل معه لتفعيله.';
  if(!dialog.open)dialog.showModal();
 }
 function render(v){drive=v;
  if(reminder)reminder.hidden=v.connected;
  if(button){button.disabled=!v.configured||linking;button.textContent=v.connected?'إعادة ربط Google Drive':'اربط Google Drive لحفظ صورك وملفاتك'}
  if(folder){folder.hidden=!v.folderUrl;if(v.folderUrl)folder.href=v.folderUrl}
  const n=notice();n.style.borderColor=v.connected?'#0b897a':'#d49a22';n.style.background=v.connected?'#e7f6f0':'#fff7df';n.querySelector('[data-drive-help]').hidden=v.connected;
  const open=n.querySelector('button');open.hidden=v.connected;open.disabled=!v.configured||linking;
  if(v.connected)flowMessage='';
  message(flowMessage|| (v.connected?'حساب Google مرتبط: '+v.email+' — الحفظ الجديد بدءًا من '+v.fromDate+'. الأرشيف السابق محفوظ في مكانه.':!v.configured?'الحفظ في حساب Google الخاص بالمدرسة غير مفعّل؛ تواصل مع مالك راصد لتجهيز الربط.':'اربط حساب Google الآن لحفظ صور المدرسة وملفاتها في حسابها وعرضها من أي مكان.'));
  if(dialog)for(const b of dialog.querySelectorAll('[data-drive-same],[data-drive-other]'))b.disabled=!v.configured||linking;
  if(v.connected){closePrompt();stopPoll();return}
  const key=session()+'|'+school.id;if(prompted!==key){prompted=key;showPrompt()}
 }
 async function refresh(){if(!authenticated())return;const ticket=session();if(loading?.ticket===ticket)return loading.promise;
  if(activeSession!==ticket){closePrompt();activeSession=ticket;flowMessage='';linking=false;drive=school=null;prompted=''}
  const request={ticket,promise:null};loading=request;request.promise=(async()=>{try{
   const result=await config.api('commercialDriveStatus');if(ticket!==session()||!authenticated())return;
   if(!result.drive)throw Error('يلزم تحديث خدمة المدارس');
   school=globalThis.MirsadSchoolAccount;
   if(!school?.id||!school.email){const me=await config.api('adminLogin');if(ticket!==session()||!authenticated())return;school=me.school}
   if(!school?.id)throw Error('تعذر التحقق من حساب المدرسة');render(result.drive);
  }catch(e){if(ticket!==session()||!authenticated())return;drive=null;notice();banner.style.borderColor='#d49a22';banner.style.background='#fff7df';banner.querySelector('button').disabled=true;if(dialog)for(const b of dialog.querySelectorAll('[data-drive-same],[data-drive-other]'))b.disabled=true;message(e.message.includes('طلب غير مدعوم')?'حدّث خدمة المدارس لتفعيل ربط Drive؛ الحفظ الحالي لم يتغير.':e.message);if(button)button.disabled=true}finally{if(loading===request)loading=null}})();return request.promise;
 }
 async function begin(email){if(linking||!drive?.configured||!authenticated())return;const ticket=session();
  flowMessage='';const currentPopup=window.open('about:blank','mirsad-google-drive','width=620,height=760');if(!currentPopup){flowMessage='اسمح بفتح نافذة Google ثم اضغط الربط مجددًا';message(flowMessage);return}popup=currentPopup;
  linking=true;if(button)button.disabled=true;if(dialog)for(const b of dialog.querySelectorAll('[data-drive-same],[data-drive-other]'))b.disabled=true;
  try{const v=await config.api('commercialDriveBegin');if(ticket!==session()){currentPopup.close();return}const u=new URL(v.authorizationUrl);if(u.origin!=='https://accounts.google.com'||u.pathname!=='/o/oauth2/v2/auth')throw Error('رابط موافقة Google غير صالح');
   if(gmail(email)){u.searchParams.set('login_hint',email);u.searchParams.set('prompt','consent')}else{u.searchParams.delete('login_hint');u.searchParams.set('prompt','consent select_account')}
   currentPopup.location.replace(u.href);flowMessage='أكمل الموافقة في صفحة Google الرسمية. لم يتم الربط بعد.';message(flowMessage);
   stopPoll();let count=0;poll=setInterval(()=>{if(++count>60){stopPoll();flowMessage='لم يتأكد الربط بعد؛ يمكنك المحاولة مجددًا.';message(flowMessage);return}void refresh()},5000);
  }catch(e){currentPopup.close();if(ticket===session()){flowMessage=e.message;message(flowMessage)}}finally{if(ticket===session()&&popup===currentPopup){linking=false;if(button)button.disabled=!drive?.configured;if(dialog)for(const b of dialog.querySelectorAll('[data-drive-same],[data-drive-other]'))b.disabled=!drive?.configured}}
 }
 if(button)button.onclick=()=>drive?.connected?begin(drive.email):showPrompt();
 if(profile)new MutationObserver(()=>{if(!profile.hidden)void refresh();else{closePrompt();banner?.remove();banner=null;stopPoll();prompted='';drive=school=null;activeSession='';flowMessage='';linking=false}}).observe(profile,{attributes:true,attributeFilter:['hidden']});
 window.addEventListener('mirsad-admin-login',()=>void refresh());
 globalThis.MirsadAdminAccess?.ready?.then(()=>void refresh());
 window.addEventListener('message',e=>{if(e.origin===location.origin&&e.data?.source==='mirsad-school-drive'&&e.data.type==='linked')void refresh()});
 window.addEventListener('focus',()=>void refresh());window.addEventListener('pagehide',()=>{stopPoll();closePrompt()});
 if(profile&&!profile.hidden)void refresh();
})();
