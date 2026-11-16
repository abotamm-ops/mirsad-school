from pathlib import Path
import runpy
root=Path(__file__).resolve().parents[1];work=Path('/tmp/mirsad-commercial')
def transform(s):
 anchor='  requestExtensionCode(input){';assert s.count(anchor)==1
 s=s.replace(anchor,(root/'multisite/registry.inc').read_text()+anchor)
 s=s.replace('pinHash:commercialWebsitePinHash_,','pinHash:commercialWebsitePinHash_,discoverCampus:commercialDiscoverCampus_,ensureCampus:commercialEnsureCampus_,checkCampusReady:commercialCampusReady_,deleteCampus:commercialDeleteCampus_,')
 anchor=" else if(['commercialExtensionCodeRequest'";assert anchor in s
 s=s.replace(anchor," else if(['commercialSchoolSpaces','commercialSelectSchool','commercialMonitorSession','commercialResetUsername'].includes(p.action))result=commercialMultiRequest_(registry,p);\n"+anchor)
 s=s.replace("'commercialEvidence','commercialCustomerPortal'","'commercialEvidence','commercialServiceVersion','commercialSchoolSpaces','commercialCustomerPortal'")
 s=s.replace("version:'2.9.38',ownerCommerce:true","version:'2.9.44',multiSchoolAccounts:true,oneActiveSchool:true,ownerCommerce:true")
 # Resolve every attendance/report/video action to the requested authorized school space.
 anchor="if(actor.role==='recorder'&&p.action==='heartbeat')";assert anchor in s
 s=s.replace(anchor,"actor=commercialCampusActor_(actor,p);commercialMultiBefore_(p,actor);"+anchor)
 anchor="result.schoolId=actor.school.id;";assert anchor in s
 s=s.replace(anchor,"result.schoolId=actor.school.id;result=commercialMultiAfter_(p,result,actor);")
 anchor="result={role:'admin',authMode:'school-session',school:registry.websiteAccess(p.key).school}"
 assert anchor in s;s=s.replace(anchor,anchor+";result=commercialMultiAfter_(p,result,actor)")
 s=s.replace('result=registry.settings(p.key,p.profile);','result=registry.spaceSettings(p.key,p);')
 # Scoped disk settings and cached reports must never share the account's active space.
 s=s.replace('cache.properties[c.school.id]',"cache.properties[c.school.id+':'+(c.school._site?.localId||'legacy')]")
 s=s.replace("prefix='school:'+COMMERCIAL_CONTEXT_.school.id+':'", "prefix='school:'+COMMERCIAL_CONTEXT_.school.id+':'+(COMMERCIAL_CONTEXT_.school._site?.localId||'legacy')+':'")
 old="function commercialStorageFor_(school,date){var linked=schoolDriveUses_(school,date);return {remote:linked,rootId:linked?schoolDriveLink_(school.id).rootId:school.rootId}}"
 new="function commercialStorageFor_(school,date){var linked=schoolDriveUses_(school,date),site=school._site,rootId=site?(linked?site.remoteRootId:site.localRootId):(linked?schoolDriveLink_(school.id).rootId:school.rootId);if(!rootId)commercialMultiError_('افتح قائمة المدارس لتجهيز مساحة حفظ المدرسة','site-storage-required');return {remote:linked,rootId:rootId}}"
 assert old in s;s=s.replace(old,new)
 old="var dates={},roots=[{remote:false,rootId:school.rootId}],link=schoolDriveLink_(school.id);if(link)roots.push({remote:true,rootId:link.rootId});"
 new="var dates={},roots=[{remote:false,rootId:school.rootId}],link=schoolDriveLink_(school.id);if(link&&school._site?.remoteRootId)roots.push({remote:true,rootId:school._site.remoteRootId});else if(link&&!school._site)roots.push({remote:true,rootId:link.rootId});"
 assert old in s;s=s.replace(old,new)
 # Media configuration and files belong to the workspace, never the account root.
 s=s.replace('root=drive.getFolderById(link.rootId)', 'root=drive.getFolderById(commercialVideoRoot_(school,link))')
 s=s.replace('لاستخدامها في جهاز آخر، سجّل الخروج من الإضافة في الجهاز الأول.', 'يمكن تفعيل أجهزة غير محدودة؛ أوقف الرصد على الجهاز السابق قبل تشغيله على جهاز آخر.')
 s=s.replace('function commercialReadProgress_(school){','function commercialReadProgress_(school){school=commercialMultiSchool_(school);')
 # Login to a brand-new account has no active school yet; it has no handover.
 s=s.replace('school=commercialMultiSchool_(school);var folder=',"if(school.campuses&&!school.activeSiteId)return null;school=commercialMultiSchool_(school);var folder=")
 s=s.replace('var storage=commercialStorageFor_(actor.school,p.date),drive=',"actor=commercialCampusActor_(actor,p);var storage=commercialStorageFor_(actor.school,p.date),drive=")
 s=s.replace('s.device=null','s.monitorLease=null;s.device=null')
 s=s.replace("next.sourceType='madrasati';","next.sourceType='madrasati';next.siteId=COMMERCIAL_CONTEXT_?.school?._site?.id||payload.schoolId;")
 # Account-facing profile is the current school's profile; subscription identity stays the same.
 s=s.replace('profile:{...s.profile},enabled:',"profile:{...(s._site?.profile||s.campuses?.find(x=>x.id===s.activeSiteId)?.profile||s.profile)},activeSiteId:s.activeSiteId||null,sites:(s.campuses||[]).map(x=>({id:x.id,localId:x.localId,legacy:!!x.legacy,profile:x.profile})),enabled:")
 a=s.index('  authorizeView(key){');b=s.index('\n',a)
 s=s[:a]+"  authorizeView(key){const m=/^v\\.([a-f0-9-]{36})\\.[a-f0-9]{64}$/.exec(String(key||'')),s=m&&load().schools.find(s=>s.id===m[1]);if(!s||s.deletedAt||!s.enabled)fail('رابط مشاهدة غير صالح');if(s.campuses){const site=[...s.campuses,...(s.archives||[])].find(x=>!x.deletedAt&&same(x.viewerToken||'',key));if(!site)fail('رابط مشاهدة غير صالح');return {school:s,role:'viewer',siteId:site.archiveId||site.id}}if(!same(s.viewerToken,key))fail('رابط مشاهدة غير صالح');return {school:s,role:'viewer'}},"+s[b:]
 s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.38','')
 s=s+'\n'+(root/'multisite/service.gs').read_text()+'\n// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.53\n'
 return runpy.run_path(str(root/'multisite/devices.py'))['transform'](s)
if __name__=='__main__':
 base=runpy.run_path(str(root/'commerce/build.py'))['transform']((work/'owner-2.9.21.gs').read_text())
 (work/'owner-2.9.53.gs').write_text(transform(base));print('Prepared service 2.9.53 privately; not deployed')
