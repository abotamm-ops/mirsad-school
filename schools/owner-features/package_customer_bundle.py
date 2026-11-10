from pathlib import Path
import zipfile,json,hashlib
root=Path(__file__).resolve().parents[2];downloads=root/'schools/downloads'
name='Mirsad-Schools-2.3.3.7-with-Guardian-3.4.6.zip';out=downloads/name
with zipfile.ZipFile(downloads/'Mirsad-Schools-2.3.3.7.zip') as old,zipfile.ZipFile(downloads/'Mirsad-Schools-Guardian-3.4.6.zip') as helper,zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for info in old.infolist():
  if info.filename.startswith('الإضافة/') or info.filename.startswith('تطبيق مرصاد/.support/') or info.filename=='تطبيق مرصاد/بدء مرصاد.cmd':z.writestr(info,old.read(info.filename))
 z.writestr('تطبيق مرصاد/MirsadChromeGuardian.exe',helper.read('MirsadChromeGuardian/MirsadChromeGuardian.exe'))
 z.writestr('تطبيق مرصاد/شرح المساعد.txt',helper.read('MirsadChromeGuardian/اقرأ.txt'))
 z.writestr('اقرأ أولًا.txt','''مرصاد المدارس: الإضافة 2.3.3.7 والمساعد 3.4.6
للترقية: أوقف الرصد مؤقتًا، وانسخ محتويات «الإضافة» إلى مجلد إضافتك الحالي مع الاستبدال، ثم أعد تحميلها من chrome://extensions. لا تحذف الإضافة ولا تصفّر اليوم.
أغلق المساعد القديم بـ Ctrl+Shift+Q، ثم استخدم التطبيق الموجود في «تطبيق مرصاد».
أول استخدام على الجهاز: شغّل «بدء مرصاد.cmd» لتجهيز النسخة المحلية وفتح التطبيق. بعد ذلك شغّل MirsadChromeGuardian.exe للاستخدام اليومي.
تظهر لوحة المساعد أولًا؛ اختر «مرصاد ومدرستي» أو «مرصاد فقط»، ثم اضغط تشغيل.
إيقاف يحرر الشاشة ويبقي اللوحة. الخط يصغرها إلى شريط المهام. × أو إغلاق أو Ctrl+Shift+Q ينهي المساعد.
الحزمة للمدارس فقط، ولا تحتوي على سكربت المالك أو إعداداته.
''')
with zipfile.ZipFile(downloads/'Mirsad-Schools-2.3.3.7.zip') as old,zipfile.ZipFile(downloads/'Mirsad-Schools-Guardian-3.4.6.zip') as helper,zipfile.ZipFile(out) as z:
 assert z.testzip() is None
 assert json.loads(z.read('الإضافة/manifest.json'))['version']=='2.3.3.7'
 assert json.loads(z.read('الإضافة/manifest.json'))['key']
 for n in old.namelist():
  if n.startswith('الإضافة/') or '/.support/' in n:assert z.read(n)==old.read(n)
 assert z.read('تطبيق مرصاد/MirsadChromeGuardian.exe')==helper.read('MirsadChromeGuardian/MirsadChromeGuardian.exe')
 assert not any(n.endswith(('.gs','.ps1')) or 'START-VISIBLE' in n or 'OWNER-ONLY' in n for n in z.namelist())
(downloads/'CHECKSUMS-SCHOOLS-BUNDLE-2.3.3.7.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+name+'\n')
for page in ['schools/index.html','schools/school-settings.html']:
 p=root/page;s=p.read_text();s=s.replace('Mirsad-Schools-2.3.3.7.zip',name).replace('Mirsad-Schools-2.3.3.zip',name).replace('الإصدار 2.3.3 · حزمة ZIP','الإضافة 2.3.3.7 والمساعد 3.4.6 · حزمة ZIP');p.write_text(s)
print('PASS current school extension, fixed identity, exact guardian 3.4.6 and local backup support; no old PS/console launcher')
