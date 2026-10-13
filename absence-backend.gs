const ARCHIVE_KEY = "MIRSAD_ABSENCE_ARCHIVE_V1";
const ALLOWED_TYPES = ["يوم كامل", "حصص محددة"];

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || "list");
  const expectedKey = PropertiesService.getScriptProperties().getProperty("ARCHIVE_PASSWORD") || "";

  if (!expectedKey) return output_({ok:false,error:"لم يُضبط رمز الأرشيف بعد"}, p.callback);
  if (String(p.key || "") !== expectedKey) return output_({ok:false,error:"رمز الدخول غير صحيح"}, p.callback);

  let result;
  if (action === "list") {
    result = {ok:true,records:readRecords_()};
  } else if (action === "add") {
    result = addRecord_(p);
  } else if (action === "update") {
    result = updateRecord_(p);
  } else if (action === "delete") {
    result = deleteRecord_(p);
  } else {
    result = {ok:false,error:"طلب غير مدعوم"};
  }
  return output_(result, p.callback);
}

function parseRecordPayload_(p) {
  const teacher = String(p.teacher || "").trim();
  const date = String(p.date || "").trim();
  const type = String(p.type || "").trim();
  const notes = String(p.notes || "").trim().slice(0,250);

  if (!teacher || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !ALLOWED_TYPES.includes(type)) {
    return {ok:false,error:"بيانات المعلم أو التاريخ أو نوع الغياب غير صحيحة"};
  }

  let lessonsRaw = String(p.lessons || "");
  if (p.lessons64) {
    try {
      lessonsRaw = Utilities.newBlob(
        Utilities.base64Decode(String(p.lessons64))
      ).getDataAsString("UTF-8");
    } catch (_) {
      return {ok:false,error:"تعذر فك ترميز تفاصيل الحصص"};
    }
  }

  let lessons = [];
  if (lessonsRaw.trim()) {
    try {
      const parsed = JSON.parse(lessonsRaw);
      if (!Array.isArray(parsed)) return {ok:false,error:"تفاصيل الحصص غير صالحة"};
      lessons = parsed.slice(0,50).map(item => {
        const period = Number(item && item.period);
        return {
          period: Number.isInteger(period) && period >= 1 && period <= 7 ? period : 0,
          subject: String(item && item.subject || "").trim().slice(0,160),
          classroom: String(item && item.classroom || "").trim().slice(0,100),
          time: String(item && item.time || "").trim().slice(0,60)
        };
      });
      if (lessons.some(item => !item.period || !item.subject)) {
        return {ok:false,error:"يوجد درس بلا رقم حصة أو اسم مادة صالح"};
      }
      const seen = new Set();
      for (const item of lessons) {
        const identity = [item.period,item.subject,item.classroom].join("|");
        if (seen.has(identity)) return {ok:false,error:"توجد حصة مكررة ضمن الاختيارات"};
        seen.add(identity);
      }
    } catch (_) {
      return {ok:false,error:"تعذر قراءة تفاصيل الحصص"};
    }
  }

  if (type === "حصص محددة" && lessons.length === 0) {
    return {ok:false,error:"حدد حصة واحدة على الأقل، أو اختر غياب يوم كامل"};
  }
  return {ok:true,record:{teacher:teacher,date:date,type:type,notes:notes,lessons:lessons}};
}

function addRecord_(p) {
  const parsed = parseRecordPayload_(p);
  if (!parsed.ok) return parsed;
  const data = parsed.record;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const records = readRecords_();
    const duplicate = records.find(r => r.teacher === data.teacher && r.date === data.date);
    if (duplicate) return {ok:false,error:"سبق تسجيل غياب لهذا المعلم في التاريخ نفسه. افتح السجل الموجود وعدّله بدل إضافة سجل مكرر.",record:duplicate};
    const record = Object.assign({
      id:Utilities.getUuid(),
      createdAt:new Date().toISOString()
    }, data);
    records.unshift(record);
    writeRecords_(records);
    return {ok:true,record:record,records:readRecords_()};
  } finally {
    lock.releaseLock();
  }
}

function updateRecord_(p) {
  const id = String(p.id || "").trim();
  if (!id) return {ok:false,error:"معرّف السجل المطلوب تعديله مفقود"};
  const parsed = parseRecordPayload_(p);
  if (!parsed.ok) return parsed;
  const data = parsed.record;

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const records = readRecords_();
    const index = records.findIndex(r => String(r.id || "") === id);
    if (index < 0) return {ok:false,error:"لم يُعثر على السجل المطلوب تعديله"};
    const duplicate = records.find(r => String(r.id || "") !== id && r.teacher === data.teacher && r.date === data.date);
    if (duplicate) return {ok:false,error:"يوجد سجل آخر لهذا المعلم في التاريخ نفسه؛ عدّل السجل الموجود بدل تكرار التاريخ."};

    records[index] = Object.assign({}, records[index], data, {
      id:id,
      updatedAt:new Date().toISOString()
    });
    writeRecords_(records);
    return {ok:true,record:records[index],records:readRecords_()};
  } finally {
    lock.releaseLock();
  }
}

function deleteRecord_(p) {
  const id = String(p.id || "").trim();
  if (!id) return {ok:false,error:"معرّف السجل المطلوب حذفه مفقود"};
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const records = readRecords_();
    const index = records.findIndex(r => String(r.id || "") === id);
    if (index < 0) return {ok:false,error:"السجل غير موجود أو سبق حذفه"};
    records.splice(index, 1);
    writeRecords_(records);
    return {ok:true,deletedId:id,records:readRecords_()};
  } finally {
    lock.releaseLock();
  }
}

function readRecords_() {
  try {
    const records = JSON.parse(PropertiesService.getScriptProperties().getProperty(ARCHIVE_KEY) || "[]");
    return Array.isArray(records) ? records : [];
  } catch (_) {
    return [];
  }
}

function writeRecords_(records) {
  PropertiesService.getScriptProperties().setProperty(ARCHIVE_KEY, JSON.stringify(records.slice(0,5000)));
}

function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}
