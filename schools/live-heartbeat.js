/* Viewer connection and the recorder's last confirmed pulse are separate facts. */
(() => {
  'use strict';
  function state(h, now, connected, contactAge = 0) {
    if (!connected) return {mode: contactAge > 90000 ? 'error' : 'delayed', title: contactAge > 90000 ? 'تعذر الاتصال بخدمة المتابعة' : 'تأخر تحديث المتابعة', detail: 'المعروض آخر بيانات مستلمة؛ لا يمكن تأكيد حالة جهاز الرصد حتى يعود الاتصال'};
    if (!h || !Number.isFinite(h.at) || h.at > now + 10000) return {mode: 'unknown', title: 'لم يصل نبض جهاز الرصد', detail: 'افتح الإضافة في جهاز الرصد وتحقق من دخول حساب المدرسة'};
    const age = Math.max(0, now - h.at);
    if (!h.running) return {mode: 'stopped', title: h.phase === 'paused' ? 'الرصد متوقف مؤقتًا' : 'الرصد متوقف', detail: 'آخر حالة مؤكدة للجهاز؛ تشغيله واستئنافه من الإضافة'};
    if (age > 120000) return {mode: 'error', title: 'لم يصل نبض حديث من جهاز الرصد', detail: 'آخر نبض منذ ' + Math.floor(age / 1000) + ' ثانية؛ تحقق من الإضافة واتصال الجهاز'};
    if (age > 60000) return {mode: 'delayed', title: 'تأخر نبض جهاز الرصد', detail: 'قد يكون رفع الصور أو الاتصال متأخرًا؛ جارٍ التحقق'};
    return {mode: 'alive', title: 'جهاز الرصد متصل', detail: h.phase === 'scanning' ? 'يجري الفحص' + (h.period ? ' · الحصة ' + h.period : '') + (h.cycle ? ' · الدورة ' + h.cycle : '') : 'بانتظار موعد الفحص التالي'};
  }
  function attach(container) {
    const el = document.createElement('section'); el.className = 'mirsad-heartbeat'; el.setAttribute('role', 'status');
    const dot = document.createElement('span'); dot.className = 'heartbeat-dot'; dot.setAttribute('aria-hidden', 'true');
    const words = document.createElement('div'), title = document.createElement('strong'), detail = document.createElement('small');
    words.append(title, detail); el.append(dot, words); container.prepend(el);
    let heartbeat = null, offset = 0, contact = 0, available = false, failed = false;
    const started = Date.now();
    function render() {
      const age = Date.now() - (contact || started);
      const value = state(heartbeat, Date.now() + offset, available && !failed && age < 60000 && navigator.onLine, age);
      el.dataset.mode = value.mode; container.classList.toggle('is-signal-lost', value.mode !== 'alive');
      title.textContent = value.title; detail.textContent = value.detail;
    }
    const timer = setInterval(render, 1000); render();
    return {
      update(value, serverTime, ok = true) { heartbeat = value; offset = Number.isFinite(serverTime) ? serverTime - Date.now() : 0; contact = Date.now(); available = ok; failed = false; render(); },
      disconnect() { failed = true; render(); },
      destroy() { clearInterval(timer); el.remove(); }
    };
  }
  globalThis.MirsadLiveHeartbeat = {attach, state};
})();
