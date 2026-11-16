from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[1];source=root/'schools/downloads/Mirsad-Teams-0.6.107-Video-Trial.zip';out=root/'schools/downloads/Mirsad-Teams-0.6.108-Video-Trial.zip'
with zipfile.ZipFile(source) as old,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as new:
 for name in old.namelist():
  data=old.read(name)
  if name=='الإضافة/manifest.json':
   m=json.loads(data);m['version']='0.6.108';data=json.dumps(m,ensure_ascii=False,indent=2).encode()
  elif name=='الإضافة/popup.html':data=data.decode().replace('0.6.107','0.6.108').encode()
  elif name=='الإضافة/video/popup.js':data=(root/'video/personal-video-popup.js').read_bytes()
  elif name=='ابدأ هنا.txt':data='مرصاد الخاص 0.6.108 — مربع تهيئة الفيديو المختصر مثل نسخة المدارس. استبدل الملفات وأعد تحميل الإضافة دون حذفها. لا يلزم تحديث خدمة قوقل لهذا التعديل.\n\n'.encode()+data
  new.writestr(name,data)
with zipfile.ZipFile(source) as old,zipfile.ZipFile(out) as new:
 assert new.testzip() is None
 changed={'الإضافة/manifest.json','الإضافة/popup.html','الإضافة/video/popup.js','ابدأ هنا.txt'}
 assert all(old.read(n)==new.read(n) for n in old.namelist() if n not in changed)
(root/'schools/downloads/Mirsad-Teams-0.6.108-CHECKSUMS.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
print('Personal 0.6.108: compact video toggle; recording, wake protection and all other assets unchanged')
