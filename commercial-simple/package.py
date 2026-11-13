from pathlib import Path
import zipfile,json,base64,secrets,hashlib
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1];work=Path('/tmp/mirsad-commercial');out=root/'schools/downloads/Mirsad-Schools-2.7.6-Setup.zip'
readme='''مرصاد المدارس 2.7.6 — حزمة الإعداد المبسط
1. استخرج الحزمة كاملة إلى مجلد ثابت على جهاز Windows.
2. شغّل «تجهيز مرصاد.vbs» مرة واحدة لتسجيل مكوّن الحفظ المحلي وفتح المساعد، دون نافذة أوامر سوداء. إذا كان VBScript معطلًا في جهاز المؤسسة، استخدم ملف «تحديث حفظ الفيديو.cmd» الموجود داخل مجلد مكوّن الحفظ المحلي. سيظل تثبيت الإضافة نفسه يدويًا حتى نشرها في متجر كروم.
3. افتح chrome://extensions أو edge://extensions، فعّل وضع المطور، ثم «تحميل إضافة غير محزمة» وحدد مجلد «الإضافة». إذا كانت مثبتة سابقًا استبدل ملفات نفس المجلد وأعد تحميلها؛ لا تحذفها حفاظًا على بياناتها.
4. من الإضافة: تفعيل الاشتراك، ثم بريدك المسجل باشتراك فعال، ثم رمز الدخول الذي يصلك في البريد. الرمز من ثمانية أرقام ويستخدم مرة واحدة خلال عشر دقائق. بعد ذلك دخولك محفوظ.
5. عند الدخول الأول اربط Google، أو اختر «لا يوجد لدي حساب Google». جهّز الأرشيف المحلي في الحالتين. تنتقل بطاقة التجهيز للإعدادات المتقدمة عند نجاح الحفظ المحلي وإتمام اختيار Google. إذا لم تربط يبقى زر أحمر بعلامة تعجب فوق الجدول، ويمكن إخفاؤه مؤقتًا لأربع ساعات.
6. افتح مرصاد من زر الإضافة، وافتح مدرستي على بيانات المعلمين، واترك التبويبين مفتوحين. افتح تيمز وسجّل الدخول أيضًا. تحقق من أخضر التحميل ثم أخضر حفظ إعدادات الحصص ثم اضغط بدء الرصد.
7. في وضع «كل صباح»، يحدد تاريخ اليوم تلقائيًا ويحاول تهيئة جدوله قبل الحصة بنصف ساعة ويبدأ الرصد في موعد إعداداتك. يمكنك تفعيله من الليلة السابقة. إذا كان وضع «تاريخ أحدده»، يبقى تاريخ المصدر الذي تختاره ويُوثَّق الرصد بتاريخ اليوم. لا يعمل الجهاز وهو مطفأ؛ اترك كروم والمساعد يعملان ومدرستي وتيمز مسجّلًا دخولهما.
8. «تحديث النواقص — مستحسن» مفعّل افتراضيًا. يتوقف تحميل الصباح عند اكتمال الروابط، ثم يتبع التحديث بين الدورات وبعد الدورة الأخيرة إعداد الخدمة.
9. عند استبدال جدول موجود: حفظ السابق وتحميل الجديد، أو إلغاء. لا يوجد حذف دون حفظ في الواجهة المبسطة. نسخ اليوم قابلة للاسترجاع بنتائجها وصورها؛ الأيام الأقدم تُراجع في أرشيف الموقع.
10. الموقع للعرض والمشاهدة. ضبط التسجيل والتوقيت والتحديث داخل الإضافة. إعداد الفيديو اختياري من الإعدادات المتقدمة ويتطلب تهيئة كروم محليًا.
هذه أول حزمة تجريبية للمسار المبسط. اختُبرت الواجهة والجدولة والخادم بالمحاكاة؛ لم تختبر بعد على حساب مدرسة حقيقي أو Google OAuth حي أو Windows فعلي. جرّب مدرسة واحدة قبل التوزيع العام.
'''
launcher='''Option Explicit
Dim shell, fso, base, host, helper, result
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
base = fso.GetParentFolderName(WScript.ScriptFullName)
host = fso.BuildPath(base, "مكوّن الحفظ المحلي\\MirsadSchoolFilesHost.exe")
helper = fso.BuildPath(base, "تطبيق مرصاد\\MirsadChromeGuardian\\MirsadChromeGuardian.exe")
If Not fso.FileExists(host) Then
 MsgBox "استخرج الحزمة كاملة قبل التشغيل.", 48, "مرصاد المدارس"
 WScript.Quit 1
End If
result = shell.Run(Chr(34) & host & Chr(34) & " --install-native", 0, True)
If result <> 0 Then
 MsgBox "تعذر تجهيز الحفظ. شغّل مكوّن الحفظ المحلي مرة أخرى أو تواصل مع الدعم.", 48, "مرصاد المدارس"
 WScript.Quit result
End If
If fso.FileExists(helper) Then shell.Run Chr(34) & helper & Chr(34), 1, False
MsgBox "تم تجهيز مكوّن الحفظ المحلي. حمّل مجلد الإضافة من صفحة إضافات كروم، ثم فعّل اشتراكك من الإضافة.", 64, "مرصاد المدارس"
'''
with zipfile.ZipFile(out,'w',zipfile.ZIP_DEFLATED) as z:
 for f in sorted((work/'extension').rglob('*')):
  if f.is_file():z.write(f,'الإضافة/'+str(f.relative_to(work/'extension')))
 with zipfile.ZipFile(root/'schools/downloads/Mirsad-Schools-Guardian-3.4.6.zip') as old:
  for n in old.namelist():
   if not n.endswith('/'):z.writestr('تطبيق مرصاد/'+n,old.read(n))
 with zipfile.ZipFile(root/'schools/downloads/Mirsad-Schools-2.6.21-Video-Trial.zip') as old:
  for n in old.namelist():
   if n.startswith('تحديث حفظ الفيديو/') and not n.endswith('/'):z.writestr('مكوّن الحفظ المحلي/'+n.split('/',1)[1],old.read(n))
 z.writestr('ابدأ هنا.txt',readme.encode('utf-8-sig'))
 z.writestr('تجهيز مرصاد.vbs',launcher.encode('utf-16'))
(work/'README.ar.txt').write_text(readme)
import sys
if '--extensions-only' in sys.argv:
 (root/'schools/downloads/Mirsad-Schools-2.7.6-CHECKSUMS.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
 print('Packaged extension-only layout update; owner script unchanged.')
 raise SystemExit(0)
linkfile=work/'OWNER-2.7.0-LINK.txt'
if linkfile.exists():key=base64.urlsafe_b64decode(linkfile.read_text().strip().split('#')[1]+'=')
else:key=secrets.token_bytes(32)
nonce=secrets.token_bytes(12);data=(work/'owner-2.7.0.gs').read_bytes();cipher=AESGCM(key).encrypt(nonce,data,None)
assert AESGCM(key).decrypt(nonce,cipher,None)==data
site=root/'schools';name='owner-script-2.7.0'
(site/(name+'.encrypted.json')).write_text(json.dumps({'nonce':base64.b64encode(nonce).decode(),'data':base64.b64encode(cipher).decode()}))
for ext in ['html','preview.js']:
 original=site/('owner-script-2.6.20'+('.html' if ext=='html' else '-preview.js'))
 dest=site/(name+('.html' if ext=='html' else '-preview.js'))
 dest.write_text(original.read_text().replace('2.6.20','2.7.0'))
linkfile.write_text('https://mirsad-school.onrender.com/schools/'+name+'.html#'+base64.urlsafe_b64encode(key).decode().rstrip('=')+'\n')
(root/'schools/downloads/Mirsad-Schools-2.7.6-CHECKSUMS.txt').write_text(hashlib.sha256(out.read_bytes()).hexdigest()+'  '+out.name+'\n')
print('Packaged customer bundle and encrypted owner script; owner opening key retained locally.')
