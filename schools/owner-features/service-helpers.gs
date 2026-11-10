function commercialValidateBankAccounts_(value){
 if(!Array.isArray(value)||value.length>10)throw new Error('يمكن إضافة عشرة حسابات بنكية كحد أقصى');
 return value.map(function(v){
  if(!v||typeof v!=='object')throw new Error('بيانات الحساب البنكي غير صحيحة');
  var bankName=String(v.bankName||'').trim(),beneficiary=String(v.beneficiary||'').trim(),iban=String(v.iban||'').replace(/\s/g,'').toUpperCase(),accountNumber=String(v.accountNumber||'').replace(/\s/g,'');
  if(!bankName||bankName.length>120||!beneficiary||beneficiary.length>160||(!iban&&!accountNumber)||iban&&!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{10,30}$/.test(iban)||accountNumber&&!/^[0-9]{4,34}$/.test(accountNumber))throw new Error('أكمل اسم البنك والمستفيد ورقم الحساب أو الآيبان بشكل صحيح');
  return {bankName:bankName,beneficiary:beneficiary,iban:iban,accountNumber:accountNumber};
 });
}
function commercialOwnerSettingsPublic_(r){var s=r.portalSettings||{};return {accounts:(s.accounts||[]).map(function(a){return {bankName:a.bankName,beneficiary:a.beneficiary,iban:a.iban||'',accountNumber:a.accountNumber||''}}),updatedAt:s.updatedAt||null}}
function commercialUsageTouch_(school,kind,client,active,at){
 if(['website','monitor'].indexOf(kind)<0||typeof active!=='boolean'||!client||!Number.isFinite(at))return;
 var root=school.usage||(school.usage={since:at}),u=root[kind]||(root[kind]={totalMs:0,pulses:0,days:{},clients:{}}),old=u.clients[client],delta=old&&old.active?at-old.at:0;
 if(delta<0||delta>180000)delta=0;
 // Credit only observed connected intervals, split at Riyadh midnight.
 if(delta>0){var start=at-delta;while(start<at){var date=new Date(start+10800000).toISOString().slice(0,10),end=Math.min(at,Date.parse(date+'T00:00:00Z')+86400000-10800000),day=u.days[date]||(u.days[date]={ms:0});day.ms+=end-start;start=end}u.totalMs+=delta}
 u.pulses++;u.lastSeen=at;u.clients[client]={at:at,active:active};
 var dates=Object.keys(u.days).sort();dates.slice(0,Math.max(0,dates.length-90)).forEach(function(k){delete u.days[k]});
 Object.keys(u.clients).filter(function(k){return at-u.clients[k].at>86400000}).forEach(function(k){delete u.clients[k]});
}
function commercialUsageSummary_(school,at){
 function summarize(kind){var u=school.usage&&school.usage[kind],today=new Date(at+10800000).toISOString().slice(0,10),clients=u?Object.values(u.clients||{}).filter(function(c){return at>=c.at&&at-c.at<180000}):[],previous=Object.values(school[kind==='website'?'webDevices':'extensionDevices']||{}).reduce(function(n,d){return Math.max(n,Number(d.lastSeen)||0)},0);return {measured:!!u,connected:clients.length>0,active:clients.some(function(c){return c.active}),totalMs:u?u.totalMs||0:null,todayMs:u&&u.days[today]?u.days[today].ms:0,lastSeen:u?u.lastSeen:previous||null,days:u?Object.keys(u.days).sort().map(function(date){return {date:date,ms:u.days[date].ms}}):[]}}
 function logins(key){return Object.values(school[key]||{}).reduce(function(n,d){return n+(Number(d.logins)||0)},0)}
 return {since:school.usage?school.usage.since:null,website:summarize('website'),monitor:summarize('monitor'),websiteLogins:logins('webDevices'),extensionLogins:logins('extensionDevices')};
}
