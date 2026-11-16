"""Build a private owner handoff; publish only the encrypted outer archive."""
from pathlib import Path
import base64,hashlib,json,secrets,shutil,subprocess,zipfile
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1]
work=Path('/tmp/rased-project-handoff');stage=work/'Rased-Project'
if stage.exists():shutil.rmtree(stage)
stage.mkdir(parents=True,exist_ok=True)
# Fresh output, never read credential directories or Git history.
if (stage/'SOURCE').exists():shutil.rmtree(stage/'SOURCE')
files=subprocess.check_output(['git','ls-files','--cached','--others','--exclude-standard','-z'],cwd=root).decode().split('\0')
for name in sorted(set(filter(None,files))):
 p=Path(name)
 if '/downloads/' in '/'+name or name.startswith('downloads/') or p.name.startswith(('owner-script','private-video-script')):continue
 if p.suffix.lower() in {'.zip','.exe','.pdf','.pyc'}:continue
 source=root/p
 if not source.is_file():continue
 dest=stage/'SOURCE'/p;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,dest)
for p in (root/'handoff').glob('*'):
 if p.is_file():shutil.copy2(p,stage/p.name)
shutil.copy2(root/'handoff/AI_HANDOFF.md',stage/'AGENTS.md')
releases=[
 'schools/downloads/Mirsad-Schools-2.9.52-Setup.zip',
 'schools/downloads/Mirsad-Teams-0.6.109-Video-Trial.zip',
 'schools/downloads/Rased-Schools-Store-Support-3.4.7.zip',
 'schools/downloads/Rased-Schools-2.9.31-Chrome-Store.zip',
 'schools/downloads/Rased-Schools-Owner-Script-2.9.44.zip',
]
(stage/'RELEASES').mkdir(exist_ok=True)
for name in releases:shutil.copy2(root/name,stage/'RELEASES'/Path(name).name)
# Stable archive dependencies needed by the existing build scripts.
for name in ['Mirsad-Schools-2.6.21-Video-Trial.zip','Rased-Schools-Store-Support-3.4.7.zip','Mirsad-Teams-0.6.107-Video-Trial.zip','Mirsad-Teams-0.6.108-Video-Trial.zip','Mirsad-Schools-2.9.43-Setup.zip','Mirsad-Schools-2.9.52-Setup.zip','Mirsad-Teams-0.6.81.6.zip','Mirsad-Schools-2.3.3.7.zip']:
 dest=stage/'SOURCE/schools/downloads'/name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(root/'schools/downloads'/name,dest)
for release,edition in [(releases[0],'schools-2.9.52'),(releases[1],'personal-0.6.109'),('schools/downloads/Mirsad-Schools-2.9.43-Setup.zip','schools-2.9.43')]:
 dest=stage/'EXTENSIONS'/edition
 if dest.exists():shutil.rmtree(dest)
 with zipfile.ZipFile(root/release) as z:
  for name in z.namelist():
   if not name.startswith('الإضافة/') or name.endswith('/'):continue
   rel=Path(name.removeprefix('الإضافة/'));assert '..' not in rel.parts
   p=dest/rel;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(z.read(name))
(stage/'BACKEND').mkdir(exist_ok=True)
for version in ['2.9.21','2.9.32','2.9.34','2.9.38','2.9.40','2.9.44']:
 source=Path('/tmp/mirsad-commercial')/f'owner-{version}.gs'
 assert source.exists(),'Supply the private owner service snapshot locally; never commit plaintext.'
 shutil.copy2(source,stage/'BACKEND'/source.name)
# The private edition service's protected viewer is included without its key.
for p in (root/'schools').glob('private-video-script-0.6.103*'):
 dest=stage/'RELEASES/private-service-protected'/p.name;dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
head=subprocess.check_output(['git','rev-parse','HEAD'],cwd=root,text=True).strip()
(stage/'SNAPSHOT.json').write_text(json.dumps({'sourceCommit':head,'format':2,'workingTreeIncluded':True,'latestSession':'LATEST_SESSION.md','includesGitHistory':False,'includesLivePropertyExports':False,'ownerPrivateSourceIncluded':True},indent=2)+'\n')
manifest=[]
for p in sorted(stage.rglob('*')):
 if p.is_file() and p.name!='FILES.sha256':manifest.append(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+p.relative_to(stage).as_posix())
(stage/'FILES.sha256').write_text('\n'.join(manifest)+'\n')
plain=work/'Rased-Project-2026-11-16.zip'
with zipfile.ZipFile(plain,'w',zipfile.ZIP_DEFLATED) as z:
 for p in sorted(stage.rglob('*')):
  if p.is_file():z.write(p,'Rased-Project/'+p.relative_to(stage).as_posix())
with zipfile.ZipFile(plain) as z:
 assert z.testzip() is None
 assert 'Rased-Project/BACKEND/owner-2.9.44.gs' in z.namelist()
 assert 'Rased-Project/EXTENSIONS/schools-2.9.52/manifest.json' in z.namelist()
 assert 'Rased-Project/EXTENSIONS/personal-0.6.109/manifest.json' in z.namelist()
key=secrets.token_bytes(32);opening=base64.urlsafe_b64encode(key).decode().rstrip('=');nonce=secrets.token_bytes(12)
cipher=AESGCM(key).encrypt(nonce,plain.read_bytes(),None)
assert AESGCM(key).decrypt(nonce,cipher,None)==plain.read_bytes()
value={'nonce':base64.b64encode(nonce).decode(),'data':base64.b64encode(cipher).decode()}
html='''<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>فتح مشروع راصد — للمالك فقط</title><style>body{font:17px/1.9 Tahoma,Arial;max-width:800px;margin:40px auto;padding:20px;background:#edf3f6;color:#183c4b}input,button{font:inherit;padding:12px;box-sizing:border-box;width:100%;margin:7px 0}button{background:#087f73;color:white;border:0;border-radius:6px}input{direction:ltr}p{overflow-wrap:anywhere}</style><h1>مشروع راصد الكامل — خاص بالمالك</h1><p>هذا المجلد يحتوي كود المشروع وخدمة المالك، وليس حزمة العملاء. لا تنشر المجلد بعد فتحه ولا ترسله للمدارس. افتحه ثم اقرأ «00-ابدأ-هنا.md»، ويمكنك تسليمه لمساعدك أو مطوّرك الموثوق.</p><form id="form"><label>مفتاح الفتح الخاص الموجود في المحادثة<input id="key" type="password" required autocomplete="off"></label><button id="button">فتح وتنزيل مجلد المشروع ZIP</button></form><p id="state" role="status"></p><script id="payload" type="application/json">PAYLOAD</script><script>
const form=document.getElementById('form'),button=document.getElementById('button'),state=document.getElementById('state');form.onsubmit=async event=>{event.preventDefault();button.disabled=true;state.textContent='جارٍ فتح المشروع والتحقق منه…';try{const text=document.getElementById('key').value.trim();if(!/^[A-Za-z0-9_-]{43}$/.test(text))throw Error('انسخ مفتاح الفتح كاملًا.');const bytes=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0)),value=JSON.parse(document.getElementById('payload').textContent),key=await crypto.subtle.importKey('raw',bytes(text.replace(/-/g,'+').replace(/_/g,'/')+'='),'AES-GCM',false,['decrypt']),plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(value.nonce)},key,bytes(value.data)),zip=new Uint8Array(plain);if(zip[0]!==80||zip[1]!==75)throw Error('تعذر التحقق من الحزمة');const url=URL.createObjectURL(new Blob([zip],{type:'application/zip'})),a=document.createElement('a');a.href=url;a.download='Rased-Project-2026-11-16.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);document.getElementById('key').value='';state.textContent='تم تجهيز وتنزيل المشروع. فك ضغط ZIP، ثم اقرأ ملف ابدأ هنا. إذا لم يبدأ التنزيل اضغط الزر مجددًا.'}catch(error){state.textContent=error.name==='OperationError'?'مفتاح الفتح غير صحيح.':error.message}finally{button.disabled=false}};
</script></html>'''.replace('PAYLOAD',json.dumps(value,separators=(',',':')))
out=root/'schools/downloads/Rased-Project-Handoff-2026-11-16-v3.zip'
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 z.writestr('افتح مشروع راصد.html',html.encode())
 z.writestr('ابدأ هنا.txt','فك الضغط وافتح ملف HTML في Chrome أو Edge، ثم الصق مفتاح الفتح الخاص من المحادثة. سينزل ملف ZIP يحتوي المشروع. فك ضغطه واقرأ ملف ابدأ هنا. هذا مشروع المالك وليس حزمة العملاء. لا تضع المفتاح مع الحزمة عند مشاركتها.\n'.encode('utf-8-sig'))
assert opening.encode() not in out.read_bytes()
out.with_suffix('.sha256.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
(work/'OPENING-KEY.txt').write_text(opening+'\n')
(work/'open.html').write_text(html)
print(json.dumps({'sourceFiles':len(manifest),'plainZipBytes':plain.stat().st_size,'encryptedZipBytes':out.stat().st_size,'output':str(out)},ensure_ascii=False))
