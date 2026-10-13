(() => {
  // Shared data must never silently replace the timetable already shown on this device.
  // The current shared endpoint does not reliably identify the selected timetable date,
  // so replacing the local table could overwrite a deliberately selected historical copy.
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbznAVdLw5KVYmESB6Dx4av84-UQi3lewoK2Si59UNf_03y9keQf3CNxtXu0KhGbudX7Ng/exec";
  const cb = "__mirsadSharedStatusCallback";
  const script = document.createElement("script");
  let finished = false;
  const timer = setTimeout(() => finish("تعذر التحقق من المزامنة المشتركة؛ لم نغيّر الجدول المعروض."), 10000);

  function finish(message) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { delete window[cb]; } catch (_) { window[cb] = undefined; }
    script.remove();
    if (message) {
      let node = document.getElementById("mirsad-shared-status");
      if (!node) {
        node = document.createElement("div");
        node.id = "mirsad-shared-status";
        document.querySelector("main")?.prepend(node);
      }
      if (node) {
        node.textContent = message;
        node.style.cssText = "background:#fff7df;color:#854d0e;padding:8px 10px;border-radius:8px;margin:8px 0;font:12px Tahoma;direction:rtl";
      }
    }
  }

  window[cb] = (response) => {
    if (!response || !response.ok || !response.payload || !Array.isArray(response.payload.lessons)) {
      finish("تعذر التحقق من بيانات الجدول المشترك؛ احتفظنا بالنسخة المعروضة دون تغيير.");
      return;
    }
    const payload = response.payload;
    const date = payload.selectedDate || payload.scheduleDate || payload.date || payload.dayDate || "";
    const stamp = payload.updatedAt ? new Date(payload.updatedAt).toLocaleString("ar-SA") : "غير معروف";
    finish("حافظنا على الجدول المعروض دون استبداله تلقائيًا. آخر تحديث للمصدر المشترك: " + stamp +
      (date ? " — تاريخ الجدول في المصدر: " + date : " — تنبيه: المصدر لا يحدد تاريخ الجدول بوضوح."));
  };
  script.onerror = () => finish("تعذر الاتصال بالمصدر المشترك؛ احتفظنا بالجدول المعروض دون تغيير.");
  script.src = ENDPOINT + "?callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
  document.head.appendChild(script);
})();