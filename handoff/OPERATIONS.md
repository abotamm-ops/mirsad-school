> Current snapshot: 2026-11-16. Read LATEST_SESSION.md FIRST; it overrides older deployment/version notes below. Recording-completion fix is still pending.

# البناء والاختبار والتشغيل

## نسخة المدارس
من SOURCE:
```
python3 commercial-simple/build.py --extensions-only
python3 commercial-simple/package.py --extensions-only
```
البناء يستخرج أساس المدارس 2.6.21؛ ملفه محفوظ تحت SOURCE/schools/downloads ضمن النسخة المسلمة. حزمة دعم 3.4.7 موجودة هناك أيضًا لأنها تبعية للبناء. لا تستخدم teams-probe كبديل لعميل المدارس.

## خدمة المالك
انسخ BACKEND/owner-2.9.21.gs إلى /tmp/mirsad-commercial/owner-2.9.21.gs، ثم شغّل:
```
python3 commerce/build.py
node commerce/service.test.cjs
node commerce/browser.test.cjs
MIRSAD_OWNER_TEST_SOURCE=/tmp/mirsad-commercial/owner-2.9.38.gs node commercial-simple/backend.test.cjs
```
هذا يبني خدمة 2.9.38 للرسائل والاشتراكات والفواتير. لا تشغل البناء الكامل commercial-simple/build.py دون أساسه القديم الخاص؛ فرع --extensions-only لا يحتاجه. للاطلاع أو التطوير المباشر يوجد الكود الحالي كاملًا في BACKEND/owner-2.9.38.gs.

تحديث الخدمة: استبدال الكود في مشروع المدارس الموجود، حفظ، نشر ← إدارة عمليات النشر ← تعديل النشر الحالي ← إصدار جديد ← نشر. لا تنشئ مشروعًا بديلًا ولا تغير رابط الخدمة أو خصائصه. احتفظ بنسخة من الكود الحالي وخصائص المشروع قبل التعديل. لا تنشر رمز المالك للمدارس.

## المتجر
المعرّف: ihdfpkkkagcaknbjljmbffpbblpcplpa
النسخة المرسلة للمراجعة بحسب آخر تأكيد للمالك: 2.9.31. لا يعني تجهيز 2.9.37 يدويًا أنها رُفعت للمتجر.
حزمة المتجر ZIP تتضمن manifest.json في الجذر، دون حقل key ودون EXE/سكريبت المالك. التعليمات التجريبية تصف المحاكاة بصدق. موافقة المتجر غير مؤكدة في هذا التسليم.

## اختبارات مهمة
```
node commercial-simple/controller.test.cjs
node commercial-simple/daily.test.cjs
node commercial-simple/browser.test.cjs
node commercial-simple/site-access.test.cjs
node tests/teacher_report.test.cjs
node tests/school_letter_signature.test.cjs
node commercial-simple/access-control.browser.test.cjs
```
اختبارات المتصفح تحتاج Playwright وChromium. توليد مصدر المتجر المقروء يستعمل Babel المضمّن مع Playwright؛ راجع chrome-store/build-readable.cjs. اختبارات الخلفية تحتاج ملف الخدمة الخاص في /tmp كما سبق.
اختبارات Go: go test ./... داخل schools/local-files-host وschools/guardian-shared. تأكد أن go هو مترجم Go الحقيقي، وليس برنامجًا آخر يحمل الاسم نفسه. بناء الدعم: chrome-store/build-native.py مع MIRSAD_GO عند الحاجة.

## النشر
Git remote مرجعي فقط؛ ملفات .git وكلمات المرور ليست ضمن التسليم. ادفع الفرع إلى main بالطريقة المتبعة، ثم تحقق من Render أن الحالة Live/Deployed. نجاح git push وحده لا يثبت أن الموقع نُشر. التحديثات لا تغيّر ملفات Word/PDF التي سبق تنزيلها؛ اختبر ملفًا جديدًا.

## أسرار لا تُصدّر من هذا المجلد
لم يُضمّن تصدير خصائص Apps Script الحية، أو كلمات مرور المالك، أو رموز حسابات العملاء، أو مفاتيح فتح الحزم المشفرة، أو بيانات اعتماد حساب Google/GitHub/Render. هذه تبقى لدى المالك. لا تعوّضها بقيم مخترعة.

قبل فتح الدفع، اقرأ SOURCE/commerce/README.md. الفواتير لا تتحقق من وصول التحويل؛ التفعيل المبدئي مقصود، والمالك يراجع ويقرر. العرض والدفع مغلقان افتراضيًا.
