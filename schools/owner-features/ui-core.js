/* Shared pure presentation rules; never infer historic usage from account age. */
var MirsadOwnerUI=(()=>{
 const archived=(s,now)=>!!s.deletedAt||Number(s.expiresAt)<=now;
 const state=(s,now)=>s.deletedAt?'محذوف':Number(s.expiresAt)<=now?'منتهي':!s.enabled?'معطل':!s.passwordReady?'بانتظار إعداد الدخول':!s.emailVerified?'بانتظار تأكيد البريد':'مفعّل';
 const hours=ms=>ms===null||ms===undefined?'لم يبدأ القياس':(ms/3600000).toLocaleString('ar-SA',{maximumFractionDigits:2})+' ساعة';
 return {archived,state,hours};
})();
