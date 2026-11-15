"""Patch the private 2.9.21 owner service; no plaintext is written to the repository."""
from pathlib import Path
root=Path(__file__).resolve().parents[1];work=Path('/tmp/mirsad-commercial')
def transform(s):
 anchor='  requestExtensionCode(input){';assert s.count(anchor)==1
 s=s.replace(anchor,(root/'commercial-simple/access-control.inc').read_text()+anchor)
 for anchor in ['requestExtensionCode(input){const r=load(),mail=email(input.email),','extensionCodeLogin(input){const r=load(),mail=email(input.email);']:
  assert anchor in s
  # Gate both requesting and redeeming a code so an outstanding code cannot bypass a closure.
  s=s.replace(anchor,anchor+"if(r.accessControl?.registrationOpen===false&&!r.schools.some(x=>!x.deletedAt&&x.email===mail))fail('التسجيل الجديد موقوف من إدارة راصد؛ تواصل مع الإدارة','registration-closed');" if anchor.endswith(';') else anchor.replace('const r=load(),mail=email(input.email),','const r=load(),mail=email(input.email);')+"if(r.accessControl?.registrationOpen===false&&!r.schools.some(x=>!x.deletedAt&&x.email===mail))fail('التسجيل الجديد موقوف من إدارة راصد؛ تواصل مع الإدارة','registration-closed');const ")
 anchor=" else if(p.action==='commercialOwnerPortal')";assert anchor in s
 s=s.replace(anchor," else if(p.action==='commercialOwnerAccessControl')result=registry.ownerAccessControl(p.key,p.control);\n"+anchor)
 s=s.replace("version:'2.9.21',simpleSetup:true","version:'2.9.34',ownerAccessControl:true,ownerBulkRestore:true,simpleSetup:true")
 s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.21','// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.34')
 # Explicit per-account decisions take precedence over a later bulk undo.
 needle="else fail('عملية غير صالحة','validation');save(r);return {school:publicSchool(s),...(code?{activationCode:code}:{}),...extra}"
 assert needle in s
 s=s.replace(needle,"else fail('عملية غير صالحة','validation');if(['renew','enable','disable','delete'].includes(input.operation))delete s.bulkAccessBlock;save(r);return {school:publicSchool(s),...(code?{activationCode:code}:{}),...extra}")
 return s

if __name__=='__main__':
 s=transform((work/'owner-2.9.21.gs').read_text())
 (work/'owner-2.9.34.gs').write_text(s)
 print('Built owner access control update privately')
