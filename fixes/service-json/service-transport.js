/* Read service replies safely. Retry reads only; never replay a write here. */
var MirsadServiceTransport=(()=>{
 const reads=new Set(['getTimetableSource','protectedDayState','day']);
 const labels={getTimetableSource:'قراءة إعداد مصدر الجدول',protectedDayState:'التحقق من جدول اليوم',day:'قراءة جدول اليوم'};
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function failure(action,reason,retryable=false){const e=new Error((labels[action]||'طلب خدمة الحفظ')+': '+reason);e.code='service-response-invalid';e.retryable=retryable;return e}
 async function send(url,options){
  let action='';try{action=JSON.parse(options?.body||'{}').action||''}catch{}
  const limit=reads.has(action)?3:1;
  for(let attempt=0;attempt<limit;attempt++){
   try{
    const response=await fetch(url,options);
    if(!response.ok){const retryable=[429,500,502,503,504].includes(response.status);throw failure(action,'تعذر الاتصال بخدمة الحفظ (HTTP '+response.status+').',retryable)}
    let data;
    try{
     if(typeof response.text==='function'){
      const text=await response.text();
      if(!text.trim())throw failure(action,'رد خدمة الحفظ فارغ؛ لم يتأكد تحميل الجدول.',true);
      if(/^\s*</.test(text))throw failure(action,'رابط خدمة الحفظ أعاد صفحة ويب بدل البيانات؛ تحقق من رابط نشر تطبيق الويب وصلاحية الوصول إليه.');
      try{data=JSON.parse(text)}catch{throw failure(action,'رد خدمة الحفظ غير مكتمل أو ليس JSON صالحًا؛ لم يتأكد تحميل الجدول.',true)}
     }else data=await response.json();
    }catch(e){if(e.code==='service-response-invalid')throw e;throw failure(action,'تعذرت قراءة بيانات خدمة الحفظ؛ لم يتأكد تحميل الجدول.',true)}
    if(!data||typeof data!=='object'||Array.isArray(data))throw failure(action,'رد خدمة الحفظ لا يطابق البيانات المطلوبة.',true);
    return {ok:response.ok,status:response.status,url:response.url,json:async()=>data};
   }catch(e){
    const canRetry=e.retryable===true||e instanceof TypeError;
    if(attempt+1>=limit||!canRetry||options?.signal?.aborted){
     if(e.code==='service-response-invalid'){if(limit>1&&attempt>0)e.message+=' جرت إعادة محاولة القراءة '+(attempt+1)+' مرات.';throw e}
     throw failure(action,'تعذر الوصول إلى خدمة الحفظ. تحقق من الاتصال ثم أعد التحميل.',true);
    }
    await wait(400*(attempt+1));
   }
  }
 }
 return {fetch:send};
})();
