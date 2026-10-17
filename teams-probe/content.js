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
          const rowAttrs = [...row.querySelectorAll("[aria-label],[title],[data-tid]"), row]
            .map(el => [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-tid")]
              .filter(Boolean).join(" "))
            .join(" ");
          const evidenceText = normalize(rowText + " " + rowAttrs).toLocaleLowerCase();
          // A visible X/close icon can be represented by aria-label/title/data-tid;
          // accept only explicit presence/connection labels, not microphone mute alone.
          const xEvidence = /(?:^|\s)(?:x|×|✕|✖)(?:\s|$)/i.test(rowAttrs) ||
            /(?:disconnected|not connected|connection lost|غير متصل|غير متواجـد|انقطع الاتصال|لم ينضم|لم يتصل)/i.test(evidenceText);
          const lastSeenMatch = evidenceText.match(/(?:آخر ظهور|آخر نشاط|last seen|last active)\s*[:：]?\s*(.{1,50})/i);
          const lastSeenText = lastSeenMatch ? normalize(lastSeenMatch[1]) : "";
          const hasLastSeenBeforeCurrent = !!lastSeenText && /(?:قبل|ago|منذ|yesterday|أمس|دقيقة|دقائق|ثانية|ثوانٍ|ساعة|ساعات)/i.test(lastSeenText);
          matches.push({
            text:rowText,
            organizer:/\borganizer\b/i.test(rowText) || rowText.includes("المنظّم") || rowText.includes("المنظم"),
            xEvidence,
            lastSeenText,
            hasLastSeenBeforeCurrent
          });
        }
      }
      // Fallback for Teams UI variants where participant rows do not expose
      // listitem/option/treeitem/data-tid semantics. Search the isolated section
      // for the smallest DOM elements that contain both name tokens, then keep
      // only a bounded ancestor whose own text/accessible labels also contain
      // the organizer badge. This avoids borrowing the badge from another row.
      if (matches.length === 0) {
        for (const section of sectionList) {
          const root = section.root;
          if (!root?.querySelectorAll) continue;
          const elements = [...root.querySelectorAll("*")];
          const named = elements.filter(el => {
            const text = normalize(el.innerText || el.textContent);
            if (!text || text.length > 300 || text.length < 2) return false;
            const tokens = new Set(tokenizeName(text));
            return tokens.has(teacherTokens[0]) && tokens.has(teacherTokens[teacherTokens.length - 1]);
          });
          // Start from the smallest name-bearing element and walk upward only
          // within this section, stopping before an ancestor that contains a
          // second matching person or grows beyond a single-record-sized text.
          for (const leaf of named.filter(el => !named.some(other => other !== el && el.contains(other)))) {
            let row = leaf;
            for (let depth = 0; depth < 5 && row.parentElement && row.parentElement !== root; depth++) {
              const parent = row.parentElement;
              const text = normalize(parent.innerText || parent.textContent);
              if (text.length > 500) break;
              const tokens = new Set(tokenizeName(text));
              if (!tokens.has(teacherTokens[0]) || !tokens.has(teacherTokens[teacherTokens.length - 1])) break;
              row = parent;
              const attrs = [...row.querySelectorAll("[aria-label],[title],[data-tid]"), row]
                .map(el => [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-tid")].filter(Boolean).join(" ")).join(" ");
              const combined = normalize(text + " " + attrs).toLocaleLowerCase();
              if (/المنظّم|المنظم|\borganizer\b/i.test(combined)) break;
            }
            const rowText = normalize(row.innerText || row.textContent);
            const rowAttrs = [...row.querySelectorAll("[aria-label],[title],[data-tid]"), row]
              .map(el => [el.getAttribute("aria-label"), el.getAttribute("title"), el.getAttribute("data-tid")].filter(Boolean).join(" ")).join(" ");
            const evidenceText = normalize(rowText + " " + rowAttrs).toLocaleLowerCase();
            const organizer = /المنظّم|المنظم|\borganizer\b/i.test(evidenceText);
            const rowKey = section.label + "|" + rowText;
            if (!seenRows.has(rowKey)) {
              seenRows.add(rowKey);
              const xEvidence = /(?:^|\s)(?:x|×|✕|✖)(?:\s|$)/i.test(rowAttrs) ||
                /(?:disconnected|not connected|connection lost|غير متصل|غير متواجـد|انقطع الاتصال|لم ينضم|لم يتصل)/i.test(evidenceText);
              const lastSeenMatch = evidenceText.match(/(?:آخر ظهور|آخر نشاط|last seen|last active)\s*[:：]?\s*(.{1,50})/i);
              const lastSeenText = lastSeenMatch ? normalize(lastSeenMatch[1]) : "";
              const hasLastSeenBeforeCurrent = !!lastSeenText && /(?:قبل|ago|منذ|yesterday|أمس|دقيقة|دقائق|ثانية|ثوانٍ|ساعة|ساعات)/i.test(lastSeenText);
              matches.push({text:rowText, organizer, xEvidence, lastSeenText, hasLastSeenBeforeCurrent});
            }
            if (matches.length > 1) break;
          }
          if (matches.length > 1) break;
        }
      }
      return matches;
    };
    const presentRows = scanRows(sections.present);
    const invitedRows = scanRows(sections.invited);

    // Organizer-first diagnostic/fallback: Teams may render the organizer badge
    // outside the row selectors above. Locate the badge itself, then inspect only
    // small ancestors around it for the person's name and accessible attributes.
    const organizerCandidates = [];
    // Determine the participant's section by DOM order: the nearest preceding
    // recognized Teams section heading is more reliable than root.contains(row),
    // because Teams may render headings and participant rows as siblings.
    const orderedSectionHeadings = [...document.querySelectorAll("body *")]
      .filter(visible)
      .map(el => ({el, key: exactHeading(normalize(el.innerText || el.textContent))}))
      .filter(x => x.key === "present" || x.key === "invited" || x.key === "noResponse")
      .filter(x => ![...x.el.children].some(child =>
        normalize(child.innerText || child.textContent) === normalize(x.el.innerText || x.el.textContent)
      ));
    const sectionForNode = node => {
      // DOM order is not always the same as the visual order in Teams' virtualized
      // roster. Use the nearest visible section heading above the badge instead.
      const badgeRect = node.getBoundingClientRect();
      let nearest = null;
      let nearestDistance = Infinity;
      for (const heading of orderedSectionHeadings) {
        const rect = heading.el.getBoundingClientRect();
        if (rect.bottom > badgeRect.top + 2) continue;
        // Ignore headings in a different horizontal pane where possible.
        const horizontalGap = Math.max(0, rect.left - badgeRect.right, badgeRect.left - rect.right);
        if (horizontalGap > 180) continue;
        const distance = badgeRect.top - rect.bottom;
        if (distance < nearestDistance) {
          nearest = heading;
          nearestDistance = distance;
        }
      }
      return nearest?.key || "unknown";
    };
    const organizerNodes = [...document.querySelectorAll("body *")].filter(visible).filter(el => {
      const own = normalize([
        el.getAttribute("aria-label"), el.getAttribute("title"),
        el.getAttribute("data-tid"), el.innerText, el.textContent
      ].filter(Boolean).join(" ")).toLocaleLowerCase();
      return /^(?:المنظّم|المنظم|organizer)$/.test(own) ||
        /(?:^|\s)(?:المنظّم|المنظم|organizer)(?:$|\s)/.test(own) && own.length <= 50;
    });
    for (const badge of organizerNodes) {
      let row = badge;
      for (let depth = 0; depth < 6 && row.parentElement; depth++) {
        const parent = row.parentElement;
        const text = normalize(parent.innerText || parent.textContent);
        if (!text || text.length > 500) break;
        row = parent;
        const rowText = normalize(row.innerText || row.textContent);
        if (rowText.length >= 2 && rowText.length <= 300) {
          const tokens = new Set(tokenizeName(rowText));
          const target = new Set(teacherTokens);
          const nameOverlap = [...target].filter(t => tokens.has(t)).length;
          const sectionKey = sectionForNode(badge);
          organizerCandidates.push({text:rowText, sectionKey, nameOverlap, row});
          if (nameOverlap >= 2) break;
        }
      }
    }
    const uniqueOrganizerCandidates = organizerCandidates.filter((candidate, i, all) =>
      all.findIndex(other => other.text === candidate.text && other.sectionKey === candidate.sectionKey) === i
    );
    // Use the organizer badge itself when standard participant-row selectors
    // fail, but only when its local text matches both first and last name tokens
    // and DOM order places it inside a recognized attendance section.
    const organizerMatches = uniqueOrganizerCandidates.filter(x =>
      x.nameOverlap >= 2 && (x.sectionKey === "present" || x.sectionKey === "invited")
    );
    if (presentRows.length === 0 && invitedRows.length === 0 && organizerMatches.length === 1) {
      const candidate = organizerMatches[0];
      if (candidate.sectionKey === "present") {
        return {status:"present",detail:"تم العثور على وسم «المنظّم» مرتبطًا بالاسم «" + candidate.text.slice(0, 100) + "» ضمن قسم الحضور."};
      }
      return {status:"invited",detail:"تم العثور على وسم «المنظّم» مرتبطًا بالاسم «" + candidate.text.slice(0, 100) + "» ضمن قسم «تمت دعوة الآخرين». لم يظهر ضمن الحضور عند الفحص؛ تُعاد مراقبته ولا يُحوّل ذلك وحده إلى غياب نهائي."};
    }
    // Otherwise report concise organizer-first diagnostics for the next iteration.
    if (presentRows.length === 0 && invitedRows.length === 0) {
      const relevant = uniqueOrganizerCandidates
        .filter(x => x.nameOverlap >= 2 || x.sectionKey !== "unknown")
        .slice(0, 3)
        .map(x => "«" + x.text.slice(0, 100) + "» [قسم=" + x.sectionKey + ", تطابق أجزاء الاسم=" + x.nameOverlap + "]")
        .join("؛ ");
      if (uniqueOrganizerCandidates.length) {
        return {status:"unresolved",detail:"التشخيص: عُثر على وسم «المنظّم» لكن لم يمكن تحديد قسمه بثقة. أقرب سجلات مقروءة: " + (relevant || "لم يظهر سجل يطابق الاسم") + ". لم يُسجّل غياب."};
      }
    }
    // Apply the requested three-part rule:
    // (1) allow the teacher's full timetable name to match a shortened room name
    // by requiring the first and last name tokens, (2) organizer label must be
    // attached to that same participant row, and (3) classify by the section.
    if (presentRows.length > 1 || invitedRows.length > 1 || (presentRows.length > 0 && invitedRows.length > 0)) {
      return {status:"unresolved",detail:"تطابق الاسم في أكثر من سجل أو في قسمي الحضور والمدعوين؛ لا يُسجّل حكم."};
    }
    if (presentRows.length === 1) {
      if (!presentRows[0].organizer) {
        return {status:"unresolved",detail:"ظهر اسم قريب في قسم الحضور، لكن لم يُثبت ارتباط وسم «المنظّم» بالسجل نفسه؛ لا يُسجّل حكم."};
      }
      return {status:"present",detail:"تطابق الاسم الثلاثي مع الاسم الظاهر في الغرفة، وظهر وسم «المنظّم» في السجل نفسه ضمن قسم الحضور."};
    }
    if (invitedRows.length === 1) {
      const row = invitedRows[0];
      if (!row.organizer) {
        return {status:"unresolved",detail:"ظهر اسم قريب في «تمت دعوة الآخرين»، لكن لم يُثبت ارتباط وسم «المنظّم» بالسجل نفسه؛ لا يُسجّل غياب."};
      }
      const evidence = [
        row.xEvidence ? "رُصدت علامة اتصال/انقطاع في سجل الشخص" : "",
        row.hasLastSeenBeforeCurrent ? "آخر ظهور/نشاط قرأه Teams: " + row.lastSeenText : ""
      ].filter(Boolean).join("؛ ");
      const lastSeenNote = row.hasLastSeenBeforeCurrent
        ? " آخر ظهور/نشاط ظاهر في Teams: " + row.lastSeenText + "."
        : " لم يعرض Teams وقت آخر حضور/ظهور يمكن قراءته بثقة؛ لذلك لا نختلق مدة زمنية.";
      return {
        status:"invited",
        detail:"تم تحديد سجل المنظّم ضمن «تمت دعوة الآخرين»؛ هذا يعني أنه لم يظهر ضمن الحضور عند الفحص. " +
          (evidence ? "مؤشرات مساندة: " + evidence + ". " : "لم تتوفر مؤشرات اتصال/آخر ظهور موثوقة إضافية. ") +
          lastSeenNote + " تُسجّل الحالة «لم يظهر عند الفحص» وتُعاد مراقبته، ولا تُحوّل إلى غياب نهائي إلا وفق قاعدة زمنية معتمدة."
      };
    }
    return {status:"unresolved",detail:"لم يُعثر على سجل واحد واضح يطابق الاسم ووسم «المنظّم»؛ لا يُسجّل غياب."};
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