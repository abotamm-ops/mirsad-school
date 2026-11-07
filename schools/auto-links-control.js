(()=>{
 const panel=document.createElement('section');panel.className='panel';panel.id='autoLinkSettings';panel.style.cssText='margin:24px 0;padding:18px;border:1px solid #bdd6dc;border-radius:12px;background:#f3fafb';
 panel.innerHTML='<h2>تحديث روابط اليوم</h2><label><input id="autoLinksEnabled" type="checkbox" disabled> تحديث الروابط الناقصة تلقائيًا</label><p>طالما بقيت روابط ناقصة: تحديث صفحة معلمي مدرستي كل خمس دقائق، والتحقق منها، وإضافة الجديد بين الدورات دون تغيير النتائج أو الصور. يتوقف عند اكتمال الروابط، ولا يضمن استمرار تسجيل الدخول.</p><p id="autoLinksStatus" role="status">هذا الخيار يُضبط من جهاز الرصد بعد تحديث الإضافة.</p><details><summary>ملاحظات تحديث الجدول</summary><ul id="autoLinksNotes"></ul></details>';
 (document.querySelector('main')||document.body).append(panel);
 const check=panel.querySelector('input'),status=panel.querySelector('#autoLinksStatus'),notes=panel.querySelector('ul');let ticket=null,dirty=false;
 function request(type,extra={}){ticket=crypto.randomUUID();window.postMessage({source:'mirsad-auto-links-control',type,requestId:ticket,...extra},location.origin)}
 window.addEventListener('message',e=>{if(e.source!==window||e.origin!==location.origin||e.data?.source!=='mirsad-auto-links-extension')return;if(e.data.type==='ready'){request('info');return}if(e.data.requestId!==ticket)return;const r=e.data.payload;if(!r?.ok){status.textContent=r?.error||'تعذر الاتصال بإضافة جهاز الرصد';return}check.disabled=false;if(!dirty)check.checked=r.enabled;dirty=false;status.textContent=r.state?.text||(r.enabled?'التحديث مفعّل':'التحديث متوقف');notes.replaceChildren();for(const n of r.notes||[]){const li=document.createElement('li');li.textContent=new Date(n.at).toLocaleTimeString('ar-SA')+' — '+n.text;notes.append(li)}});
 check.addEventListener('change',()=>{dirty=true;request('set',{enabled:check.checked})});
 request('info');setInterval(()=>{if(!dirty)request('info')},15000);
})();
