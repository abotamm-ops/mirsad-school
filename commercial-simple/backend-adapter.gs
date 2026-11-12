function commercialSimpleRequest_(registry,p){
 if(p.action==='commercialExtensionCodeRequest'){var delivery=registry.requestExtensionCode(p);if(delivery)MailApp.sendEmail({to:delivery.email,subject:'رمز دخول مرصاد المدارس',body:'رمز الدخول للإضافة: '+delivery.code+'\nصالح لعشر دقائق ويستخدم مرة واحدة. أدخله داخل إضافة مرصاد المدارس فقط. لا تشاركه مع أحد.'});return {sent:true,message:'إذا كان بريدك مسجلًا باشتراك فعال، تصلك رسالة برمز الدخول.'}}
 if(p.action==='commercialExtensionCodeLogin'){var r=registry.extensionCodeLogin(p);r.handover=commercialReadProgress_(registry.authorize(r.writerKey).school);return r}
 if(p.action==='commercialRecorderPortal')return registry.recorderPortal(p);
 throw new Error('طلب غير مدعوم');
}
