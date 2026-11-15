from pathlib import Path
import runpy
root=Path(__file__).resolve().parents[1];work=Path('/tmp/mirsad-commercial')
def transform(s):
 s=runpy.run_path(str(root/'commercial-simple/build-access-control.py'))['transform'](s)
 s=s.replace('  requestExtensionCode(input){',(root/'commerce/registry.inc').read_text()+'  requestExtensionCode(input){',1)
 a=s.index('function resolve(r,key,active=false){');b=s.index('\n',a);part=s[a:b].replace('active=false){','active=false,billing=false){').replace("if(!s.enabled)fail(","if(!billing&&!s.enabled)fail(")
 part=part.replace('return {school:s,role}',"if(!billing&&role==='admin'&&s.sessions.some(x=>same(x.hash,hash)&&x.billingOnly))fail('افتح صفحة الاشتراك لتفعيل الحساب','subscription-required');return {school:s,role}");s=s[:a]+part+s[b:]
 a=s.index('  websitePinLogin(input)');b=s.index('\n',a);part=s[a:b];part=part.replace("if(!s.enabled)fail(s.subscriptionMessage||'الحساب موقوف؛ تواصل مع الإدارة','school-disabled');",'');part=part.replace('entry.readOnly=true;','entry.readOnly=true;entry.billingOnly=!s.enabled||s.expiresAt<=now();');s=s[:a]+part+s[b:]
 # An already-bound blocked recorder may set its website PIN for payment access only.
 old="setWebsitePin(input){this.recorderProof(input.key,input);const r=load(),v=resolve(r,input.key),"
 assert old in s
 s=s.replace(old,"setWebsitePin(input){this.recorderStatus(input);const r=load(),v=resolve(r,input.key,false,true),")
 s=s.replace('pinHash:commercialWebsitePinHash_,','pinHash:commercialWebsitePinHash_,validateInvoice:commercialValidateInvoice_,storeInvoice:commercialStoreInvoice_,readInvoice:commercialReadInvoice_,')
 s=s.replace("accounts:commercialOwnerSettingsPublic_(r).accounts||[]}},","accounts:commercialOwnerSettingsPublic_(r).accounts||[],announcements:(r.announcements||[]).filter(x=>x.enabled&&x.expiresAt>now()).map(x=>({id:x.id,title:x.title,body:x.body,tone:x.tone,expiresAt:x.expiresAt}))}},",1)
 # Only the dedicated billing routes may bypass active subscription/read-only attendance checks.
 anchor='var registry=commercialRegistry_();';assert anchor in s
 s=s.replace(anchor,anchor+"var commerceAction=['commercialOwnerCommerce','commercialInvoiceFile','commercialBillingStatus','commercialInvoiceUpload','commercialBillingLogout'].includes(p.action);")
 s=s.replace("if(/^a\\./.test(p.key||'')){", "if(!commerceAction&&/^a\\./.test(p.key||'')){")
 anchor=" if(['commercialExtensionCodeRequest'";assert anchor in s
 s=s.replace(anchor," if(commerceAction)result=commercialCommerceRequest_(registry,p);\n else if(['commercialExtensionCodeRequest'",1)
 needle="if(['renew','enable','disable','delete'].includes(input.operation))delete s.bulkAccessBlock;"
 assert needle in s
 s=s.replace(needle,needle+"if(input.operation==='renew'){for(const session of s.sessions||[])delete session.billingOnly;s.invoiceUploadBlocked=false;for(const invoice of s.invoices||[])if(invoice.status==='pending'){invoice.status='approved';invoice.reviewedAt=now();invoice.note='تم تأكيد السداد بالتفعيل اليدوي'}}")
 s=s.replace("version:'2.9.34',ownerAccessControl:true","version:'2.9.38',ownerCommerce:true,ownerAccessControl:true").replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.34','')
 s+='\n'+(root/'commerce/service.gs').read_text()+'\n// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.38\n'
 return s

if __name__=='__main__':
 s=transform((work/'owner-2.9.21.gs').read_text())
 (work/'owner-2.9.38.gs').write_text(s)
 print('Built private owner commerce service 2.9.38; not deployed')
