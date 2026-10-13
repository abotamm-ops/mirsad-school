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
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const records = readRecords_();
    const duplicate = records.find(r => r.teacher === teacher && r.date === date);
    if (duplicate) return {ok:false,error:"سبق تسجيل غياب لهذا المعلم في التاريخ نفسه",record:duplicate};
    const record = {id:Utilities.getUuid(),teacher:teacher,date:date,type:type,notes:notes,createdAt:new Date().toISOString()};
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