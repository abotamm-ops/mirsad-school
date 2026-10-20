# بيانات الرصد الآلي

المرجع الكامل للتشغيل والحدود: [MONITORING-SETUP.md](MONITORING-SETUP.md).

كل يوم يُحفظ في مجلد خاص باسم `توثيق غياب YYYY-MM-DD`؛ الصور مباشرة داخل المجلد، و`attendance.json` يحفظ snapshot للجدول ودوراته وسجلات الفحوصات وروابط الصور. معرّفات المعلمين ثابتة في `mirsad-teachers.json` ولا تُستنتج من تشابه أسماء Teams.

واجهة Apps Script: `POST /exec` بمحتوى JSON و`Content-Type: text/plain;charset=utf-8` لتجنب preflight غير المدعوم في Apps Script. لا توضع الرموز في URL.

- `startDay`: رمز الرفع، تاريخ السعودية، `teachers`، `items`، `roundCount`. تكراره يعيد الجدول الأصلي دون تغييره.
- `image`: رمز الرفع، `date`، `record` وPNG مشفرة `data:image/png;base64,...`. تقبل غائب/غير محسوم فقط. الرد `fileId`, `url`, `name`؛ تكرار `scanId` لا يكرر الصورة.
- `record`: رمز الرفع، `date`, `record`. السجل يطابق معلمًا وحصة من snapshot ويحتوي `scanId`, `scheduledTeacher`, `teacher`, `period`, `cycle`, `status`, `scannedAt`, `detail`.
- `dates`, `day`: رمز الاطلاع أو الرفع. لا يستطيع رمز الاطلاع تغيير البيانات. `day` يعيد snapshot وسجلات مرتبطة بروابط الصور المرفوعة فقط.

الحالات الخام: `present`, `absent`, `unresolved`, `no-link`. نقص إحدى الدورات أو تعذر التحقق يعرض غير محسوم. جميع الدورات absent = غائب؛ جميعها present = حاضر؛ اختلاف الحضور والغياب = حاضر بالبرتقالي. غير المحسوم لا يحتسب غيابًا، وغياب اليوم يتطلب غياب جميع الحصص المجدولة لذلك المعلم.

طابور IndexedDB في الإضافة يحتفظ بطلبات الرفع إلى أن تؤكد الخدمة نجاحها. الصور المحلية تبقى في `Data Copy`؛ لا تُرفع صور الحاضر، ولا تُجعل ملفات Drive عامة.
