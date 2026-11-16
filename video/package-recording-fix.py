"""Package personal109 from the released108, preserving every unrelated asset."""
from pathlib import Path
import hashlib,json,zipfile
root=Path(__file__).resolve().parents[1]
source=root/'schools/downloads/Mirsad-Teams-0.6.108-Video-Trial.zip'
out=root/'schools/downloads/Mirsad-Teams-0.6.109-Video-Trial.zip'
changed={'الإضافة/manifest.json','الإضافة/popup.html','الإضافة/video/core.js','الإضافة/video/controller.js','ابدأ هنا.txt'}
with zipfile.ZipFile(source) as old,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as new:
 for name in old.namelist():
  data=old.read(name)
  if name=='الإضافة/manifest.json':
   value=json.loads(data);value['version']='0.6.109';data=json.dumps(value,ensure_ascii=False,indent=2).encode()
  elif name=='الإضافة/popup.html':data=data.decode().replace('0.6.108','0.6.109').encode()
  elif name in {'الإضافة/video/core.js','الإضافة/video/controller.js'}:data=(root/name.removeprefix('الإضافة/')).read_bytes()
  elif name=='ابدأ هنا.txt':data='مرصاد الخاص 0.6.109: ينتظر اكتمال فحص عدد الدورة وإغلاق التشييك ثم يطلب التسجيل فورًا. لا يشترط حضور الجميع. أوقف الرصد واستبدل ملفات الإضافة دون حذفها ثم أعد التحميل وتهيئة الفيديو. لا يحتاج تحديث خدمة قوقل أو المساعد المحلي لهذا الإصلاح. اختبارات آلية ناجحة؛ جرّب الصوت والصورة في Teams فعليًا.\n\n'.encode()+data
  new.writestr(name,data)
with zipfile.ZipFile(source) as old,zipfile.ZipFile(out) as new:
 assert new.testzip() is None
 assert set(old.namelist())==set(new.namelist())
 assert all(old.read(n)==new.read(n) for n in old.namelist() if n not in changed)
out.with_name('Mirsad-Teams-0.6.109-CHECKSUMS.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
print('Packaged personal109; unrelated runtime and helper assets preserved byte-for-byte')
