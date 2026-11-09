(async()=>{
 const state=document.querySelector('#state'),area=document.querySelector('#code');
 try{
  const fragment=location.hash.slice(1);history.replaceState(null,'',location.pathname);
  if(!/^[A-Za-z0-9_-]{43}$/.test(fragment))throw new Error('افتح رابط الملف الخاص كاملًا الذي أُرسل لك في المحادثة.');
  const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
  const key=await crypto.subtle.importKey('raw',bytes(fragment.replace(/-/g,'+').replace(/_/g,'/')+'='),'AES-GCM',false,['decrypt']);
  const response=await fetch('owner-script-2.4.1.encrypted.json');if(!response.ok)throw new Error('تعذر تحميل الملف. أعد فتح الرابط بعد اكتمال تحديث الموقع.');
  const value=await response.json(),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(value.nonce)},key,bytes(value.data));
  area.value=new TextDecoder().decode(plain);if(!/\/\/ END MIRSAD SCHOOLS COMPLETE SCRIPT 2\.\d+\.\d+$/.test(area.value.trimEnd()))throw new Error('الملف غير مكتمل.');
  document.querySelector('#actions').hidden=false;state.textContent='السكربت كامل وجاهز للنسخ — '+area.value.split('\n').length+' سطرًا.';
  document.querySelector('#copy').onclick=async()=>{try{await navigator.clipboard.writeText(area.value);state.textContent='تم نسخ السكربت كاملًا. الصقه في مشروع المدارس الحالي فقط دون تغيير خصائصه أو رابطه واحفظه.'}catch{area.focus();area.select();state.textContent='تم تحديد النص كاملًا؛ اضغط Ctrl+C لنسخه.'}};
  document.querySelector('#download').onclick=()=>{const url=URL.createObjectURL(new Blob([area.value],{type:'text/plain;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='Mirsad-Schools-OWNER-ONLY-2.4.1.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
 }catch(e){state.textContent=e.name==='OperationError'?'رابط الفتح غير صالح لهذا الملف؛ استخدم الرابط الخاص الأخير.':e.message}
})();
