from pathlib import Path
import json,zipfile,shutil,base64,secrets,hashlib,sys
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
p=ext/'background.js';p.write_text(p.read_text()+"\nimportScripts('simple/cycle-runtime.js','simple/controller.js','simple/daily.js');\n")
p=ext/'manifest.json';m=json.loads(p.read_text());m['version']='2.9.26';m['name']='راصد — المدارس';m['short_name']='راصد';m['description']='خمس خطوات لرصد المدرسة مع تفعيل البريد والحفظ المحلي والجدول اليومي';m['content_scripts'].append({'matches':['https://mirsad-school.onrender.com/schools/automatic-monitoring.html*'],'js':['simple/site-handoff.js'],'run_at':'document_start'});p.write_text(json.dumps(m,ensure_ascii=False,indent=2))
# Rebrand displayed Arabic text only; protocol IDs, keys and storage paths remain stable.
for asset in ext.rglob('*'):
 if asset.is_file() and asset.suffix in {'.js','.html','.json'}:
  text=asset.read_text();asset.write_text(text.replace('مرصاد','راصد'))
if '--extensions-only' in sys.argv:
 print('Built extension only; owner script unchanged.')
 raise SystemExit(0)
base=work/'owner-base.gs'
if not base.exists():raise SystemExit('Provide /tmp/mirsad-commercial/owner-base.gs privately before building; never commit the full owner script or its decryption key.')
s=base.read_text();s=s.replace('passwordHash:function(password,salt,iterations){return MirsadPasswords.derive(password,salt,iterations)},','passwordHash:function(password,salt,iterations){return MirsadPasswords.derive(password,salt,iterations)},pinHash:commercialWebsitePinHash_,');anchor='  extensionLogin(input){';assert anchor in s;s=s.replace(anchor,(src/'registry-methods.inc').read_text()+anchor)
s=s.replace('email:s.email,profile:', 'email:s.email,accessMode:s.accessMode||"paid",selfRegistered:s.selfRegistered===true,sitePinReady:!!s.websitePin,subscriptionMessage:s.subscriptionMessage||"",messageAt:s.messageAt||null,profile:')
s=s.replace("s.emailVerified=false;const verificationCode","s.emailVerified=false;s.extensionEmailCode=null;const verificationCode")
s=s.replace("s.expiresAt=month(Math.max(now(),s.expiresAt));code=issueCode(s)","s.expiresAt=month(now());s.accessMode='paid';s.enabled=true;code=issueCode(s)")
s=s.replace("websiteLogin(input){const {r,s}=credentials(input,false),key=webSession(s,input);","websiteLogin(input){const {r,s}=credentials(input,false);if(s.simpleSetup)fail('افتح موقع مرصاد من الإضافة؛ دخولك محفوظ فيها','extension-login-required');const key=webSession(s,input);")
# PIN sessions survive recorder logout, are read-only and revoke on PIN change.
s=s.replace("if(!s.enabled)fail('حساب المدرسة موقوف", "if(role==='admin'){var pinSession=s.sessions.find(x=>x.until>now()&&same(x.hash,hash));if(pinSession?.websitePin&&pinSession.pinVersion!==s.websitePin?.version)fail('تم تغيير الرقم السري؛ ادخل مجددًا','invalid-session')}if(!s.enabled)fail('حساب المدرسة موقوف")
s=s.replace("school:registry.settings(p.key).school", "school:registry.websiteAccess(p.key).school")
# Site sessions minted by the recorder carry a server-enforced read-only flag.
s=s.replace("if(!s.enabled)fail('حساب المدرسة موقوف", "if(role==='admin'){var session=s.sessions.find(x=>x.until>now()&&same(x.hash,hash));if(session?.writerHash&&(!s.device||!same(session.writerHash,a.hash(s.device.writerToken))))fail('انتهت جلسة العرض المرتبطة بالإضافة','invalid-session')}if(!s.enabled)fail('حساب المدرسة موقوف")
anchor='var registry=commercialRegistry_();';assert anchor in s
s=s.replace(anchor,anchor+"if(/^a\\./.test(p.key||'')){var va=registry.authorize(p.key),vs=va.school.sessions.find(function(x){return x.hash===commercialHash_(p.key)});if(vs?.readOnly&&!['adminLogin','dates','day','getTimetableSource','previewTimetable','resetState','scheduleVersions','teacherLink','teachersLive','getAutoLinksControl','videoStatus','videoConfigure','commercialWebsiteActivity','commercialDriveStatus','commercialDriveBegin','commercialDriveComplete','commercialEvidence','commercialCustomerPortal','commercialWebsiteLogout'].includes(p.action))throw new Error('الموقع للعرض فقط؛ افتح الإضافة لتغيير الإعدادات')}" )
s=s.replace(" if(p.action==='commercialServiceVersion')", " if(['commercialExtensionCodeRequest','commercialExtensionCodeLogin','commercialRecorderPortal','commercialRecorderStatus','commercialManageAccess','commercialRecorderSignout','commercialSetWebsitePin','commercialWebsitePinLogin'].includes(p.action))result=commercialSimpleRequest_(registry,p);\n else if(p.action==='commercialServiceVersion')")
s=s.replace("result=commercialSendCredentials_(registry.manage(p.key,p));","{result=commercialSendCredentials_(registry.manage(p.key,p));if(p.operation==='disable')result=commercialAccessNotice_(result);}")
s=s.replace('return monitorVideoRequest_(p,props,monitorPrivate_(DriveApp.getFolderById(MONITOR_ROOT)),writer,siteReader)', 'return commercialVideoRequest_(p,props,writer,siteReader)')
s=s.replace('snapshot:function(){var f=monitorScheduleFolder_(attendanceRoot,date,false)', 'snapshot:function(){var selectedRoot=typeof attendanceRoot==="function"?attendanceRoot():attendanceRoot;var f=monitorScheduleFolder_(selectedRoot,date,false)')
s=s.replace("version:'2.6.20',videoRecording:true", "version:'2.9.21',simpleSetup:true,selfRegistration:true,monthlySubscription:100,videoRecording:true")
s=s.replace('// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.6.20','')+'\n'+(src/'backend-adapter.gs').read_text()+'\n// END MIRSAD SCHOOLS COMPLETE SCRIPT 2.9.21\n'
(work/'owner-2.9.21.gs').write_text(s)
print('Built commercial extension and owner script locally')
