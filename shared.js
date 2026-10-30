(() => {
  if (location.pathname.replace(/\/+$/, "") === "/absence.html" || new URLSearchParams(location.search).get("view") === "absence") return;
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbznAVdLw5KVYmESB6Dx4av84-UQi3lewoK2Si59UNf_03y9keQf3CNxtXu0KhGbudX7Ng/exec";
  let lastVersion = "";
  let busy = false;
  let firstLoad = true;
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function showStatus(message, warning) {
    let node = document.getElementById("mirsad-shared-status");
    if (!node) { node = document.createElement("div"); node.id = "mirsad-shared-status"; document.querySelector("main")?.prepend(node); }
    if (node) { node.textContent = message; node.className = "sync-status" + (warning ? " is-warning" : ""); node.setAttribute("role", "status"); }
  }
  function applyPayload(payload) {
    const tableBody = document.getElementById("body");
    if (!tableBody || !tableBody.closest("table")) throw new Error("Original timetable table not found");
    const lessons = payload.lessons;
    const teacherNames = [...new Set([...(Array.isArray(payload.teachers)?payload.teachers:[]),...lessons.map(x => x.teacher)].map(x => String(x || "").trim()).filter(Boolean))].sort(new Intl.Collator("ar",{sensitivity:"base",numeric:true}).compare);
    const indexes = [2,3,4,5,6,7,8];
    const byTeacher = new Map(teacherNames.map(t => [t, Array.from({length:7}, () => [])]));
    lessons.forEach(item => { const teacher = String(item.teacher || "").trim(); const period = indexes.indexOf(Number(item.cellIndex)); if (period >= 0 && byTeacher.has(teacher)) byTeacher.get(teacher)[period].push(item); });
    tableBody.innerHTML = teacherNames.map((teacher, rowIndex) => {
      const cells = byTeacher.get(teacher).map((items, periodIndex) => {
        const inner = items.length ? items.map(item => {
          const title = item.title || item.subject || item.lessonTitle || "حصة";
          const classroom = item.class || item.lesson || item.className || "";
          const time = item.time || "";
          const teams = item.teams || item.teamsUrl || "";
          return '<div class="lesson"><div class="lesson-title">' + esc(title) + '</div>' + (classroom ? '<div class="class">' + esc(classroom) + '</div>' : '') + (time ? '<div class="class">' + esc(time) + '</div>' : '') + (teams ? '<a class="teams" href="' + esc(teams) + '" target="_blank" rel="noopener noreferrer">فتح تيمز</a>' : '<span class="no-link">لا يوجد رابط تيمز</span>') + '</div>';
        }).join("") : '<span class="empty">—</span>';
        return '<td data-period="' + indexes[periodIndex] + '">' + inner + '</td>';
      }).join("");
      return '<tr data-teacher="' + esc(teacher) + '"><th class="teacher"><span class="num">' + (rowIndex+1) + '</span><span class="teacher-name">' + esc(teacher) + '</span></th>' + cells + '</tr>';
    }).join("");
    const count = document.getElementById("count");
    if (count) count.textContent = teacherNames.length + " معلمًا — " + lessons.length + " حصة";
    const search = document.getElementById("search");
    if (search) { const q = search.value.trim().toLocaleLowerCase("ar"); tableBody.querySelectorAll("tr").forEach(tr => { tr.hidden = !tr.innerText.toLocaleLowerCase("ar").includes(q); }); }
    const date = payload.selectedDate || payload.scheduleDate || payload.date || payload.dayDate || payload.selectedDay || payload.dayName || payload.day || "";
    document.documentElement.dataset.mirsadSource=payload.source||"naqar";document.documentElement.dataset.mirsadSourceDate=payload.source==='madrasati'?payload.scheduleDate||'':'';document.documentElement.dataset.mirsadImportDate=payload.source==='madrasati'?(payload.importedForDate||payload.scheduleDate||''):'';
    showStatus((payload.source==='madrasati'?"تم تحميل الجدول مباشرة من مدرستي"+(payload.importedForDate&&payload.importedForDate!==payload.scheduleDate?" — جدول من تاريخ مختلف للتجربة؛ الرصد بتاريخ "+payload.importedForDate:""):"تم تحميل آخر تقرير رفعته من نقار") + (date ? " — تاريخ التقرير: " + date : " — تاريخ التقرير غير محدد في المصدر") + " — وقت الرفع: " + (payload.updatedAt ? new Date(payload.updatedAt).toLocaleString("ar-SA") : "غير معروف") + " — " + lessons.length + " حصة — يتحدّث تلقائيًا", false);
  }
  function syncNaqar() {
    if (busy) return;
    busy = true;
    const callbackName = "__mirsadSync_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let done = false;
    const timeout = setTimeout(() => finish(null, "تأخر اتصال المزامنة؛ سنحاول مجددًا تلقائيًا."), 10000);
    function finish(payload, error) {
      if (done) return;
      done = true; clearTimeout(timeout); busy = false;
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      script.remove();
      if(payload&&localStorage.getItem('mirsad-timetable-source-mode')==='madrasati')return;
      if (payload) {
        const version = String(payload.updatedAt || "") + "|" + JSON.stringify(payload.lessons);
        if (version !== lastVersion) { try { applyPayload(payload); lastVersion = version; } catch (_) { showStatus("تعذر تطبيق التقرير المشترك؛ بقي تصميم الجدول كما هو.", true); } }
      } else if (firstLoad || error) showStatus(error || "لا توجد بيانات مشتركة صالحة؛ بقي الجدول الحالي دون تغيير.", true);
      firstLoad = false;
    }
    window[callbackName] = response => {
      if (!response || !response.ok || !response.payload || !Array.isArray(response.payload.lessons) || !response.payload.lessons.length) { finish(null, "لا توجد بيانات مشتركة صالحة؛ بقي الجدول الحالي دون تغيير."); return; }
      finish(response.payload, null);
    };
    script.onerror = () => finish(null, "تعذر الاتصال بالمصدر المشترك؛ سنحاول مجددًا تلقائيًا.");
    script.src = ENDPOINT + "?callback=" + encodeURIComponent(callbackName) + "&_=" + Date.now();
    document.head.appendChild(script);
  }
  let sourceBusy=false,legacySourceService=false;
  const SOURCE_URL='https://script.google.com/macros/s/AKfycbwvkojpc9K_wxKWZhFJj38_OkD5aw18299ceLWdFnKOSMqoGiV3oL74AueuZiKTEHdo/exec';
  function holdMadrasati(message){document.documentElement.dataset.mirsadSource='madrasati';document.documentElement.dataset.mirsadSourceDate='';document.documentElement.dataset.mirsadImportDate='';document.getElementById('body')?.replaceChildren();lastVersion='';showStatus(message,true)}
  async function syncOnce(){if(sourceBusy)return;sourceBusy=true;try{
   if(document.readyState==='loading')await new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true}));
   if(window.MirsadAdminAccess)await window.MirsadAdminAccess.ready;
   if(legacySourceService){syncNaqar();return}
   const key=localStorage.getItem('mirsad_archive_password_v1')||localStorage.getItem('mirsad-monitor-reader-key');
   if(!key){syncNaqar();return}
   const endpoint=localStorage.getItem('mirsad-monitor-url')||SOURCE_URL;
   const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'getTimetableSource',key}),signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error('تعذر تحديد مصدر الجدول');const result=await response.json();
   if(!result.ok){if(['صلاحية القراءة لا تسمح بالرفع','النتيجة لا تطابق جدول اليوم المحفوظ','جدول اليوم غير محفوظ','لم تبدأ أرشفة هذا اليوم'].includes(result.error)){legacySourceService=true;syncNaqar();return}throw new Error(result.error||'تعذر قراءة مصدر الجدول')}
   if(!['naqar','madrasati'].includes(result.mode))throw new Error('مصدر الجدول غير معروف');
   localStorage.setItem('mirsad-timetable-source-mode',result.mode);
   if(result.mode==='naqar'){document.documentElement.dataset.mirsadSource='naqar';document.documentElement.dataset.mirsadSourceDate='';document.documentElement.dataset.mirsadImportDate='';syncNaqar();return}
   const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),payload=result.payload;
   if(!payload||(payload.importedForDate||payload.scheduleDate)!==today){holdMadrasati('المصدر مدرستي — اجمع جدول اليوم من الإضافة؛ لم تُعرض بيانات نقار أو يوم سابق.');return}
   const version='madrasati|'+payload.updatedAt+'|'+payload.scheduleDate+'|'+JSON.stringify(payload.lessons);if(version!==lastVersion){applyPayload(payload);lastVersion=version}
  }catch(error){if(localStorage.getItem('mirsad-timetable-source-mode')==='madrasati'&&!document.documentElement.dataset.mirsadSourceDate)holdMadrasati('تعذر تحميل جدول مدرستي؛ أعد المحاولة دون تغيير المصدر.');else showStatus('تعذر تحديث مصدر الجدول؛ ستعاد المحاولة تلقائيًا.',true)}finally{sourceBusy=false}}
  void syncOnce();setInterval(()=>void syncOnce(),15000);

  function updateAbsenceLink() {
    const banner = document.getElementById("absence-banner");
    if (!banner) return;
    const names = [...document.querySelectorAll("#body tr[data-teacher]")]
      .map(tr => (tr.getAttribute("data-teacher") || "").trim())
      .filter(Boolean);
    banner.href = "/absence/?teachers=" + encodeURIComponent([...new Set(names)].join("|"));
    banner.target = "_self";
  }

  // الزر موجود أصلًا في index.html؛ نحدّث الرابط فقط ولا ننشئ الزر أو نراقب الصفحة كاملة.
  updateAbsenceLink();
  const tableBody = document.getElementById("body");
  if (tableBody && window.MutationObserver) {
    new MutationObserver(updateAbsenceLink).observe(tableBody, { childList: true, subtree: true });
  }
})();