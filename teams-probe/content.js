(() => {
  if (window.__mirsadTeamsProbeLoaded) return;
  window.__mirsadTeamsProbeLoaded = true;

  const normalize = s => (s || "")
    .normalize("NFKC")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[أإآ]/g, "ا").replace(/ى/g, "ي")
    .replace(/\s+/g, " ").trim();

  const visible = el => {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };

  const headingAliases = [
    {key:"present", labels:["الحضور","In this meeting","Attendees"]},
    {key:"invited", labels:["تمت دعوة الآخرين","Invited","Other invitees"]},
    {key:"noResponse", labels:["لا توجد استجابة","Didn't respond","Hasn't responded"]},
    {key:"organizer", labels:["المنظم","المنظّم","Organizer"]}
  ];
  const exactHeading = text => {
    const t = normalize(text).toLocaleLowerCase();
    for (const group of headingAliases) {
      if (group.labels.some(label => normalize(label).toLocaleLowerCase() === t)) return group.key;
    }
    return null;
  };

  function findSections() {
    const nodes = [...document.querySelectorAll("body *")].filter(visible);
    const headings = [];
    for (const el of nodes) {
      const txt = normalize(el.innerText || el.textContent);
      if (!txt || txt.length > 90) continue;
      const key = exactHeading(txt);
      if (!key) continue;
      if ([...el.children].some(c => normalize(c.innerText || c.textContent).toLocaleLowerCase() === txt.toLocaleLowerCase())) continue;
      headings.push({el, key, label:txt});
    }

    const sections = {present:[], invited:[], noResponse:[]};
    for (const h of headings) {
      if (h.key === "organizer") continue;
      let root = h.el;
      // Find a compact ancestor that includes this heading and nearby rows,
      // but not the whole meeting page.
      for (let i=0; i<6 && root.parentElement; i++) {
        const parent = root.parentElement;
        const txt = normalize(parent.innerText || parent.textContent);
        if (txt.length > 10000) break;
        root = parent;
        if (txt.length > h.label.length + 20 && txt.length < 6000) break;
      }
      const txt = normalize(root.innerText || root.textContent);
      if (txt && !sections[h.key].some(s => s.text === txt)) {
        sections[h.key].push({label:h.label, text:txt, root});
      }
    }
    return sections;
  }

  function tokenizeName(name) {
    return normalize(name).split(/[^\p{L}\p{N}]+/u).filter(Boolean)
      .filter(x => !["بن","ابن","ال"].includes(x));
  }

  function nameMatch(teacher, text) {
    const target = tokenizeName(teacher);
    const hayTokens = new Set(tokenizeName(text));
    if (target.length < 2 || hayTokens.size === 0) return {match:false, reason:"الاسم غير مكتمل"};
    // Match the first and last name tokens exactly. Middle-name omission is
    // allowed, but substring matches and single-token guesses are not.
    const first = target[0], last = target[target.length - 1];
    const matched = [first, last].filter((token, i) => hayTokens.has(token));
    return {match:matched.length === 2, matched, required:2};
  }

  function getTextForRoot(root) {
    return normalize(root?.innerText || root?.textContent || "");
  }

  function mount() {
    if (document.getElementById("mirsad-teams-probe")) return;
    const panel = document.createElement("section");
    panel.id = "mirsad-teams-probe";
    panel.dir = "rtl";
    panel.style.cssText = "position:fixed;z-index:2147483647;bottom:14px;right:14px;left:auto;width:400px;max-height:65vh;overflow:auto;background:#fff;color:#17202a;border:2px solid #287a54;border-radius:12px;box-shadow:0 4px 20px #0004;padding:12px;font:14px/1.6 Arial,sans-serif";
    panel.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><strong>مرصاد | فحص حضور Teams</strong><button id="mirsad-probe-close" type="button">إخفاء</button></div><p style="margin:8px 0">اكتب الاسم الرسمي للمعلم، ثم افتح لوحة المشاركين واضغط فحص. لن يسجّل الفحص غيابًا إذا كانت القراءة ملتبسة.</p><label for="mirsad-teacher-name">اسم المعلم الرسمي</label><input id="mirsad-teacher-name" type="text" placeholder="مثال: سعيد علي الشهري" style="box-sizing:border-box;width:100%;padding:8px;margin:4px 0 8px;border:1px solid #bbb;border-radius:6px"><button id="mirsad-probe-scan" type="button" style="padding:7px 12px;background:#287a54;color:white;border:0;border-radius:6px;cursor:pointer">فحص الآن</button><div id="mirsad-probe-results" style="margin-top:8px">لم يتم الفحص بعد.</div>';
    document.documentElement.appendChild(panel);
    panel.querySelector("#mirsad-probe-close").addEventListener("click", () => panel.remove());
    panel.querySelector("#mirsad-probe-scan").addEventListener("click", () => {
      const teacher = panel.querySelector("#mirsad-teacher-name").value;
      const target = panel.querySelector("#mirsad-probe-results");
      target.replaceChildren();
      const sections = findSections();
      const allText = [...sections.present, ...sections.invited, ...sections.noResponse].map(s => s.text).join("\n");
      const match = nameMatch(teacher, allText);

      const line = text => { const p=document.createElement("p"); p.textContent=text; target.appendChild(p); };
      if (!normalize(teacher)) {
        line("اكتب اسم المعلم أولًا.");
        return;
      }
      if (!sections.present.length && !sections.invited.length) {
        line("لم أستطع تحديد أقسام الحضور والمدعوين في واجهة Teams الحالية. النتيجة: غير محسوم، ولم يُسجّل غياب.");
        return;
      }
      const presentText = sections.present.map(s=>s.text).join("\n");
      const invitedText = sections.invited.map(s=>s.text).join("\n");
      const presentMatch = nameMatch(teacher, presentText);
      const invitedMatch = nameMatch(teacher, invitedText);
      line("فلتر 1 — مطابقة الاسم: " + ((presentMatch.match || invitedMatch.match) ? "وجدنا نصًا قريبًا من الاسم" : "لم نتمكن من تأكيد المطابقة"));
      line("فلتر 2 — «المنظّم» تحت سجل المعلم: " + "لم يمكن التحقق من ارتباط المسمى بسجل الاسم بصورة موثوقة من بنية الصفحة الحالية");
      line("فلتر 3 — ضمن «تمت دعوة الآخرين»: " + (invitedMatch.match ? "نعم، الاسم المحتمل يظهر في نص قسم المدعوين" : "غير مؤكد"));
      line("فلتر 4 — ضمن «الحضور» (تأكيد إضافي): " + (presentMatch.match ? "نعم، الاسم المحتمل يظهر في نص قسم الحضور" : "لم يظهر تطابق مؤكد"));
      if (presentMatch.match) {
        line("النتيجة الأولية: حاضر — لأن الاسم ظهر في قسم الحضور. يلزم التأكد من أن الاسم ليس تطابقًا مع شخص آخر.");
      } else if (invitedMatch.match) {
        line("النتيجة: غير محسوم آليًا. الاسم ظهر في قسم المدعوين، لكن لا يمكنني تأكيد أن «المنظّم» مرتبط بسجل الاسم نفسه؛ لن أسجل الغياب حتى نضبط قراءة صفوف المشاركين.");
      } else {
        line("النتيجة: غير محسوم — لم تُسجّل حالة غياب.");
      }
      const debug = document.createElement("details");
      const summary = document.createElement("summary"); summary.textContent = "عرض النصوص التي قرأتها الأداة للتشخيص";
      debug.appendChild(summary);
      for (const [label, list] of [["الحضور",sections.present],["تمت دعوة الآخرين",sections.invited],["لا توجد استجابة",sections.noResponse]]) {
        const h=document.createElement("strong"); h.textContent=label; debug.appendChild(h);
        const pre=document.createElement("pre"); pre.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.5 Arial"; pre.textContent=list.map(s=>s.text).join("\n---\n") || "لم يُكتشف"; debug.appendChild(pre);
      }
      target.appendChild(debug);
    });
  }
  async function automaticScan(teacher) {
    const clickParticipants = () => {
      const labels = ["المشاركون","المشاركين","عرض المشاركين","participants","people","show participants"];
      const controls = [...document.querySelectorAll("button,[role=button]")];
      const control = controls.find(el => {
        const label = normalize([el.getAttribute("aria-label"),el.getAttribute("title"),el.innerText].filter(Boolean).join(" "));
        return labels.some(x => label.toLocaleLowerCase().includes(normalize(x).toLocaleLowerCase()));
      });
      if (control) { control.click(); return true; }
      return false;
    };
    let sections = findSections();
    if (!sections.present.length && !sections.invited.length) {
      clickParticipants();
      await new Promise(resolve => setTimeout(resolve, 1800));
      sections = findSections();
    }
    if (!sections.present.length && !sections.invited.length) {
      return {status:"unresolved",detail:"لم يمكن تحديد أقسام الحضور والمدعوين تلقائيًا."};
    }
    const teacherTokens = tokenizeName(teacher);
    const scanRows = (sectionList) => {
      const matches = [];
      const seenRows = new Set();
      if (teacherTokens.length < 2) return matches;
      const selector = '[role="listitem"],[role="option"],[role="treeitem"],li,[data-tid*="roster"],[data-tid*="participant"]';
      for (const section of sectionList) {
        const root = section.root;
        if (!root?.querySelectorAll) continue;
        const candidates = [...root.querySelectorAll(selector)];
        // Prefer the smallest matching participant record. Broad ancestor
        // containers may contain several people and must not lend the
        // organizer label of one person to another.
        const matching = candidates.filter(row => {
          const text = normalize(row.innerText || row.textContent);
          if (!text || text.length > 300 || text.length < 2) return false;
          const tokens = new Set(tokenizeName(text));
          return tokens.has(teacherTokens[0]) && tokens.has(teacherTokens[teacherTokens.length - 1]);
        });
        const leafMatches = matching.filter(row => ![...row.querySelectorAll(selector)].some(child => {
          const text = normalize(child.innerText || child.textContent);
          const tokens = new Set(tokenizeName(text));
          return text.length >= 2 && text.length <= 300 && tokens.has(teacherTokens[0]) && tokens.has(teacherTokens[teacherTokens.length - 1]);
        }));
        for (const row of (leafMatches.length ? leafMatches : matching)) {
          const rowText = normalize(row.innerText || row.textContent);
          if (seenRows.has(rowText)) continue;
          seenRows.add(rowText);
          matches.push({
            text:rowText,
            organizer:/\\borganizer\\b/i.test(rowText) || rowText.includes("المنظّم") || rowText.includes("المنظم")
          });
        }
      }
      return matches;
    };
    const presentRows = scanRows(sections.present);
    const invitedRows = scanRows(sections.invited);
    if (presentRows.length === 1 && invitedRows.length === 0) {
      return {status:"present",detail:"تطابق الاسم داخل سجل مشارك واحد في قسم الحضور."};
    }
    if (presentRows.length > 0 || invitedRows.length > 1) {
      return {status:"unresolved",detail:"تطابق الاسم في أكثر من سجل أو في أكثر من قسم؛ لا يُسجّل حكم."};
    }
    if (invitedRows.length === 1) {
      if (invitedRows[0].organizer) {
        return {status:"absent",detail:"ظهر الاسم في سجل واحد بقسم المدعوين، ووسم المنظّم في السجل نفسه."};
      }
      return {status:"invited",detail:"ظهر الاسم في سجل المدعوين لكن لم يثبت وسم المنظّم في السجل نفسه؛ لا يُسجّل غياب."};
    }
    return {status:"unresolved",detail:"لم يُعثر على سجل مشارك يطابق الاسم بصورة كافية؛ لا يُسجّل غياب."};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MIRSAD_AUTO_SCAN") {
      automaticScan(message.teacher || "").then(sendResponse).catch(() => sendResponse({status:"unresolved",detail:"تعذر فحص واجهة Teams."}));
      return true;
    }
  });

  function clickExactButton(labels) {
    const controls = [...document.querySelectorAll("button,[role=button],input[type=button],input[type=submit]")];
    const normalizedLabels = labels.map(x => normalize(x).toLocaleLowerCase());
    const el = controls.find(node => {
      const label = normalize([node.innerText,node.getAttribute("aria-label"),node.getAttribute("title"),node.value].filter(Boolean).join(" ")).toLocaleLowerCase();
      return visible(node) && normalizedLabels.some(x => label === x);
    });
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    el.click();
    return true;
  }

  async function attemptJoinIfReady() {
    const joinedHints = ["participants","people","المشاركون","المشاركين","leave","مغادرة"];
    const bodyText = normalize(document.body?.innerText || "").toLocaleLowerCase();
    if (joinedHints.some(x => bodyText.includes(normalize(x).toLocaleLowerCase())) &&
        document.querySelector('[data-tid*="roster"],[data-tid*="participant"],[aria-label*="participants" i]')) return "already-in";
    // Retry briefly because Teams often renders its join control after the page shell.
    const joinLabels = [
      "join now","join","join meeting","join the meeting","join on the web",
      "انضمام الآن","الانضمام الآن","انضم الآن","الانضمام","انضمام","الانضمام إلى الاجتماع","انضمام للاجتماع"
    ];
    for (let attempt = 0; attempt < 8; attempt++) {
      if (clickExactButton(joinLabels)) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        return "clicked-join";
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return "join-not-available";
  }

  async function leaveMeetingIfJoined() {
    // Leave only via an explicit Teams leave control; never end the meeting.
    const clicked = clickExactButton(["leave","leave meeting","مغادرة","مغادرة الاجتماع"]);
    if (clicked) await new Promise(resolve => setTimeout(resolve, 1200));
    return clicked;
  }

  // Prefer staying in the browser when Teams offers an explicit web fallback.
  // This deliberately does NOT click Join/Admit buttons or bypass sign-in.
  function chooseBrowserFallback() {
    const labels = [
      "continue on this browser",
      "use teams on the web instead",
      "join on the web instead",
      "continue in this browser",
      "متابعة على هذا المستعرض",
      "المتابعة على هذا المستعرض",
      "استخدام teams على الويب",
      "الانضمام على الويب بدلًا من ذلك",
      "الانضمام على الويب بدلا من ذلك"
    ];
    const controls = [...document.querySelectorAll("button,a,[role=button]")];
    const candidate = controls.find(el => {
      const label = normalize([el.innerText,el.getAttribute("aria-label"),el.getAttribute("title")].filter(Boolean).join(" "));
      return label && labels.some(x => label.toLocaleLowerCase().includes(normalize(x).toLocaleLowerCase()));
    });
    if (!candidate || candidate.dataset.mirsadWebFallbackClicked === "1") return false;
    candidate.dataset.mirsadWebFallbackClicked = "1";
    candidate.click();
    return true;
  }

  // Teams can show a landing page that offers the desktop app and web options.
  // Retry briefly while the landing UI renders, but never click Join or Admit.
  async function preferBrowserForLandingPage() {
    for (let i = 0; i < 5; i++) {
      if (chooseBrowserFallback()) {
        await new Promise(resolve => setTimeout(resolve, 1800));
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    return false;
  }

  // Automatic mode: the extension popup controls the run; no manual teacher-name panel.
  if (!window.__mirsadAutoPageHandshake) {
    window.__mirsadAutoPageHandshake = true;
    chrome.runtime.sendMessage({type:"MIRSAD_PAGE_READY"}).then(async target => {
      if (!target?.active || !target.teacher) return;
      await new Promise(resolve => setTimeout(resolve, 1500));
      await preferBrowserForLandingPage();
      const joinState = await attemptJoinIfReady();
      // The extension only clicks a clearly labelled Join button; it does not bypass
      // sign-in, name entry, lobby admission, or permissions.
      let result = {status:"unresolved",detail:"لم يتأكد الدخول إلى الاجتماع أو لم تظهر قائمة المشاركين؛ لم يُسجّل غياب."};
      if (joinState === "join-not-available") {
        result = {status:"unresolved",detail:"لم يظهر زر انضمام جاهز. قد تتطلب الصفحة تسجيل الدخول أو إدخال اسم أو موافقة المنظّم؛ لم يُسجّل غياب."};
      } else {
        for (let attempt = 0; attempt < 10; attempt++) {
          await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 2500 : 3000));
          result = await automaticScan(target.teacher);
          if (result.status !== "unresolved" ||
              !/لم يمكن تحديد أقسام الحضور|لم يتم الانضمام|لم تظهر قائمة المشاركين|تعذر تحديد أقسام/i.test(result.detail || "")) {
            break;
          }
        }
      }
      await leaveMeetingIfJoined();
      chrome.runtime.sendMessage({type:"MIRSAD_SCAN_RESULT", scanId:target.scanId, result});
    }).catch(() => {});
  }
})();