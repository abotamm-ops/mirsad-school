(() => {
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbznAVdLw5KVYmESB6Dx4av84-UQi3lewoK2Si59UNf_03y9keQf3CNxtXu0KhGbudX7Ng/exec";
  let lastVersion = "";
  let busy = false;
  let firstLoad = true;

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function showStatus(message, warning) {
    let node = document.getElementById("mirsad-shared-status");
    if (!node) {
      node = document.createElement("div");
      node.id = "mirsad-shared-status";
      document.querySelector("main")?.prepend(node);
    }
    if (node) {
      node.textContent = message;
      node.style.cssText = "background:" + (warning ? "#fff7df;color:#854d0e" : "#e0f2fe;color:#075985") + ";padding:8px 10px;border-radius:8px;margin:8px 0;font:12px Tahoma;direction:rtl";
    }
  }
  function applyPayload(payload) {
    const tableBody = document.getElementById("body");
    const table = tableBody?.closest("table");
    if (!tableBody || !table) throw new Error("Original timetable table not found");
    const lessons = payload.lessons;
    const teacherNames = [...new Set(lessons.map(x => String(x.teacher || "").trim()).filter(Boolean))];
    const byTeacher = new Map(teacherNames.map(t => [t, Array.from({length:7}, () => [])]));
    const indexes = [2,3,4,5,6,7,8];

    lessons.forEach(item => {
      const teacher = String(item.teacher || "").trim();
      const period = indexes.indexOf(Number(item.cellIndex));
      if (period >= 0 && byTeacher.has(teacher)) byTeacher.get(teacher)[period].push(item);
    });

    tableBody.innerHTML = teacherNames.map((teacher, rowIndex) => {
      const cells = byTeacher.get(teacher).map((items, periodIndex) => {
        const inner = items.length ? items.map(item => {
          const title = item.title || item.subject || item.lessonTitle || "حصة";
          const classroom = item.class || item.lesson || item.className || "";
          const time = item.time || "";
          const teams = item.teams || item.teamsUrl || "";
          return '<div class="lesson"><div class="lesson-title">' + esc(title) + '</div>' +
            (classroom ? '<div class="class">' + esc(classroom) + '</div>' : '') +
            (time ? '<div class="class">' + esc(time) + '</div>' : '') +
            (teams ? '<a class="teams" href="' + esc(teams) + '" target="_blank" rel="noopener noreferrer">🎥 Teams</a>' : '<span class="no-link">لا يوجد رابط Teams</span>') +
            '</div>';
        }).join("") : '<span class="empty">—</span>';
        return '<td data-period="' + indexes[periodIndex] + '">' + inner + '</td>';
      }).join("");
      return '<tr data-teacher="' + esc(teacher) + '"><th class="teacher"><span class="num">' + (rowIndex+1) +
        '</span><span class="teacher-name">' + esc(teacher) + '</span></th>' + cells + '</tr>';
    }).join("");

    const count = document.getElementById("count");
    if (count) count.textContent = teacherNames.length + " معلمًا — " + lessons.length + " حصة";
    const search = document.getElementById("search");
    if (search) {
      const q = search.value.trim().toLocaleLowerCase("ar");
      tableBody.querySelectorAll("tr").forEach(tr => {
        tr.hidden = !tr.innerText.toLocaleLowerCase("ar").includes(q);
      });
    }
    const day = payload.selectedDay || payload.dayName || payload.day || payload.date || payload.selectedDate || "";
    showStatus("الجدول المشترك" + (day ? " — اليوم: " + day : "") +
      " — آخر تحديث: " + (payload.updatedAt ? new Date(payload.updatedAt).toLocaleString("ar-SA") : "وقت التحديث غير متوفر") +
      " — " + lessons.length + " حصة — تحديث تلقائي كل 15 ثانية", false);
  }

  function syncOnce() {
    if (busy) return;
    busy = true;
    const callbackName = "__mirsadSync_" + Date.now() + "_" + Math.random().toString(36).slice(2);
    const script = document.createElement("script");
    let done = false;
    const timeout = setTimeout(() => finish(null, "تأخر اتصال المزامنة؛ سنحاول مجددًا تلقائيًا."), 10000);
    function finish(payload, error) {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      busy = false;
      try { delete window[callbackName]; } catch (_) { window[callbackName] = undefined; }
      script.remove();
      if (payload) {
        const version = String(payload.updatedAt || "") + "|" + String(payload.lessons.length);
        if (version !== lastVersion) {
          try {
            applyPayload(payload);
            lastVersion = version;
          } catch (_) {
            showStatus("تعذر تطبيق البيانات المشتركة؛ بقي تصميم الجدول كما هو.", true);
          }
        }
      } else if (firstLoad || error) {
        showStatus(error || "لا توجد بيانات مشتركة صالحة؛ بقي الجدول الحالي دون تغيير.", true);
      }
      firstLoad = false;
    }
    window[callbackName] = response => {
      if (!response || !response.ok || !response.payload || !Array.isArray(response.payload.lessons) || !response.payload.lessons.length) {
        finish(null, "لا توجد بيانات مشتركة صالحة؛ بقي الجدول الحالي دون تغيير.");
        return;
      }
      finish(response.payload, null);
    };
    script.onerror = () => finish(null, "تعذر الاتصال بالمصدر المشترك؛ سنحاول مجددًا تلقائيًا.");
    script.src = ENDPOINT + "?callback=" + encodeURIComponent(callbackName) + "&_=" + Date.now();
    document.head.appendChild(script);
  }

  syncOnce();
  setInterval(syncOnce, 15000);
})();