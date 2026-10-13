(() => {
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbznAVdLw5KVYmESB6Dx4av84-UQi3lewoK2Si59UNf_03y9keQf3CNxtXu0KhGbudX7Ng/exec";
  const cb = "__mirsadSharedCallback";
  const script = document.createElement("script");
  let finished = false;
  const timer = setTimeout(() => finish("تعذر تحميل المزامنة المشتركة؛ أبقينا الجدول الحالي دون تغيير."), 12000);
  function finish(message) {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    try { delete window[cb]; } catch (_) { window[cb] = undefined; }
    script.remove();
    if (message) {
      let n = document.getElementById("mirsad-sync-note");
      if (!n) {
        n = document.createElement("div");
        n.id = "mirsad-sync-note";
        document.querySelector("main")?.prepend(n);
      }
      if (n) {
        n.textContent = message;
        Object.assign(n.style, {background:"#fff7df",padding:"10px",margin:"10px 0",borderRadius:"8px",direction:"rtl",fontFamily:"Tahoma"});
      }
    }
  }
  window[cb] = (r) => {
    if (finished) return;
    if (!r || !r.ok || !r.payload || !Array.isArray(r.payload.lessons) || !r.payload.lessons.length) {
      finish("لا توجد بيانات مشتركة صالحة؛ أبقينا الجدول الحالي دون تغيير.");
      return;
    }
    try { updateExistingTable(r.payload); finish(); }
    catch (e) { finish("تعذر تطبيق المزامنة على الجدول؛ أبقينا الصفحة دون استبدال تصميمها."); }
  };
  script.onerror = () => finish("تعذر الاتصال بالمصدر المشترك؛ أبقينا الجدول الحالي دون تغيير.");
  script.src = ENDPOINT + "?callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
  document.head.appendChild(script);

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  }
  function updateExistingTable(payload) {
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
      const cells = byTeacher.get(teacher).map(items => {
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
        return '<td>' + inner + '</td>';
      }).join("");
      return '<tr data-teacher="' + esc(teacher) + '"><th class="teacher"><span class="num">' + (rowIndex+1) +
        '</span><span class="teacher-name">' + esc(teacher) + '</span></th>' + cells + '</tr>';
    }).join("");

    const count = document.getElementById("count");
    if (count) count.textContent = teacherNames.length + " معلمًا — " + lessons.length + " حصة";
    const note = document.getElementById("mirsad-sync-note");
    if (note) note.remove();

    const search = document.getElementById("search");
    if (search && !search.dataset.sharedSyncBound) {
      search.dataset.sharedSyncBound = "1";
      search.addEventListener("input", () => {
        const q = search.value.trim().toLocaleLowerCase("ar");
        tableBody.querySelectorAll("tr").forEach(tr => {
          tr.hidden = !tr.innerText.toLocaleLowerCase("ar").includes(q);
        });
      });
    }
    if (search) {
      const q = search.value.trim().toLocaleLowerCase("ar");
      tableBody.querySelectorAll("tr").forEach(tr => {
        tr.hidden = !tr.innerText.toLocaleLowerCase("ar").includes(q);
      });
    }

    let status = document.getElementById("mirsad-shared-status");
    if (!status) {
      status = document.createElement("div");
      status.id = "mirsad-shared-status";
      status.style.cssText = "background:#e0f2fe;color:#075985;padding:8px 10px;border-radius:8px;margin:8px 0;font:12px Tahoma;direction:rtl";
      document.querySelector("main")?.prepend(status);
    }
    if (status) status.textContent = "تم تحميل الجدول المشترك — آخر تحديث: " +
      (payload.updatedAt ? new Date(payload.updatedAt).toLocaleString("ar-SA") : "وقت التحديث غير متوفر") +
      " — " + lessons.length + " حصة";
  }
})();