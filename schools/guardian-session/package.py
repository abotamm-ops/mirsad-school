from pathlib import Path
import zipfile,struct,hashlib
root=Path(__file__).resolve().parents[2]
checks=[]
for edition in ['Shared','Schools']:
 build=Path('/tmp/mirsad-guardian-session-build')/edition
 exe=(build/'MirsadChromeGuardian.exe').read_bytes()
 off=struct.unpack_from('<I',exe,0x3c)[0]
 assert exe[off:off+4]==b'PE\0\0'
 assert struct.unpack_from('<H',exe,off+4)[0]==0x8664
 assert struct.unpack_from('<H',exe,off+24+68)[0]==2,'Console subsystem unexpectedly enabled'
 assert (build/'MirsadChromeGuardian.ps1').read_bytes()==(root/'schools/guardian-session'/f'{edition}.ps1').read_bytes()
 launcher=(build/'launcher_windows.go').read_text()
 assert 'HideWindow: true' in launcher and 'CreationFlags: 0x08000000' in launcher
 out=root/'schools/downloads'/f'Mirsad-{edition}-Guardian-3.4.5.zip'
 with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
  z.writestr('MirsadChromeGuardian/MirsadChromeGuardian.exe',exe)
  z.writestr('MirsadChromeGuardian/اقرأ.txt','''مساعد مرصاد 3.4.5
أغلق المساعد القديم أولاً بـ Ctrl+Shift+Q.
فك الضغط بالكامل وشغّل MirsadChromeGuardian.exe فقط.
لا توجد ملفات PowerShell أو START-VISIBLE للتشغيل.
في القائمة داخل اللوحة اختر «مرصاد ومدرستي» لاسترجاع النافذة السابقة، أو «مرصاد فقط» لفتح مرصاد دون طلب استرجاع التبويبات. يُحفظ اختيارك للمرة القادمة، ويمكن تغييره من اللوحة.
في وضع «مرصاد ومدرستي»، عند غياب مرصاد يحاول استرجاع آخر تبويب/نافذة مغلقة في كروم، وعند إغلاق كروم يحاول استرجاع الجلسة الأخيرة بحساب الرصد المحدد. ينتظر للتحقق من مرصاد قبل فتح رابط جديد إذا لم يعد من الجلسة.
استرجاع التبويبات يعتمد على سجل جلسة كروم؛ التصفح الخفي أو انتهاء تسجيل الدخول في مدرستي لا يمكن استعادتهما بهذه الطريقة.
تشغيل: الحماية بالمقدمة. إيقاف: تحرير الشاشة وإبقاء اللوحة.
الخط: تصغير اللوحة إلى شريط المهام. × أو إغلاق أو Ctrl+Shift+Q: إنهاء المساعد مع إبقاء كروم.
Ctrl+Shift+P إيقاف / Ctrl+Shift+M تشغيل.
''')
 assert zipfile.ZipFile(out).testzip() is None
 checks.append(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name)
 print('PASS GUI subsystem + hidden PowerShell + package:',out)
(root/'schools/downloads/CHECKSUMS-GUARDIAN-3.4.5.txt').write_text('\n'.join(checks)+'\n')
