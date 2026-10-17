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
      for (const label of group.labels) {
        const expected = normalize(label).toLocaleLowerCase();
        // Accept the label itself or a live count appended by Teams:
        // "الحضور (1)", "تمت دعوة الآخرين (30/31)", and count variants.
        if (t === expected) return group.key;
        if (t.startsWith(expected)) {
          const suffix = t.slice(expected.length).trim();
          if (!suffix || /^[：:]$/.test(suffix) ||
              /^[（(]?\s*\d+(?:\s*[/،,]\s*\d+)?\s*[）)]?$/.test(suffix)) {
            return group.key;
          }
        }
      }
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
    const sectionHeadings = headings.filter(h => h.key === "present" || h.key === "invited" || h.key === "noResponse");
    for (const h of sectionHeadings) {
      let root = h.el;
      // Grow the section container only while it remains inside this section.
      // If an ancestor also contains another section heading, stop before it;
      // otherwise the same teacher row can be counted as both present and invited.
      for (let i=0; i<8 && root.parentElement; i++) {
        const parent = root.parentElement;
        const txt = normalize(parent.innerText || parent.textContent);
        if (txt.length > 10000) break;
        const containsOtherSection = sectionHeadings.some(other =>
          other !== h && parent.contains(other.el)
        );
        if (containsOtherSection) break;
        root = parent;
        if (txt.length > h.label.length + 20 && txt.length < 6000) break;
      }
      const txt = normalize(root.innerText || root.textContent);
      if (txt && !sections[h.key].some(s => s.root === root || s.text === txt)) {
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
      // Teams desktop web exposes the People control as button[data-inp="roster-button"].
      const exact = document.querySelector('button[data-inp="roster-button"],button[aria-label="أشخاص"]');
      if (exact && visible(exact) && !exact.disabled && exact.getAttribute("aria-disabled") !== "true") {
        try { exact.scrollIntoView({block:"nearest"}); } catch (_) {}
        exact.click();
        return true;
      }
      const labels = ["أشخاص","الأشخاص","المشاركون","المشاركين","عرض المشاركين","people","participants","view participants","show participants"];
      const nodes = [...document.querySelectorAll("button,[role=button],[role=menuitem],[data-tid],span,div")];
      const matches = nodes.filter(el => {
        if (!visible(el)) return false;
        const label = normalize([el.getAttribute("aria-label"),el.getAttribute("title"),el.getAttribute("data-tid"),el.innerText,el.textContent].filter(Boolean).join(" ")).toLocaleLowerCase();
        return label && labels.some(x => label === normalize(x).toLocaleLowerCase() || label.startsWith(normalize(x).toLocaleLowerCase()+" "));
      });
      for (const node of matches) {
        const target = node.closest("button,[role=button],[role=menuitem]") || node;
        if (!visible(target)) continue;
        try { target.scrollIntoView({block:"nearest"}); } catch (_) {}
        try { target.click(); return true; } catch (_) {}
      }
      return false;
    };
    // The People control is a toggle. Across the outer retry loop, click it only
    // once for this probe tab; otherwise a failed parser can close the pane it opened.
    let sections = findSections();
    let clickedPeopleNow = false;
    if (!sections.present.length && !sections.invited.length && !window.__mirsadRosterClickAttempted) {
      const clicked = clickParticipants();
      if (!clicked) {
        const people = document.querySelector('button#roster-button,button[data-inp="roster-button"],button[aria-label="أشخاص"]');
        return {status:"unresolved",detail:"التشخيص: لم أجد زر «أشخاص» قابلًا للضغط. زر roster=" + (!!people) + "، ظاهر=" + (!!people && visible(people)) + "، عناوين الحضور المكتشفة=0؛ لم يُسجّل غياب."};
      }
      window.__mirsadRosterClickAttempted = true;
      clickedPeopleNow = true;
    }
    // Whether this is the first attempt or a retry, wait for the same pane;
    // never toggle People closed while waiting for its content to become readable.
    if (!sections.present.length && !sections.invited.length) {
      for (let attempt = 0; attempt < (clickedPeopleNow ? 6 : 2); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 1000));
        sections = findSections();
        if (sections.present.length || sections.invited.length) break;
      }
    }
    if (!sections.present.length && !sections.invited.length) {
      const people = document.querySelector('button#roster-button,button[data-inp="roster-button"],button[aria-label="أشخاص"]');
      const dialogs = [...document.querySelectorAll('[role="dialog"],[data-tid*="roster" i],[data-tid*="participant" i]')].filter(visible).length;
      const visibleText = normalize(document.body?.innerText || "");
      const hasPresentHeading = /الحضور|attendees|in this meeting/i.test(visibleText);
      const hasInvitedHeading = /تمت دعوة الآخرين|other invitees|invited/i.test(visibleText);
      // Include short visible heading-like snippets so a changed Teams label
      // can be diagnosed without dumping participant names into the report.
      const headingSnippets = [...document.querySelectorAll("body *")]
        .filter(el => visible(el))
        .map(el => ({el, text:normalize(el.innerText || el.textContent)}))
        .filter(x => x.text && x.text.length <= 100 &&
          /الحضور|تمت دعوة|attendees|in this meeting|invitees|invited/i.test(x.text))
        .filter(x => ![...x.el.children].some(c => normalize(c.innerText || c.textContent) === x.text))
        .slice(0, 6)
        .map(x => (x.el.tagName.toLowerCase() + (x.el.getAttribute("data-tid") ? "[" + x.el.getAttribute("data-tid").slice(0,40) + "]" : "") + "=" + x.text))
        .join(" | ");
      return {status:"unresolved",detail:"التشخيص: ضغط الأشخاص في هذه الصفحة=" + (!!window.__mirsadRosterClickAttempted) + "؛ زر الأشخاص ظاهر=" + (!!people && visible(people)) + "؛ نوافذ/حاويات مشاركين ظاهرة=" + dialogs + "؛ نص عنوان الحضور موجود=" + hasPresentHeading + "؛ نص عنوان المدعوين موجود=" + hasInvitedHeading + "؛ أقسام القراءة المكتشفة=0؛ نماذج العناوين=" + (headingSnippets || "لا توجد").slice(0, 700) + ". قائمة Teams لم تُقرأ بنجاح؛ لم يُسجّل غياب."};
    }
    // Organizer-only rule: the name attached to the Teams organizer badge is
    // the teacher identity. Never compare it against timetable teacher names.
    const organizerWord = /(?:المنظّم|المنظم|organizer)/i;
    const sectionLabels = [
      {key:"present", re:/الحضور(?:\s*\(\s*\d+(?:\s*[/،,]\s*\d+)?\s*\))?|in this meeting|attendees/i},
      {key:"invited", re:/تمت دعوة الآخرين|تمت دعوة الاخرين|invited|other invitees/i},
      {key:"noResponse", re:/لا توجد استجابة|لم يستجب|didn.t respond|hasn.t responded/i}
    ];
    const classifyTextAroundOrganizer = text => {
      const normalized = normalize(text);
      const badge = normalized.search(organizerWord);
      if (badge < 0) return "unknown";
      let latest = {key:"unknown", index:-1};
      for (const label of sectionLabels) {
        const re = new RegExp(label.re.source, "ig");
        let match;
        while ((match = re.exec(normalized)) !== null) {
          if (match.index < badge && match.index > latest.index) latest = {key:label.key,index:match.index};
        }
      }
      return latest.key;
    };
    const organizerElements = [...document.querySelectorAll("body *")].filter(visible).filter(el => {
      const own = normalize([
        el.getAttribute("aria-label"), el.getAttribute("title"),
        el.getAttribute("data-tid"), el.innerText, el.textContent
      ].filter(Boolean).join(" ")).toLocaleLowerCase();
      return /^(?:المنظّم|المنظم|organizer)$/.test(own) ||
        /(?:^|\s)(?:المنظّم|المنظم|organizer)(?:$|\s)/.test(own) && own.length <= 50;
    });
    const candidates = [];
    for (const badge of organizerElements) {
      let node = badge;
      let name = "";
      let section = "unknown";
      let contextText = "";
      for (let depth=0; depth<8 && node; depth++, node=node.parentElement) {
        const text = normalize(node.innerText || node.textContent);
        if (!text || text.length > 2500) continue;
        const badgeIndex = text.search(organizerWord);
        if (badgeIndex < 0) continue;
        const before = text.slice(0,badgeIndex).trim();
        const cleaned = before.replace(/(?:الحضور|تمت دعوة الآخرين|تمت دعوة الاخرين|لا توجد استجابة|in this meeting|attendees|invited|other invitees)/ig," ").trim();
        const words = cleaned.split(/\s+/).filter(Boolean);
        if (words.length >= 1 && words.length <= 7 && !name) name = cleaned;
        const detected = classifyTextAroundOrganizer(text);
        if (detected !== "unknown") { section=detected; contextText=text; }
        if (name && section !== "unknown" && text.length < 500) break;
      }
      name = name.replace(/[\s:：\-–—|]+$/g,"").trim();
      if (name && name.length <= 100) candidates.push({name,section,contextText});
    }
    const uniqueCandidates = candidates.filter((x,i,all)=>
      all.findIndex(y=>normalize(y.name)===normalize(x.name) && y.section===x.section)===i
    );
    const classified = uniqueCandidates.filter(x=>x.section==="present" || x.section==="invited");
    if (classified.length === 1) {
      const person = classified[0];
      if (person.section === "present") {
        return {status:"present",teacher:person.name,detail:"المعلّم «"+person.name+"» مرتبط بوسم «المنظّم» ويظهر ضمن «الحضور»؛ الحالة: حاضر."};
      }
      return {status:"absent",teacher:person.name,detail:"المعلّم «"+person.name+"» مرتبط بوسم «المنظّم» ويظهر ضمن «تمت دعوة الآخرين» وليس ضمن «الحضور»؛ الحالة: غائب."};
    }
    if (uniqueCandidates.length) {
      return {status:"unresolved",teacher:uniqueCandidates[0].name,detail:"عُثر على المنظّم باسم «"+uniqueCandidates[0].name+"»، لكن تعذّر تحديد القسم المرتبط به بثقة؛ لم تُسجّل حالة حضور أو غياب."};
    }
    return {status:"unresolved",detail:"لم يُعثر على اسم واضح مرتبط بوسم «المنظّم»؛ لم تُسجّل حالة حضور أو غياب."};
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
    // The actual Arabic Teams toolbar label is "أشخاص" (not only "الأشخاص").
    // Prefer its stable DOM selector, which was confirmed in the live page.
    const peopleButton = document.querySelector('button#roster-button,button[data-inp="roster-button"],button[aria-label="أشخاص"]');
    const hasPeopleControl = !!(peopleButton && visible(peopleButton)) ||
      [...document.querySelectorAll("button,[role=button]")].some(el => {
        const label = normalize([el.innerText,el.getAttribute("aria-label"),el.getAttribute("title")].filter(Boolean).join(" ")).toLocaleLowerCase();
        return ["people","participants","أشخاص","الأشخاص","المشاركون","المشاركين"].some(x => label.includes(normalize(x).toLocaleLowerCase()));
      });
    return hasLeave && hasPeopleControl;
  }

  async function attemptJoinIfReady() {
    // If the live Teams toolbar is already present, do not click Join again.
    // The roster button is a stronger page-state signal than translated body text.
    const livePeopleButton = document.querySelector('button#roster-button,button[data-inp="roster-button"],button[aria-label="أشخاص"]');
    if (livePeopleButton && visible(livePeopleButton)) return "already-in";
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
    for (let i = 0; i < 3; i++) {
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
    chrome.runtime.sendMessage({type:"MIRSAD_PAGE_READY"}).then(async firstTarget => {
      // Background state may not be ready at the exact moment Teams loads.
      // Poll briefly rather than silently exiting and waiting for the 90s timeout.
      let target = firstTarget;
      for (let attempt = 0; attempt < 10 && (!target?.active || !target.teacher || !target.scanId); attempt++) {
        await new Promise(resolve => setTimeout(resolve, 700));
        target = await chrome.runtime.sendMessage({type:"MIRSAD_PAGE_READY"});
      }
      if (!target?.active || !target.teacher || !target.scanId) return;
      // Give Teams extra time to render its meeting toolbar after joining.
      await new Promise(resolve => setTimeout(resolve, 2000));
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
        // Shorten settling/retries so a 12-class cycle does not waste time on every link.
        await new Promise(resolve => setTimeout(resolve, 2000));
        for (let attempt = 0; attempt < 6; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
          result = await automaticScan(target.teacher);
          if (result.status !== "unresolved" ||
              !/لم يمكن تحديد أقسام الحضور|لم يتم الانضمام|لم تظهر قائمة المشاركين|تعذر تحديد أقسام|التشخيص:/i.test(result.detail || "")) {
            break;
          }
        }
      }
      // Save a local screenshot of the participant list for absent results, before leaving.
      if (result.status === "absent") {
        try { await chrome.runtime.sendMessage({type:"MIRSAD_CAPTURE_EVIDENCE",scanId:target.scanId,teacher:result.teacher||target.teacher,period:target.period,status:result.status,detail:result.detail}); } catch (_) {}
      }
      // Do not click Leave unless the meeting UI confirms that we actually joined.
      if (meetingLooksJoined()) await leaveMeetingIfJoined();
      chrome.runtime.sendMessage({type:"MIRSAD_SCAN_RESULT", scanId:target.scanId, result});
    }).catch(async error => {
      // Never let an internal content-script exception silently consume the
      // whole 90-second background timeout. Return a diagnostic result instead.
      try {
        const target = await chrome.runtime.sendMessage({type:"MIRSAD_PAGE_READY"});
        if (target?.active && target.scanId) {
          const detail = "تعطل فحص Teams بسبب خطأ داخلي: " +
            String(error?.message || error || "خطأ غير معروف").slice(0, 180) +
            ". لم يُسجّل غياب.";
          await chrome.runtime.sendMessage({
            type:"MIRSAD_SCAN_RESULT",
            scanId:target.scanId,
            result:{status:"unresolved",detail}
          });
        }
      } catch (_) {}
    });
  }
})();