const ARCHIVE_KEY = "MIRSAD_ABSENCE_ARCHIVE_V1";
function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || "list");
  if (action !== "list") return json_({ok:false,error:"Unsupported action"});
  const records = readRecords_();
  return json_({ok:true,records:records});
}
function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (body.action !== "add") return json_({ok:false,error:"Unsupported action"});
    const teacher = String(body.teacher || "").trim();
    const date = String(body.date || "").trim();
    const type = String(body.type || "").trim();
    const notes = String(body.notes || "").trim().slice(0,250);
    const allowed = ["يوم كامل","حصة واحدة","حصتان","3 حصص","4 حصص","5 حصص","6 حصص","7 حصص"];
    if (!teacher || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !allowed.includes(type)) {
      return json_({ok:false,error:"بيانات غير مكتملة أو غير صحيحة"});
    }
    const records = readRecords_();
    const duplicate = records.find(r => r.teacher === teacher && r.date === date);
    if (duplicate) return json_({ok:false,error:"يوجد سجل لهذا المعلم في التاريخ نفسه",record:duplicate});
    const record = {id:Utilities.getUuid(),teacher:teacher,date:date,type:type,notes:notes,createdAt:new Date().toISOString()};
    records.unshift(record);
    PropertiesService.getScriptProperties().setProperty(ARCHIVE_KEY, JSON.stringify(records.slice(0,5000)));
    return json_({ok:true,record:record,records:readRecords_()});
  } catch (err) {
    return json_({ok:false,error:"تعذر حفظ السجل"});
  }
}
function readRecords_() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty(ARCHIVE_KEY) || "[]"); }
  catch (_) { return []; }
}
function json_(data) {
  return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
}