from pathlib import Path
import zipfile,json,hashlib,secrets,base64,sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
root=Path(__file__).resolve().parents[1];out=Path('/workspace/downloads');site=root/'schools'
readme='''تجربة تسجيل الفيديو في مرصاد
1. استبدل ملفات الإضافة في مجلدك الحالي، ثم أعد تحميلها من chrome://extensions. لا تحذف الإضافة.
2. حدّث سكربت النسخة المطابقة (شخصي أو مدارس)، ثم حدّث إصدار النشر الحالي دون تغيير الرابط أو الخصائص.
3. على جهاز الرصد ومن صفحة مرصاد: افتح الإضافة واضغط «تهيئة الفيديو» فقط. يجهز التبويب والصوت والصورة تلقائيًا ويحافظ على صفحة مرصاد في تبويب آخر. سجل دخول تيمز إذا طلبه المتصفح. تعاد التهيئة عند إعادة تشغيل كروم أو انقطاع الالتقاط.
4. من جدول الموقع أو الجوال: اضغط مربع التسجيل أسفل يسار حصة المعلم، واختر بعد أي دورة، بما فيها الأخيرة، أو اختر الكل، ثم احفظ.
التسجيل لمعـلم واحد في كل فاصل. لكل فاصل مقطع مستقل، ويتوقف عند المدة المختارة أو قبل الدورة التالية أو نهاية الحصة بـ30 ثانية، أيهما أسبق. لا تُعدّل توقيت الرصد.
الحفظ: التنزيلات/Mirsad-Videos/بتاريخ اليوم، وGoogle Drive المرتبط. للمدارس يجب ربط حساب Google Drive أولًا.
الالتقاط يتطلب تهيئة صريحة من جهاز الرصد. المساعد الحالي كما هو؛ لا يحتاج تحديثًا.
اختبر مقطعًا واحدًا بصورة وصوت ووصول النسختين ثم راقب الدورة التالية قبل توزيع نسخة التجربة. لم تُختبر هذه النسخة ميدانيًا على جهاز ويندوز وتيمز حقيقي بعد.
'''
checks={}
for edition,version in [('Teams','0.6.91'),('Schools','2.6.7')]:
 p=root/'schools/downloads'/f'Mirsad-{edition}-{version}-Video-Trial.zip'
 with zipfile.ZipFile(p,'w',zipfile.ZIP_DEFLATED) as z:
  for f in sorted(Path('/tmp/mirsad-video-'+edition).rglob('*')):
   if f.is_file():z.write(f,'الإضافة/'+str(f.relative_to('/tmp/mirsad-video-'+edition)))
  z.writestr('ابدأ هنا.txt',readme)
 checks[p.name]=hashlib.sha256(p.read_bytes()).hexdigest()
for name,source,edition in [('owner-script-2.6.1','Mirsad-Schools-OWNER-ONLY-2.6.1.gs','schools'),('private-video-script-0.6.85','Mirsad-PRIVATE-VIDEO-0.6.85.gs','private')]:
 if '--extensions-only' in sys.argv:break
 data=(out/source).read_bytes();key=secrets.token_bytes(32);nonce=secrets.token_bytes(12);cipher=AESGCM(key).encrypt(nonce,data,None)
 assert AESGCM(key).decrypt(nonce,cipher,None)==data
 (site/(name+'.encrypted.json')).write_text(json.dumps({'nonce':base64.b64encode(nonce).decode(),'data':base64.b64encode(cipher).decode()}))
 html=(site/'owner-script-2.5.0.html').read_text().replace('owner-script-2.5.0',name).replace('2.5.0','2.6.1' if edition=='schools' else '0.6.85')
 js=(site/'owner-script-2.5.0-preview.js').read_text().replace('owner-script-2.5.0',name).replace('Mirsad-Schools-OWNER-ONLY-2.5.0.txt',source.replace('.gs','.txt'))
 if edition=='private':
  html=html.replace('مرصاد المدارس','مرصاد الشخصي').replace('سكربت قوقل للمدارس','سكربت قوقل الشخصي').replace('مشروع Google Apps Script الحالي للمدارس فقط — لا تستخدم مشروع توثيق مرصاد الخاص','مشروع Google Apps Script الحالي لمرصاد الشخصي فقط — لا تستخدم مشروع المدارس')
  js=js.replace('SCHOOLS COMPLETE SCRIPT 2\\.\\d+\\.\\d+','PRIVATE VIDEO SCRIPT 0\\.6\\.85').replace('مشروع المدارس الحالي فقط','مشروع مرصاد الشخصي الحالي فقط')
 (site/(name+'.html')).write_text(html);(site/(name+'-preview.js')).write_text(js)
 (out/(name+'-LINK.txt')).write_text('https://mirsad-school.onrender.com/schools/'+name+'.html#'+base64.urlsafe_b64encode(key).decode().rstrip('=')+'\n')
(root/'schools/downloads/Mirsad-Video-Trial-CHECKSUMS.txt').write_text(''.join(v+'  '+k+'\n' for k,v in checks.items()))
(root/'video/README.ar.md').write_text(readme)
print('Packaged two trial extensions; original stable downloads and helper preserved. Private script opening links saved outside repository.')
