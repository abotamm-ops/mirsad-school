"""Add power protection to the released personal build, preserving its runtime/assets."""
from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[1]
source=root/'schools/downloads/Mirsad-Teams-0.6.104-Video-Trial.zip'
out=root/'schools/downloads/Mirsad-Teams-0.6.106-Video-Trial.zip'
code=(root/'commercial-simple/keep-awake.js').read_text()
code=code.replace("const keys=['mirsadAutoRun','mirsadSimpleDaily','mirsadSimpleRunControl','mirsadDriveConfig'];", "const keys=['mirsadAutoRun'];")
start=code.index(' function needed(s)');end=code.index('\n function refresh()',start)
code=code[:start]+" function needed(s){const run=s.mirsadAutoRun;return !!run?.running&&!run.paused}"+code[end:]
assert 'mirsadSimpleDaily' not in code and 'mirsadDriveConfig' not in code
work=Path('/tmp/mirsad-personal-power');work.mkdir(exist_ok=True);(work/'keep-awake.js').write_text(code)
with zipfile.ZipFile(source) as original,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as target:
 for name in original.namelist():
  data=original.read(name)
  if name=='الإضافة/manifest.json':
   m=json.loads(data);m['version']='0.6.106';m['permissions']=list(dict.fromkeys(m.get('permissions',[])+['power']));data=json.dumps(m,ensure_ascii=False,indent=2).encode()
  elif name=='الإضافة/background.js':data+=b"\nimportScripts('keep-awake.js');\n"
  elif name=='الإضافة/popup.html':
   text=data.decode().replace('0.6.104','0.6.106')
   notice='<p class="hint" style="margin:4px 0">امنع سكون الشاشة ومهلة الشاشة بالضغط على «أبدًا».</p>'
   assert '<main>' in text
   data=text.replace('<main>','<main>'+notice,1).encode()
  elif name=='ابدأ هنا.txt':
   data=('مرصاد الخاص 0.6.106 — حماية السكون والشاشة\nاستبدل ملفات الإضافة في نفس المجلد وأعد تحميلها من chrome://extensions؛ لا تحذفها. وافق على الصلاحية الجديدة إذا طلبها كروم. تمنع الإضافة السكون وإطفاء الشاشة أثناء الرصد والانتظار، وتحرر المنع عند الإيقاف أو الإيقاف المؤقت. اترك كروم يعمل والجهاز على الشاحن؛ لا تغلق غطاء المحمول. تحديث الحماية لا يحتاج تعديلًا إضافيًا لخدمة Google.\n\n').encode('utf-8')+data
  target.writestr(name,data)
 target.writestr('الإضافة/keep-awake.js',code.encode())
with zipfile.ZipFile(source) as old,zipfile.ZipFile(out) as new:
 assert new.testzip() is None
 changed={'الإضافة/manifest.json','الإضافة/background.js','الإضافة/popup.html','ابدأ هنا.txt'}
 assert all(old.read(n)==new.read(n) for n in old.namelist() if n not in changed)
(root/'schools/downloads/Mirsad-Teams-0.6.106-CHECKSUMS.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
print('Built personal 0.6.106 from stable 0.6.104; all unrelated files byte-identical')
