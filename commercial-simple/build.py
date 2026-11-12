from pathlib import Path
import json,zipfile,shutil,base64,secrets,hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1];src=root/'commercial-simple';work=Path('/tmp/mirsad-commercial');ext=work/'extension'
# Always start from the released stable school build; no personal or calendar pilot files.
if ext.exists():shutil.rmtree(ext)
with zipfile.ZipFile(root/'schools/downloads/Mirsad-Schools-2.6.21-Video-Trial.zip') as z:
 for n in z.namelist():
  if n.startswith('الإضافة/') and not n.endswith('/'):
   p=ext/n.removeprefix('الإضافة/');p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(n))
p=ext/'auto-links.js';t=p.read_text().replace("async function morningWindow(){","async function morningWindow(){const preference=(await chrome.storage.local.get('mirsadSimpleSettings')).mirsadSimpleSettings;if(preference?.refresh===false)return morningStop('تحميل الصباح متوقف حسب اختيارك في الإضافة.');");p.write_text(t)
(ext/'simple').mkdir()
for f in src.glob('*.js'):
 if f.name.endswith('.test.js'):continue
 shutil.copy2(f,ext/'simple'/f.name)
for name in ['popup.html','popup.css']:shutil.copy2(src/name,ext/name)
p=ext/'background.js';p.write_text(p.read_text()+"\nimportScripts('simple/controller.js','simple/daily.js');\n")
p=ext/'manifest.json';m=json.loads(p.read_text());m['version']='2.7.0';m['description']='ثلاث خطوات لرصد المدرسة مع تفعيل البريد والحفظ المحلي والجدول اليومي';m['content_scripts'].append({'matches':['https://mirsad-school.onrender.com/schools/automatic-monitoring.html*'],'js':['simple/site-handoff.js'],'run_at':'document_start'});p.write_text(json.dumps(m,ensure_ascii=False,indent=2))
base=work/'owner-base.gs'
if not base.exists():raise SystemExit('Provide /tmp/mirsad-commercial/owner-base.gs privately before building; never commit the full owner script or its decryption key.')
s=base.read_text();anchor='  extensionLogin(input){';assert anchor in s;s=s.replace(anchor,(src/'registry-methods.inc').read_text()+anchor)
s=s.replace("s.emailVerified=false;const verificationCode","s.emailVerified=false;s.extensionEmailCode=null;const verificationCode")
s=s.replace("websiteLogin(input){const {r,s}=credentials(input,false),key=webSession(s,input);","websiteLogin(input){const {r,s}=credentials(input,false);if(s.simpleSetup)fail('افتح موقع مرصاد من الإضافة؛ دخولك محفوظ فيها','extension-login-required');const key=webSession(s,input);")
# Site sessions minted by the recorder carry a server-enforced read-only flag.
s=s.replace("if(!s.enabled)fail('حساب المدرسة موقوف", "if(role==='admin'){var session=s.sessions.find(x=>x.until>now()&&same(x.hash,hash));if(session?.writerHash&&(!s.device||!same(session.writerHash,a.hash(s.device.writerToken))))fail('انتهت جلسة العرض المرتبطة بالإضافة','invalid-session')}if(!s.enabled)fail('حساب المدرسة موقوف")
anchor='var registry=commercialRegistry_();';assert anchor in s
s=s.replace(anchor,anchor+"if(/^a\\./.test(p.key||'')){var va=registry.authorize(p.key),vs=va.school.sessions.find(function(x){return x.hash===commercialHash_(p.key)});if(vs?.readOnly&&!['adminLogin','dates','day','getTimetableSource','previewTimetable','resetState','scheduleVersions','teacherLink','teachersLive','getAutoLinksControl','videoStatus','commercialWebsiteActivity','commercialDriveStatus','commercialDriveBegin','commercialDriveComplete','commercialEvidence','commercialCustomerPortal'].includes(p.action))throw new Error('الموقع للعرض فقط؛ افتح الإضافة لتغيير الإعدادات')}" )
s=s.replace(" if(p.action==='commercialServiceVersion')", " if(['commercialExtensionCodeRequest','commercialExtensionCodeLogin','commercialRecorderPortal'].includes(p.action))result=commercialSimpleRequest_(registry,p);\n else if(p.action==='commercialServiceVersion')")
s=s.replace("version:'2.6.20',videoRecording:true", "version:'2.7.0',simpleSetup:true,videoRecording:true")
s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.6.20','')+'\n'+(src/'backend-adapter.gs').read_text()+'\n// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.7.0\n'
(work/'owner-2.7.0.gs').write_text(s)
print('Built commercial extension and owner script locally')
