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
    const participantsPanelOpen = () => {
      const text = normalize(document.body?.innerText || "").toLocaleLowerCase();
      return (text.includes("الحضور") && text.includes("تمت دعوة الآخرين")) ||
        [...document.querySelectorAll("[role=dialog],[data-tid*='roster' i],[data-tid*='participant' i]")].some(visible);
    };
    const clickParticipants = () => {
      const labels = ["أشخاص","الأشخاص","المشاركون","المشاركين","عرض المشاركين","people","participants","view participants","show participants"];
      const nodes = [...document.querySelectorAll("button,[role=button],[role=menuitem],[data-tid],span,div")];
      const matches = nodes.filter(el => {
        if (!visible(el)) return false;
        const label = normalize([el.getAttribute("aria-label"),el.getAttribute("title"),el.getAttribute("data-tid"),el.innerText,el.textContent].filter(Boolean).join(" ")).toLocaleLowerCase();
        return label && labels.some(x => label === normalize(x).toLocaleLowerCase() || label.startsWith(normalize(x).toLocaleLowerCase()+" "));
      });
      // Click the nearest actual interactive ancestor, not just the visible text span.
      for (const node of matches) {
        const target = node.closest("button,[role=button],[role=menuitem]") || node;
        if (!visible(target)) continue;
        try { target.scrollIntoView({block:"nearest"}); } catch (_) {}
        try { target.click(); return true; } catch (_) {}
      }
      return false;
    };
    if (!participantsPanelOpen()) {
      for (let attempt = 0; attempt < 12; attempt++) {
        clickParticipants();
        for (let wait = 0; wait < 6; wait++) {
          await new Promise(resolve => setTimeout(resolve, 500));
          if (participantsPanelOpen()) break;
        }
        if (participantsPanelOpen()) break;
        await new Promise(resolve => setTimeout(resolve, 700));
      }
    }
    let sections = findSections();
    if (!sections.present.length && !sections.invited.length) {
      clickParticipants();
      // Teams renders the side panel asynchronously; give it time and retry once.
      for (let attempt = 0; attempt < 5; attempt++) {
        await new Promise(resolve => setTimeout(resolve, 900));
        sections = findSections();
        if (sections.present.length || sections.invited.length) break;
        if (attempt === 2) clickParticipants();
      }
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
    if (presentRows.length === 1) {
      return {status:"present",detail:presentRows[0].organizer
        ? "ظهر اسم المعلم في قسم الحضور، وظهر وسم المنظّم في السجل نفسه."
        : "ظهر اسم المعلم في قسم الحضور؛ لم يُشترط وسم المنظّم لتسجيل الحضور."};
    }
    if (presentRows.length > 1 || invitedRows.length > 1 || (presentRows.length > 0 && invitedRows.length > 0)) {
      return {status:"unresolved",detail:"تطابق الاسم في أكثر من سجل أو في قسمي الحضور والمدعوين؛ لا يُسجّل حكم."};
    }
    if (invitedRows.length === 1) {
      return {status:"invited",detail:"ظهر الاسم في قسم «تمت دعوة الآخرين» ولم يظهر في قسم الحضور؛ لم يحضر حتى الآن، وليس غيابًا نهائيًا."};
    }
    return {status:"unresolved",detail:"لم يُعثر على سجل يطابق الاسم في قسمي الحضور والمدعوين؛ لا يُسجّل غياب."};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MIRSAD_AUTO_SCAN") {
      automaticScan(message.teacher || "").then(sendResponse).catch(() => sendResponse({status:"unresolved",detail:"تعذر فحص واجهة Teams."}));
      return true;
    }
  });

  function clickExactButton(labels) {
    const controls = [...document.querySelectorAll("button,[role=button],input[type=button],input[type=submit],a")];
    const normalizedLabels = labels.map(x => normalize(x).toLocaleLowerCase());
    const el = controls.find(node => {
      const label = normalize([node.innerText,node.textContent,node.getAttribute("aria-label"),node.getAttribute("title"),node.value].filter(Boolean).join(" ")).toLocaleLowerCase();
      return visible(node) && normalizedLabels.some(x => label === x || label.includes(x));
    });
    if (!el || el.disabled || el.getAttribute("aria-disabled") === "true") return false;
    try { el.focus({preventScroll:true}); } catch (_) {}
    el.click();
    return true;
  }

  function meetingLooksJoined() {
    const bodyText = normalize(document.body?.innerText || "").toLocaleLowerCase();
    const hasLeave = ["leave","leave meeting","مغادرة","مغادرة الاجتماع"].some(x => bodyText.includes(normalize(x).toLocaleLowerCase()));
    const hasPeopleControl = [...document.querySelectorAll("button,[role=button]")].some(el => {
      const label = normalize([el.innerText,el.getAttribute("aria-label"),el.getAttribute("title")].filter(Boolean).join(" ")).toLocaleLowerCase();
      return ["people","participants","المشاركون","المشاركين","الأشخاص"].some(x => label.includes(normalize(x).toLocaleLowerCase()));
    });
    return hasLeave && hasPeopleControl;
  }

  async function attemptJoinIfReady() {
    if (meetingLooksJoined()) return "already-in";
    // Retry while Teams renders the pre-join page and its explicit Join control.
    const joinLabels = [
      "join now","join","join meeting","join the meeting","join on the web",
      "انضمام الآن","الانضمام الآن","انضم الآن","الانضمام","انضمام","الانضمام إلى الاجتماع","انضمام للاجتماع"
    ];
    for (let attempt = 0; attempt < 12; attempt++) {
      if (clickExactButton(joinLabels)) {
        // Wait for the meeting view to appear, rather than assuming a click means success.
        for (let wait = 0; wait < 15; wait++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (meetingLooksJoined()) return "joined";
          const body = normalize(document.body?.innerText || "").toLocaleLowerCase();
          if (body.includes("waiting in the lobby") || body.includes("someone will let you in") ||
              body.includes("في ساحة الانتظار") || body.includes("سينضم إليك المنظم")) return "waiting-for-admission";
        }
        return "join-clicked-not-confirmed";
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
      // Give Teams extra time to render its meeting toolbar after joining.
      await new Promise(resolve => setTimeout(resolve, 4000));
      await preferBrowserForLandingPage();
      const joinState = await attemptJoinIfReady();
      // The extension only clicks a clearly labelled Join button; it does not bypass
      // sign-in, name entry, lobby admission, or permissions.
      let result = {status:"unresolved",detail:"لم يتأكد الدخول إلى الاجتماع أو لم تظهر قائمة المشاركين؛ لم يُسجّل غياب."};
      if (joinState === "join-not-available") {
        result = {status:"unresolved",detail:"لم يظهر زر «الانضمام الآن» جاهزًا. قد تتطلب الصفحة تسجيل الدخول أو اختيار الحساب؛ لم يُسجّل غياب."};
      } else if (joinState === "waiting-for-admission") {
        result = {status:"unresolved",detail:"تم طلب الانضمام لكن Teams يعرض انتظار موافقة المنظّم؛ لم يُسجّل غياب."};
      } else if (joinState === "join-clicked-not-confirmed") {
        result = {status:"unresolved",detail:"ضغط مرصاد زر الانضمام، لكن لم يتأكد ظهور واجهة الاجتماع؛ لم يُسجّل غياب."};
      } else {
        // Let the post-join toolbar settle before opening the People panel; retry
        // the roster scan for up to roughly 45 seconds before closing the tab.
        await new Promise(resolve => setTimeout(resolve, 5000));
        for (let attempt = 0; attempt < 15; attempt++) {
          await new Promise(resolve => setTimeout(resolve, attempt === 0 ? 1500 : 2500));
          result = await automaticScan(target.teacher);
          if (result.status !== "unresolved" ||
              !/لم يمكن تحديد أقسام الحضور|لم يتم الانضمام|لم تظهر قائمة المشاركين|تعذر تحديد أقسام/i.test(result.detail || "")) {
            break;
          }
        }
      }
      // Do not click Leave unless the meeting UI confirms that we actually joined.
      if (meetingLooksJoined()) await leaveMeetingIfJoined();
      chrome.runtime.sendMessage({type:"MIRSAD_SCAN_RESULT", scanId:target.scanId, result});
    }).catch(() => {});
  }
})();