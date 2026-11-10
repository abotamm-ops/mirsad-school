/* Shared pure presentation rules; never infer historic usage from account age. */
var MirsadOwnerUI=(()=>{
 const archived=(s,now)=>!!s.deletedAt||Number(s.expiresAt)<=now;
 const state=(s,now)=>s.deletedAt?'محذوف':Number(s.expiresAt)<=now?'منتهي':!s.enabled?'معطل':!s.passwordReady?'بانتظار إعداد الدخول':!s.emailVerified?'بانتظار تأكيد البريد':'مفعّل';
 const hours=ms=>ms===null||ms===undefined?'لم يبدأ القياس':(ms/3600000).toLocaleString('ar-SA',{maximumFractionDigits:2})+' ساعة';
 function normalizeAccounts(accounts){return accounts.map(v=>({...v,bankName:String(v.bankName||'').trim(),beneficiary:String(v.beneficiary||'').trim(),iban:String(v.iban||'').replace(/\s/g,'').toUpperCase(),accountNumber:String(v.accountNumber||'').replace(/\s/g,'')}))}
 function bankProblem(accounts){
  if(accounts.length>10)return {index:0,field:'bankName',message:'يمكن إضافة عشرة حسابات بنكية كحد أقصى'};
  for(let index=0;index<accounts.length;index++){
   const v=accounts[index],prefix='الحساب '+(index+1)+': ';
   const fail=(field,message)=>({index,field,message:prefix+message});
   if(!v.bankName)return fail('bankName','أدخل اسم البنك.');
   if(v.bankName.length>120)return fail('bankName','اسم البنك أطول من 120 حرفًا.');
   if(!v.beneficiary)return fail('beneficiary','أدخل اسم المستفيد صاحب الحساب.');
   if(v.beneficiary.length>160)return fail('beneficiary','اسم المستفيد أطول من 160 حرفًا.');
   if(!v.iban&&!v.accountNumber)return fail('accountNumber','أدخل رقم الحساب أو الآيبان؛ يكفي أحدهما.');
   if(v.iban&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(v.iban))return fail('iban','صيغة الآيبان غير صحيحة. اكتب الآيبان كاملًا، أو اتركه فارغًا واكتب رقم الحساب.');
   if(v.accountNumber&&!/^[0-9]{4,34}$/.test(v.accountNumber))return fail('accountNumber','رقم الحساب يجب أن يكون أرقامًا فقط، من 4 إلى 34 خانة.');
  }
  return null;
 }
 return {archived,state,hours,normalizeAccounts,bankProblem};
})();
