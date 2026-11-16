> Current snapshot: 2026-11-16. Read LATEST_SESSION.md FIRST; it overrides older deployment/version notes below. Recording-completion fix is still pending.

# خريطة المشروع

| المسار داخل الحزمة | الاستخدام |
|---|---|
| SOURCE/ | نسخة ملفات Git الحالية دون تاريخ Git والحزم القديمة |
| SOURCE/commercial-simple/ | واجهة إضافة المدارس المبسطة، التحكم، البناء والاختبارات |
| SOURCE/schools/ | موقع المدارس، لوحة المالك، حسابات العملاء والخطابات |
| SOURCE/automatic-monitoring.html والملفات المجاورة | الموقع الشخصي |
| SOURCE/teacher-report*.js | تصدير خطابات الشخصي Word/PDF |
| SOURCE/schools/teacher-report*.js | تصدير خطابات المدارس Word/PDF |
| SOURCE/video/ | بناء دعم الفيديو، محولات الخدمة واختباراتها |
| SOURCE/schools/guardian-shared/ وlocal-files-host/ | كود أرشفة المدارس المحلي |
| SOURCE/schools/guardian-session/ | مساعد استعادة جلسة Chrome |
| SOURCE/chrome-store/ | فك تشويش مصدر المتجر، اختبارات وملاحظات تجهيز النشر |
| SOURCE/tests/ | اختبارات منطق الخدمة والمتصفح والفيديو والخطابات |
| EXTENSIONS/personal-0.6.108/ | ملفات الإضافة الشخصية الحالية، منفصلة عن تجربة التقويم القديمة |
| EXTENSIONS/schools-2.9.45/ | ملفات إضافة المدارس الحالية للتثبيت اليدوي |
| RELEASES/ | الحزم الحالية المثبتة الإصدارات |
| BACKEND/ | كود خدمة المالك الكامل؛ خاص بالمالك، لا ينشر علنًا |
| FILES.sha256 | بصمات للتحقق من ملفات التسليم |

المستودع المرجعي: https://github.com/abotamm-ops/mirsad-school
الموقع الشخصي: https://mirsad-school.onrender.com/automatic-monitoring.html
موقع المدارس: https://mirsad-school.onrender.com/schools/automatic-monitoring.html
لوحة المالك: https://mirsad-school.onrender.com/schools/owner-schools.html

واجهة الاشتراك: SOURCE/schools/subscription.*. واجهة المالك: SOURCE/schools/owner-commerce.js. بناء الخدمة الجديدة واختباراتها: SOURCE/commerce/. عرض رسائل العميل: SOURCE/commercial-simple/announcements.js.

صفحة المالك المباشرة للرسائل والفواتير: https://mirsad-school.onrender.com/schools/owner-commerce.html
