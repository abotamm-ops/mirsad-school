function commercialSimpleRequest_(registry,p){
 if(p.action==='commercialExtensionCodeRequest'){if(typeof MailApp.getRemainingDailyQuota==='function'&&MailApp.getRemainingDailyQuota()<1)throw new Error('انتهت حصة إرسال البريد اليومية؛ حاول غدًا أو تواصل مع الدعم');var delivery=registry.requestExtensionCode(p);if(delivery)MailApp.sendEmail({to:delivery.email,subject:'رمز دخول راصد المدارس',body:'رمز الدخول للإضافة: '+delivery.code+'\nصالح لعشر دقائق ويستخدم مرة واحدة. أدخله داخل إضافة راصد المدارس فقط. لا تشاركه مع أحد.'});return {sent:true,message:'أُرسل طلب رمز الدخول إلى بريدك. افحص البريد غير الهام أيضًا.'}}
 if(p.action==='commercialRecorderSignout')return registry.recorderSignout(p);
 if(p.action==='commercialRecorderStatus')return registry.recorderStatus(p);
 if(p.action==='commercialManageAccess')return registry.manageAccess(p.key,p);
 if(p.action==='commercialExtensionCodeLogin'){var r=registry.extensionCodeLogin(p);r.handover=commercialReadProgress_(registry.authorize(r.writerKey).school);return r}
 if(p.action==='commercialRecorderPortal')return registry.recorderPortal(p);
 throw new Error('طلب غير مدعوم');
}

function commercialAccessNotice_(result){var text=result.school.subscriptionMessage||'نرجو تسديد الاشتراك: 100 ريال شهريًا. يُفعّل شهر كامل من وقت تأكيد استلام المبلغ. حسابك وبياناتك محفوظة.';try{MailApp.sendEmail({to:result.school.email,subject:'راصد — تفعيل الاشتراك الشهري',body:text+'\nافتح إضافة راصد للاطلاع على حسابات التحويل البنكي.'});result.emailDelivery={sent:true}}catch(error){result.emailDelivery={sent:false,error:'أُوقف الحساب وتظهر المطالبة في الإضافة، لكن تعذر إرسال البريد. تحقق من صلاحيات الإرسال وحصته اليومية.'}}return result}
