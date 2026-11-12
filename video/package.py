from pathlib import Path
import zipfile,json,hashlib,secrets,base64,sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1];out=Path('/workspace/downloads');site=root/'schools'
readme='''تجربة تسجيل الفيديو في مرصاد
1. استبدل ملفات الإضافة في مجلدك الحالي، ثم أعد تحميلها من chrome://extensions. لا تحذف الإضافة.
2. حدّث سكربت الفيديو المطابق ثم احفظ وحدّث النشر الحالي إلى إصدار جديد، دون تغيير رابط الخدمة.
3. على جهاز الرصد ومن صفحة مرصاد: افتح الإضافة واضغط «تهيئة الفيديو» فقط. يجهز التبويب والصوت والصورة تلقائيًا ويحافظ على صفحة مرصاد في تبويب آخر. سجل دخول تيمز إذا طلبه المتصفح. تعاد التهيئة عند إعادة تشغيل كروم أو انقطاع الالتقاط. إذا أغلقت تبويب التسجيل واسترجعته، افتح الإضافة من التبويب المسترجع لتعيد تهيئته تلقائيًا؛ لا يظهر جاهز حتى ينجح الالتقاط. لا يستأنف المقطع القديم المقطوع.
4. من جدول الموقع أو الجوال: اضغط مربع التسجيل أسفل يسار حصة المعلم، واختر بعد أي دورة، بما فيها الأخيرة، أو اختر الكل، ثم احفظ.
التسجيل لمعـلم واحد في كل فاصل. لكل فاصل مقطع مستقل، ويتوقف عند المدة المختارة أو قبل الدورة التالية أو نهاية الحصة بـ30 ثانية، أيهما أسبق. لا تُعدّل توقيت الرصد.
الحفظ: مجلد Videos ثم تاريخ اليوم، داخل مسار الحفظ الحالي وفي Google Drive المرتبط. افتح «سجل الفيديو» في الموقع لعرض النسخ المؤكدة. شغّل «تحديث حفظ الفيديو.cmd» من مجلد تحديث حفظ الفيديو مرة واحدة لتحديث مكوّن الحفظ الموجود. الخاص يستخدم أقراص Data Copy المعتادة؛ المدارس تستخدم مجلد المدرسة المحلي المعتاد. للمدارس يجب ربط حساب Google Drive أولًا.
الالتقاط يتطلب تهيئة صريحة من جهاز الرصد. المساعد الحالي كما هو؛ لا يحتاج تحديثًا.
تصفير اليوم المختار يلغي طلبات فيديو ذلك التاريخ ويحذف فيديوهاته من Drive، وتصفير الفترة الزمنية يحذف المقاطع التي يتداخل وقتها مع الفترة المختارة فقط، وينفذ حذف نسخها المحلية عند اتصال جهاز الرصد؛ يظهر الحذف المحلي المعلق ولا يعتبر مؤكدًا حتى يكتمل. بقية التواريخ والمقاطع خارج الفترة لا تتغير.
تحميل الصباح: أثناء استعداد الرصد وجدول اليوم جاهز، يحاول تحميل الجدول كل خمس دقائق خلال النصف ساعة السابقة للحصة الأولى إذا بقيت روابط ناقصة. يتوقف عند اكتمال الروابط أو بداية الحصة، ثم يتبع وضع التحميل المعتاد أثناء اليوم. يجب بقاء كروم مفتوحًا ومدرستي مسجلة الدخول.
اختبر مقطعًا واحدًا بصورة وصوت ووصول النسختين ثم راقب الدورة التالية قبل توزيع نسخة التجربة. لم تُختبر هذه النسخة ميدانيًا على جهاز ويندوز وتيمز حقيقي بعد.
'''
checks={}
for edition,version in [('Teams','0.6.103'),('Schools','2.6.20')]:
 if '--scripts-only' in sys.argv:break
 p=root/'schools/downloads'/f'Mirsad-{edition}-{version}-Video-Trial.zip'
 with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
  for f in sorted(Path('/tmp/mirsad-video-'+edition).rglob('*')):
   if f.is_file():z.write(f,'الإضافة/'+str(f.relative_to('/tmp/mirsad-video-'+edition)))
  z.writestr('ابدأ هنا.txt',readme)
  prefix='تحديث حفظ الفيديو/'
  if edition=='Teams':
   for arch in ['amd64','386']:z.write(Path('/tmp/mirsad-video-native-output')/f'MirsadBackupHost-{arch}.exe',prefix+f'MirsadBackupHost-{arch}.exe')
   z.write(root/'video/native-install.ps1',prefix+'Install.ps1')
   command='@echo off\r\npowershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0Install.ps1"\r\nif errorlevel 1 pause\r\n'
  else:
   z.write(Path('/tmp/mirsad-video-native-output/MirsadSchoolFilesHost.exe'),prefix+'MirsadSchoolFilesHost.exe')
   command='@echo off\r\n"%~dp0MirsadSchoolFilesHost.exe" --install-native\r\nif errorlevel 1 pause\r\n'
  z.writestr(prefix+'تحديث حفظ الفيديو.cmd',command)

 checks[p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
for name,source,edition in [('owner-script-2.6.20','Mirsad-Schools-OWNER-ONLY-2.6.20.gs','schools'),('private-video-script-0.6.103','Mirsad-PRIVATE-VIDEO-0.6.103.gs','private')]:
 if '--extensions-only' in sys.argv:break
 data=(out/source).read_bytes();key=secrets.token_bytes(32);nonce=secrets.token_bytes(12);cipher=AESGCM(key).encrypt(nonce,data,None)
 assert AESGCM(key).decrypt(nonce,cipher,None)==data
 (site/(name+'.encrypted.json')).write_text(json.dumps({'nonce':base64.b64encode(nonce).decode(),'data':base64.b64encode(cipher).decode()}))
 html=(site/'owner-script-2.5.0.html').read_text().replace('owner-script-2.5.0',name).replace('2.5.0','2.6.20' if edition=='schools' else '0.6.103')
 js=(site/'owner-script-2.5.0-preview.js').read_text().replace('owner-script-2.5.0',name).replace('Mirsad-Schools-OWNER-ONLY-2.5.0.txt',source.replace('.gs','.txt'))
 if edition=='private':
  html=html.replace('مرصاد المدارس','مرصاد الشخصي').replace('سكربت قوقل للمدارس','سكربت قوقل الشخصي').replace('مشروع Google Apps Script الحالي للمدارس فقط — لا تستخدم مشروع توثيق مرصاد الخاص','مشروع Google Apps Script الحالي لمرصاد الشخصي فقط — لا تستخدم مشروع المدارس')
  js=js.replace('SCHOOLS COMPLETE SCRIPT 2\\.\\d+\\.\\d+','PRIVATE VIDEO SCRIPT 0\\.6\\.103').replace('مشروع المدارس الحالي فقط','مشروع مرصاد الشخصي الحالي فقط')
 (site/(name+'.html')).write_text(html);(site/(name+'-preview.js')).write_text(js)
 (out/(name+'-LINK.txt')).write_text('https://mirsad-school.onrender.com/schools/'+name+'.html#'+base64.urlsafe_b64encode(key).decode().rstrip('=')+'\n')
if checks:(root/'schools/downloads/Mirsad-Video-Trial-CHECKSUMS.txt').write_text(''.join(v+'  '+k+'\n' for k,v in checks.items()))
(root/'video/README.ar.md').write_text(readme)
print('Packaged owner scripts only; extensions unchanged.' if '--scripts-only' in sys.argv else 'Packaged trial extensions; original stable downloads and helper preserved.')
