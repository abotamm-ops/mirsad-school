from pathlib import Path
import runpy
root=Path(__file__).resolve().parents[1]
def transform(s):
 anchor='  requestExtensionCode(input){';assert s.count(anchor)==1
 s=s.replace(anchor,(root/'binding/registry.inc').read_text()+anchor)
 s=s.replace('pinHash:commercialWebsitePinHash_,','pinHash:commercialWebsitePinHash_,bindingId:commercialBindingId_,')
 anchor=" else if(['commercialExtensionCodeRequest'";assert anchor in s
 s=s.replace(anchor," else if(p.action==='commercialResetUsername')result=registry.resetUsername(p.key,p);\n else if(p.action==='commercialSchoolBinding')result=registry.recorderBinding(p);\n"+anchor)
 # Existing source files remain historical evidence. Only an explicit account-specific
 # binding permits importing the new ID, and the old ID can no longer be imported.
 for old in ['source.schoolId.toLowerCase()!==payload.schoolId.toLowerCase()', 'boundSchool.toLowerCase()!==payload.schoolId.toLowerCase()']:
  assert old in s
  left=old.split('.toLowerCase()')[0]
  s=s.replace(old,'!commercialBindingMatches_('+left+',payload.schoolId)')
 anchor="else{result=p.action==='dates'?schoolDriveDates_(actor.school):monitorRequest_(p);result.schoolId=actor.school.id;"
 assert anchor in s
 s=s.replace(anchor,"else{commercialBindingBefore_(p);result=p.action==='dates'?schoolDriveDates_(actor.school):monitorRequest_(p);result=commercialBindingAfter_(registry,p,result);result.schoolId=actor.school.id;")
 s=s.replace("version:'2.9.38',ownerCommerce:true","version:'2.9.40',recorderSchoolBinding:true,ownerCommerce:true")
 s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.38','')
 return s+'\n'+(root/'binding/service.gs').read_text()+'\n// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.40\n'
if __name__=='__main__':
 source=runpy.run_path(str(root/'commerce/build.py'))['transform']((Path('/tmp/mirsad-commercial/owner-2.9.21.gs')).read_text())
 Path('/tmp/mirsad-commercial/owner-2.9.40.gs').write_text(transform(source))
 print('Prepared private school-binding service 2.9.40; not deployed')
