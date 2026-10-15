(() => {
  if (window.__mirsadTeamsProbeLoaded) return;
  window.__mirsadTeamsProbeLoaded = true;

  const LABELS = [
    "الحضور", "تمت دعوة الآخرين", "لا توجد استجابة",
    "In this meeting", "People", "Invited", "Didn't respond",
    "Hasn't responded", "Attendees"
  ];
  const normalize = s => (s || "").replace(/\\s+/g, " ").trim();
  const visible = el => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  function scan() {
    const all = [...document.querySelectorAll("body *")].filter(visible);
    const foundLabels = [];
    for (const el of all) {
      const t = normalize(el.innerText || el.textContent);
      if (!t || t.length > 100) continue;
      const label = LABELS.find(x => t.toLowerCase() === x.toLowerCase());
      if (!label) continue;
      // Prefer the smallest visible element that exactly matches the heading.
      if (el.children.length && [...el.children].some(c => normalize(c.innerText || c.textContent).toLowerCase() === t.toLowerCase())) continue;
      let p = el;
      let context = "";
      for (let i = 0; i < 5 && p; i++, p = p.parentElement) {
        const pt = normalize(p.innerText || p.textContent);
        if (pt.length > t.length && pt.length < 2500) { context = pt; break; }
      }
      foundLabels.push({label, context: context || t});
    }

    const unique = [];
    const seen = new Set();
    for (const item of foundLabels) {
      const key = item.label + "|" + item.context;
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
    }
    return unique;
  }

  function mount() {
    if (document.getElementById("mirsad-teams-probe")) return;
    const panel = document.createElement("section");
    panel.id = "mirsad-teams-probe";
    panel.dir = "rtl";
    panel.style.cssText = "position:fixed;z-index:2147483647;bottom:14px;left:14px;width:340px;max-height:45vh;overflow:auto;background:#fff;color:#17202a;border:2px solid #287a54;border-radius:12px;box-shadow:0 4px 20px #0004;padding:12px;font:14px/1.6 Arial,sans-serif";
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong>مرصاد | اختبار قراءة Teams</strong><button id="mirsad-probe-close" type="button">إخفاء</button></div><p style="margin:8px 0">افتح لوحة المشاركين في الاجتماع ثم اضغط «فحص الآن». هذه أداة اختبار؛ لا تسجّل الغياب تلقائيًا.</p><button id="mirsad-probe-scan" type="button" style="padding:7px 12px;background:#287a54;color:white;border:0;border-radius:6px;cursor:pointer">فحص الآن</button><div id="mirsad-probe-results" style="margin-top:8px">لم يتم الفحص بعد.</div>';
    document.documentElement.appendChild(panel);
    panel.querySelector("#mirsad-probe-close").addEventListener("click", () => panel.remove());
    panel.querySelector("#mirsad-probe-scan").addEventListener("click", () => {
      const results = scan();
      const target = panel.querySelector("#mirsad-probe-results");
      if (!results.length) {
        target.textContent = "لم أتعرف على عناوين القوائم في الصفحة الحالية. تأكد أن لوحة المشاركين مفتوحة. لم يُسجّل أي غياب.";
        return;
      }
      target.replaceChildren();
      const note = document.createElement("p");
      note.textContent = "عناوين/مقاطع واجهة اكتُشفت (قد تتضمن نصوصًا إضافية؛ نحتاج التحقق من النتيجة):";
      target.appendChild(note);
      results.slice(0, 12).forEach(item => {
        const card = document.createElement("div");
        card.style.cssText = "border-top:1px solid #ddd;padding:6px 0;overflow-wrap:anywhere";
        const title = document.createElement("strong");
        title.textContent = item.label;
        const body = document.createElement("div");
        body.textContent = item.context;
        card.append(title, body);
        target.appendChild(card);
      });
    });
  }

  setTimeout(mount, 1800);
})();