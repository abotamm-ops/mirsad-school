const ARCHIVE_KEY = "MIRSAD_ABSENCE_ARCHIVE_V1";
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
  } else {
    result = {ok:false,error:"طلب غير مدعوم"};
  }
  return output_(result, p.callback);
}
function addRecord_(p) {
  const teacher = String(p.teacher || "").trim();
  const date = String(p.date || "").trim();
  const type = String(p.type || "").trim();
  const notes = String(p.notes || "").trim().slice(0,250);
  const allowed = ["يوم كامل","حصة واحدة","حصتان","3 حصص","4 حصص","5 حصص","6 حصص","7 حصص"];
  if (!teacher || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !allowed.includes(type)) {
    return {ok:false,error:"بيانات غير مكتملة أو غير صحيحة"};
  }

  // تفاصيل الحصص القادمة من جدول مرصاد، مع إبقاء توافق السجلات القديمة.
  let lessons = [];
  const hasLessonsField = Object.prototype.hasOwnProperty.call(p, "lessons") && String(p.lessons || "").trim() !== "";
  if (hasLessonsField) {
    try {
      const parsed = JSON.parse(String(p.lessons));
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
    } catch (_) {
      return {ok:false,error:"تعذر قراءة تفاصيل الحصص"};
    }
  }
  const countByType = {"حصة واحدة":1,"حصتان":2,"3 حصص":3,"4 حصص":4,"5 حصص":5,"6 حصص":6,"7 حصص":7};
  if (hasLessonsField && type !== "يوم كامل" && lessons.length !== countByType[type]) {
    return {ok:false,error:"عدد الحصص المحددة لا يطابق نوع الغياب"};
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const records = readRecords_();
    const duplicate = records.find(r => r.teacher === teacher && r.date === date);
    if (duplicate) return {ok:false,error:"سبق تسجيل غياب لهذا المعلم في التاريخ نفسه",record:duplicate};
    const record = {id:Utilities.getUuid(),teacher:teacher,date:date,type:type,notes:notes,lessons:lessons,createdAt:new Date().toISOString()};
    records.unshift(record);
    PropertiesService.getScriptProperties().setProperty(ARCHIVE_KEY, JSON.stringify(records.slice(0,5000)));
    return {ok:true,record:record,records:readRecords_()};
  } finally {
    lock.releaseLock();
  }
}
function readRecords_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ARCHIVE_KEY) || "[]"); }
  catch (_) { return []; }
}
function output_(data, callback) {
  const json = JSON.stringify(data);
  if (callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback)) {
    return ContentService.createTextOutput(callback + "(" + json + ");").setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(json).setMimeType(ContentService.MimeType.JSON);
}