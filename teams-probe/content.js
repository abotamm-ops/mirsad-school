(() => {
  if (window.__mirsadTeamsProbeLoaded) return;
  window.__mirsadTeamsProbeLoaded = true;

  const HEADINGS = [
    "الحضور", "تمت دعوة الآخرين", "لا توجد استجابة", "المنظم",
    "In this meeting", "People", "Invited", "Didn't respond",
    "Hasn't responded", "Organizer", "Attendees"
  ];
  const normalize = s => (s || "").replace(/\s+/g, " ").trim();
  const visible = el => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function scan() {
    const all = [...document.querySelectorAll("body *")].filter(visible);
    const found = [];
    const seen = new Set();

    for (const el of all) {
      const raw = normalize(el.innerText || el.textContent);
      if (!raw || raw.length > 100) continue;
      const heading = HEADINGS.find(x => raw.toLocaleLowerCase() === x.toLocaleLowerCase());
      if (!heading) continue;

      // Skip containers whose child already has the same exact heading.
      if ([...el.children].some(c => normalize(c.innerText || c.textContent).toLocaleLowerCase() === raw.toLocaleLowerCase())) continue;

      let p = el.parentElement;
      let context = raw;
      for (let i = 0; i < 7 && p; i++, p = p.parentElement) {
        const txt = normalize(p.innerText || p.textContent);
        if (txt.length > raw.length && txt.length <= 6000) {
          context = txt;
          // Prefer a compact section rather than the entire meeting pane.
          if (txt.length <= 1800) break;
        }
      }
      const key = heading + "|" + context;
      if (!seen.has(key)) {
        seen.add(key);
        found.push({heading, context});
      }
    }
    return found;
  }

  function mount() {
    if (document.getElementById("mirsad-teams-probe")) return;
    const panel = document.createElement("section");
    panel.id = "mirsad-teams-probe";
    panel.dir = "rtl";
    panel.style.cssText = "position:fixed;z-index:2147483647;bottom:14px;left:14px;width:360px;max-height:48vh;overflow:auto;background:#fff;color:#17202a;border:2px solid #287a54;border-radius:12px;box-shadow:0 4px 20px #0004;padding:12px;font:14px/1.6 Arial,sans-serif";
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong>مرصاد | اختبار قراءة Teams</strong><button id="mirsad-probe-close" type="button">إخفاء</button></div><p style="margin:8px 0">افتح لوحة المشاركين ثم اضغط «فحص الآن». لا تسجّل هذه الأداة الغياب تلقائيًا.</p><button id="mirsad-probe-scan" type="button" style="padding:7px 12px;background:#287a54;color:white;border:0;border-radius:6px;cursor:pointer">فحص الآن</button><div id="mirsad-probe-results" style="margin-top:8px">لم يتم الفحص بعد.</div>';
    document.documentElement.appendChild(panel);
    panel.querySelector("#mirsad-probe-close").addEventListener("click", () => panel.remove());
    panel.querySelector("#mirsad-probe-scan").addEventListener("click", () => {
      const results = scan();
      const target = panel.querySelector("#mirsad-probe-results");
      if (!results.length) {
        target.textContent = "لم أتعرف على عناوين الأقسام في واجهة Teams الحالية. لم يُسجّل أي غياب. تأكد أن قائمة المشاركين مفتوحة ثم أعد الفحص.";
        return;
      }
      target.replaceChildren();
      const note = document.createElement("p");
      note.textContent = "النصوص التي عثر عليها قرب عناوين الأقسام؛ هذه نتيجة تشخيصية وليست حكم حضور نهائيًا:";
      target.appendChild(note);
      results.slice(0, 10).forEach(item => {
        const card = document.createElement("div");
        card.style.cssText = "border-top:1px solid #ddd;padding:6px 0;overflow-wrap:anywhere;white-space:normal";
        const title = document.createElement("strong");
        title.textContent = item.heading;
        const body = document.createElement("div");
        body.textContent = item.context;
        card.append(title, body);
        target.appendChild(card);
      });
    });
  }
  setTimeout(mount, 1200);
})();