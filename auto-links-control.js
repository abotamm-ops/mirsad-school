/* This UI talks to the authenticated service; it does not require a local extension. */
(()=>{
 const panel=document.createElement('section');panel.className='panel';panel.id='autoLinkSettings';panel.style.cssText='margin:24px 0;padding:18px;border:1px solid #bdd6dc;border-radius:12px;background:#f3fafb';
 panel.innerHTML='<h2>تحديث روابط اليوم عن بُعد</h2><label><input id="autoLinksEnabled" type="checkbox" disabled> تحديث الروابط الناقصة تلقائيًا</label><p>تحكّم من الجوال أو أي جهاز بحساب الإدارة. جهاز الرصد يستقبل اختيارك عند اتصاله بالخدمة، عادةً خلال دقيقة. تستطيع الإلغاء حتى لو بقيت روابط ناقصة. عند اكتمال الروابط يتوقف تحديث اليوم تلقائيًا، ويمكن إبقاء الخيار مفعّلًا للأيام التالية.</p><p id="autoLinksStatus" role="status">جارٍ قراءة إعداد الخدمة…</p><details><summary>ملاحظات تحديث الجدول</summary><ul id="autoLinksNotes"></ul></details>';
 (document.querySelector('main')||document.body).append(panel);
 const check=panel.querySelector('input'),status=panel.querySelector('#autoLinksStatus'),notes=panel.querySelector('ul');let revision=null,busy=false,readBusy=false,desired=false;
 const call=(action,payload={})=>{if(typeof api!=='function')throw Error('حدّث صفحة الرصد وسجّل دخول الإدارة');return api(action,payload,{signal:AbortSignal.timeout(20000)})};
 function render(r){if(!r.supported||!r.control)throw Error('يلزم تحديث سكربت الخدمة لتفعيل التحكم عن بُعد');revision=r.control.revision;desired=r.control.enabled;check.checked=desired;check.disabled=!r.canManage;const d=r.device,online=!!d&&r.serverTime-d.receivedAt<180000;
  status.textContent=!r.canManage?'سجّل دخول إدارة الموقع لتغيير هذا الإعداد.':!r.acknowledged?(desired?'حُفظ طلب التشغيل؛ بانتظار استلام جهاز الرصد.':'حُفظ طلب الإيقاف؛ بانتظار استلام جهاز الرصد.'):
   !online?'الإعداد محفوظ؛ جهاز الرصد لم يتصل مؤخرًا. سيستقبل التغييرات عند عودة الاتصال.':!desired?'استلم جهاز الرصد طلب إيقاف تحديث الجدول.':d.complete?'الخيار مفعّل؛ اكتملت روابط اليوم وتوقف تحديثها تلقائيًا.':'استلم جهاز الرصد طلب تشغيل التحديث'+(Number.isInteger(d.remaining)?' — المتبقي '+d.remaining+' رابطًا.':'.');
  notes.replaceChildren();for(const n of d?.notes||[]){const li=document.createElement('li');li.textContent=(n.at?new Date(n.at).toLocaleTimeString('ar-SA')+' — ':'')+n.text;notes.append(li)}
 }
 async function read(){if(busy||readBusy)return;readBusy=true;try{const result=await call('getAutoLinksControl');if(!busy)render(result)}catch(e){check.disabled=true;status.textContent=/طلب غير مدعوم|صلاحية القراءة/.test(e.message)?'حدّث سكربت الخدمة لتفعيل التحكم من الجوال، ثم حدّث الصفحة.':e.message}finally{readBusy=false}}
 check.addEventListener('change',async()=>{if(busy||revision===null)return;busy=true;check.disabled=true;const enabled=check.checked;status.textContent='جارٍ حفظ اختيارك في الخدمة…';try{render(await call('setAutoLinksControl',{enabled,expectedRevision:revision,requestId:crypto.randomUUID()}))}catch(e){check.checked=desired;status.textContent='تعذر تأكيد حفظ الاختيار: '+e.message}finally{busy=false;if(revision!==null)check.disabled=false}});
 window.addEventListener('focus',()=>void read());void read();setInterval(()=>void read(),15000);
})();
