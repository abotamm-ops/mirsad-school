(() => {
  if (window.__mirsadTeamsProbeLoaded) return;
  window.__mirsadTeamsProbeLoaded = true;
  const scheduleCore = globalThis.MirsadScheduleCore;

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

  const rosterDigits = value => String(value).replace(/[٠-٩]/g,c=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(c))).replace(/[۰-۹]/g,c=>String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  const participantSelector = '[data-cid="roster-participant"], [data-tid^="participantsFromMeeting-"], [id^="participantsFromMeeting-"], [data-tid^="participantsInCall-"], [id^="participantsInCall-"]';
  const headingAliases = [
    {key:"present", labels:["الحضور","In this meeting","Attendees"]},
    {key:"invited", labels:["تمت دعوة الآخرين","Invited","Other invitees"]},
    {key:"noResponse", labels:["لا توجد استجابة","Didn't respond","Hasn't responded"]},
    // Section boundaries only: none of these groups is required for presence.
    {key:"other", labels:["مقدمو الاجتماع","مقدمو العرض","منظمو الاجتماع","Meeting organizers","Presenters","Organizers"]}
  ];
  const exactHeading = text => {
    const t = rosterDigits(normalize(text)).toLocaleLowerCase();
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
        sections[h.key].push({label:h.label, text:txt, root, heading:h.el});
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

  function extractMatchingName(text, teacher) {
    const tokens=tokenizeName(text);
    const candidates=[];
    for(let length=2;length<=Math.min(7,tokens.length);length++)for(let start=0;start+length<=tokens.length;start++){
      const value=tokens.slice(start,start+length).join(" ");
      if(nameMatch(teacher,value).match)candidates.push(value);
    }
    return candidates.sort((a,b)=>tokenizeName(a).length-tokenizeName(b).length)[0]||"";
  }

  // "Ruler" fallback: associate the organizer badge with a nearby visible
  // name using screen coordinates, rather than searching the whole roster.
  // Only a uniquely positioned teacher-name candidate is accepted.
  function findOrganizerByRuler(badge, teacher) {
    const rect=badge.getBoundingClientRect();
    if (!rect.width || !rect.height) return "";
    const centerY=(rect.top+rect.bottom)/2;
    const nearby=[...document.querySelectorAll("body *")].filter(el => {
      if (!visible(el) || el===badge || el.contains(badge) || badge.contains(el) || el.closest?.("#mirsad-teams-probe")) return false;
      if ([...el.children].some(child=>visible(child)&&nameMatch(teacher,normalize(child.innerText||child.textContent)).match)) return false;
      const r=el.getBoundingClientRect();
      return Math.abs((r.top+r.bottom)/2-centerY)<=Math.max(42,rect.height*2) &&
        Math.abs((r.left+r.right)/2-(rect.left+rect.right)/2)<=400 &&
        r.width<=380 && r.height<=90;
    }).map(el=>{
      const value=normalize(el.innerText||el.textContent||"");
      const match=value.length<=100?extractMatchingName(value,teacher):"";
      const r=el.getBoundingClientRect();
      const distance=Math.abs((r.top+r.bottom)/2-centerY)+Math.abs((r.left+r.right)/2-(rect.left+rect.right)/2)*.15;
      return {match,distance};
    }).filter(x=>x.match).sort((a,b)=>a.distance-b.distance);
    if (!nearby.length) return "";
    // Competing distinct names at nearly the same distance cannot be resolved.
    if (nearby.some(x=>normalize(x.match)!==normalize(nearby[0].match)&&x.distance-nearby[0].distance<20)) return "";
    return nearby[0].match;
  }

  // Count roster entries conservatively. A heading such as
  // "تمت دعوة الآخرين (31)" is a REQUIRED minimum before a positive
  // presence decision; the visible window alone is not the full roster.
  function expectedInviteeCount(label) {
    const match = rosterDigits(normalize(label)).match(/[（(]\s*(\d+)(?:\s*[/،,]\s*(\d+))?\s*[）)]/);
    return match ? Math.max(...match.slice(1).filter(Boolean).map(Number)) : null;
  }

  function observedInviteeNames(section) {
    const result = new Set();
    // Read participant rows, not every text node in the surrounding panel.
    // A row can contain status icons / badges, so normalize its text.
    const root = section.root;
    const possibleRows = [...root.querySelectorAll('[role="listitem"], [data-tid*="participant" i], [data-tid*="attendee" i]')];
    for (const row of possibleRows) {
      if (!visible(row)) continue;
      const lines = (row.innerText || "").split(/\n+/).map(normalize).filter(Boolean);
      const name = lines.find(line => {
        const parts = tokenizeName(line);
        return parts.length >= 2 && parts.length <= 7 && line.length <= 100 &&
          !exactHeading(line) && !/(?:المنظّم|المنظم|organizer|تمت دعوة الآخرين)/i.test(line);
      });
      if (name) result.add(normalize(name));
    }
    return result;
  }

  // Confirm absence using a SINGLE participant name row, never tokens scattered
  // across the whole invited panel. Prefer the name shown next to "المنظّم".
  function invitedTeacherRows(section, teacher) {
    const root=section.root;
    const candidates=[...root.querySelectorAll('[role="listitem"], [data-tid*="participant" i], [data-tid*="attendee" i], [role="treeitem"]')];
    const matched=[];
    for(const el of candidates){
      if(!visible(el))continue;
      const lines=(el.innerText||"").split(/\n+/).map(normalize).filter(Boolean);
      const name=lines.find(line=>line.length<=110&&tokenizeName(line).length>=2&&tokenizeName(line).length<=7&&nameMatch(teacher,line).match&&!exactHeading(line));
      if(name)matched.push({name,el});
    }
    // Teams may render the roster without listitem roles. Only match an actual
    // rendered text line containing the teacher's first and last names.
    if(!matched.length){
      for(const el of root.querySelectorAll('span,div,[data-tid]')){
        if(!visible(el)||[...el.children].some(c=>visible(c)&&normalize(c.innerText||c.textContent)))continue;
        const line=normalize(el.innerText||el.textContent||"");
        if(line.length<=110&&tokenizeName(line).length>=2&&tokenizeName(line).length<=7&&nameMatch(teacher,line).match&&!exactHeading(line))matched.push({name:line,el});
      }
    }
    return matched;
  }

  // Teams' own organizer identity is authoritative. The scheduled teacher name
  // is deliberately NEVER used to select or validate a person inside the room.
  const organizerLabel = /(?:المنظ[ِ\u0650ّ\u0651]*م|organizer|organiser)/i;
  const participantIdPrefixes = ["participantsFromMeeting-", "participantsInCall-"];

  function rosterHeadingsInOrder() {
    const all=[...document.querySelectorAll("body *")].filter(visible);
    return all.filter(el => {
      const t=normalize(el.innerText||el.textContent||"");
      if(t.length>90 || !exactHeading(t))return false;
      return ![...el.children].some(c=>normalize(c.innerText||c.textContent||"")===t);
    }).map(el=>({el,key:exactHeading(normalize(el.innerText||el.textContent)),label:normalize(el.innerText||el.textContent)}));
  }

  function rosterGroupForRow(row, headings) {
    // The Teams Fluent UI tree puts list rows between group headers in DOM
    // order. This also works when a virtualized list reuses visible elements.
    let last=null;
    for(const heading of headings){
      if(heading.el.compareDocumentPosition(row)&Node.DOCUMENT_POSITION_FOLLOWING)last=heading;
    }
    return last?.key||null;
  }

  function participantRows(headings) {
    const rows=[...document.querySelectorAll(participantSelector)]
      .filter(visible).filter(el=>!el.parentElement?.closest(participantSelector));
    return rows.map(el=>{
      const identifier=[el.getAttribute('data-tid'),el.id].find(value=>participantIdPrefixes.some(prefix=>value?.startsWith(prefix)))||'';
      const prefix=participantIdPrefixes.find(prefix=>identifier.startsWith(prefix));
      // Refactored Teams uses the same participant container across roster groups,
      // but not necessarily the same data-tid prefix. Read its explicit name field.
      const nameField=el.querySelector('[id^="roster-avatar-img-"], .fui-TreeItemPersonaLayout__main span[title]');
      const fieldName=normalize(nameField?.innerText||nameField?.textContent||nameField?.getAttribute('title')||'');
      const name=prefix?normalize(identifier.slice(prefix.length)):fieldName;
      const contents=normalize(el.innerText||el.textContent||'');
      // Teams' refactored in-call row contains both the name and its organizer badge.
      // It establishes identity only; presence still requires a complete invitee scan.
      // An actual, visible organizer badge in this participant's own row is required.
      // A name in the timetable/invitees, aria-label, or incidental row text is not a badge.
      const organizer=[...el.querySelectorAll('[data-tid="ts-roster-organizer-status"],span')].some(badge=>
        visible(badge)&&badge.closest(participantSelector)===el&&
        /^(?:المنظم|organizer|organiser)$/i.test(normalize(badge.innerText||badge.textContent||''))&&
        ![...badge.children].some(child=>visible(child)&&normalize(child.innerText||child.textContent||''))
      );
      return {el,name,contents,group:prefix==='participantsInCall-'?'present':rosterGroupForRow(el,headings),organizer};
    }).filter(x=>x.name && x.name.length<=130);
  }

  async function scanOrganizerAcrossPage(_scheduledTeacher, initialSections) {
    const observedInvitees=new Set(), organizers=new Set(), observedPresent=new Set();
    let expectedCount=null, sawInvitees=false, inInvitees=false, organizerRow=null;
    let countChanged=false, unreadableRows=false;
    const rowTypes=new Set();let maxVisibleRows=0,maxParsedRows=0;
    const scrollables=[];
    const addScrollable=el=>{
      if(!el||scrollables.some(x=>x.el===el)||el.scrollHeight<=el.clientHeight+8)return;
      if(el!==document.scrollingElement && !/(auto|scroll)/.test(window.getComputedStyle(el).overflowY||''))return;
      scrollables.push({el,top:el.scrollTop,ended:false});
    };
    for(const root of [...(initialSections.present||[]),...(initialSections.invited||[])].map(x=>x.root)){
      let node=root;
      for(let d=0;d<10&&node;d++,node=node.parentElement)addScrollable(node);
    }
    for(const el of document.querySelectorAll(participantSelector)){
      let node=el.parentElement;
      for(let d=0;d<9&&node;d++,node=node.parentElement)addScrollable(node);
    }
    if(!scrollables.length)addScrollable(document.scrollingElement);
    // Scan inner roster viewports, rather than also scrolling unrelated outer pages.
    const inner=scrollables.filter(entry=>!scrollables.some(other=>other!==entry&&entry.el.contains(other.el)));
    scrollables.splice(0,scrollables.length,...inner);
    const collect=()=>{
      const headings=rosterHeadingsInOrder();
      for(const h of headings.filter(x=>x.key==='invited')){
        sawInvitees=true;
        const n=expectedInviteeCount(h.label);
        if(n!==null){if(expectedCount!==null&&expectedCount!==n)countChanged=true;expectedCount=n;}
        if(h.el.closest('[aria-expanded="false"]'))unreadableRows=true;
      }
      const elements=[...document.querySelectorAll(participantSelector)].filter(visible).filter(el=>!el.parentElement?.closest(participantSelector));
      const parsed=participantRows(headings);
      maxVisibleRows=Math.max(maxVisibleRows,elements.length);maxParsedRows=Math.max(maxParsedRows,parsed.length);
      for(const el of elements){
        const tid=el.getAttribute('data-tid')||'';
        const family=/^([A-Za-z]+)-/.exec(tid)?.[1]||'roster-participant';rowTypes.add(family);
        if(rosterGroupForRow(el,headings)==='invited'&&!parsed.some(row=>row.el===el))unreadableRows=true;
      }
      for(const row of parsed){
        if(row.organizer){organizers.add(row.name);if(row.group==='invited')organizerRow=row.el;}
        if(row.group==='invited')observedInvitees.add(row.name);
        if(row.group==='present')observedPresent.add(row.name);
      }
      if(organizers.size===1 && observedInvitees.has([...organizers][0]))inInvitees=true;
    };
    collect();
    // Teams often opens the participants panel scrolled part-way down. The
    // organizer can be under the attendance heading ABOVE the current view.
    // Rewind each roster scroller before the forward scan so that present
    // organizers are discovered as reliably as invited organizers.
    for (const entry of scrollables) {
      if (entry.el.scrollTop > 2) {
        entry.el.scrollTop = 0;
        entry.el.dispatchEvent(new Event('scroll', {bubbles:true}));
        await new Promise(resolve => setTimeout(resolve, 140));
      }
      collect();
    }
    collect();
    let remaining=64;
    while(!inInvitees && remaining-->0){
      const active=scrollables.filter(x=>!x.ended);
      if(!active.length)break;
      const entry=active[0],el=entry.el;
      const next=Math.min(el.scrollHeight-el.clientHeight,el.scrollTop+Math.max(120,Math.floor(el.clientHeight*.75)));
      if(next<=el.scrollTop+2){entry.ended=true;continue;}
      el.scrollTop=next;
      el.dispatchEvent(new Event('scroll',{bubbles:true}));
      await new Promise(resolve=>setTimeout(resolve,140));
      collect();
    }
    const matches=[...organizers];
    // The displayed total is diagnostic only, not a condition for presence.
    // Require readable rows (or an explicitly empty list), and finish the existing scan.
    const inviteesReadable=sawInvitees&&!unreadableRows&&(observedInvitees.size>0||expectedCount===0);
    const fullyScanned=inviteesReadable&&scrollables.every(x=>x.ended || x.el.scrollTop>=x.el.scrollHeight-x.el.clientHeight-3);
    // Preserve the matched row for evidence when an absence has been detected.
    if(matches.length!==1 || !inInvitees)for(const entry of scrollables)entry.el.scrollTop=entry.top;
    return {name:matches.length===1?matches[0]:"",ambiguous:matches.length>1,
      inInvitees:matches.length===1&&inInvitees,fullyScanned,inviteesReadable,expectedCount,
      reason:!sawInvitees?'تعذّر الوصول إلى عنوان قائمة المدعوين':unreadableRows?'قائمة المدعوين مطوية أو تحتوي صفوفًا تعذّر استخراج أسمائها':!inviteesReadable?'تعذرت قراءة أي صف من قائمة المدعوين':!fullyScanned?'تعذر إنهاء تمرير قائمة المدعوين':'',
      diagnostics:'إصدار القارئ=0.5.51؛ صفوف مكتشفة='+maxVisibleRows+'؛ صفوف مسماة='+maxParsedRows+'؛ أنواع الصفوف='+[...rowTypes].slice(0,6).join(',')+'؛ نوافذ تمرير='+scrollables.length+'؛ العدد المعلن للمعلومة فقط='+(expectedCount??'غير متاح')+'؛ تغير العدد='+countChanged,
      observedCount:observedInvitees.size,invitedText:[...observedInvitees].join('\n'),
      presentText:[...observedPresent].join('\n')};
  }

  function getTextForRoot(root) {
    return normalize(root?.innerText || root?.textContent || "");
  }

  function teamsAppPromptContainers() {
    const promptText = /(?:open|launch|use|get|download).{0,60}(?:microsoft\s+)?teams|teams.{0,60}(?:app|application)|(?:فتح|استخدام|تنزيل).{0,60}(?:تطبيق|تيمز|teams)|(?:تطبيق|تيمز|teams).{0,60}(?:فتح|استخدام|تنزيل)|teams.{0,70}(?:microphone|mic|camera|permission)|(?:الميكروفون|الكاميرا).{0,80}(?:teams|تيمز|السماح)/i;
    return [...document.querySelectorAll('[role="dialog"],[aria-modal="true"],[data-tid*="dialog" i],[data-tid*="modal" i],body *')]
      .filter(visible)
      .map(el=>({el,text:normalize(el.innerText||el.textContent||"")}))
      .filter(item=>item.text.length>0&&item.text.length<=1600&&promptText.test(item.text))
      .sort((a,b)=>a.text.length-b.text.length);
  }

  async function dismissTeamsAppPopup() {
    const prompts=teamsAppPromptContainers();
    if(!prompts.length)return true;
    const selector='button,[role="button"],a,[aria-label],[title],[data-icon-name],[data-tid]';
    const closeLabels=/^(?:close|dismiss|cancel|إغلاق|اغلاق|إقفال|إلغاء|×|x|✕|✖)$/i;
    const labelOf=el=>normalize([el.getAttribute("aria-label"),el.getAttribute("title"),el.getAttribute("data-icon-name"),el.getAttribute("data-tid"),el.innerText,el.textContent].filter(Boolean).join(" "));
    let close=null,continueInBrowser=null;
    for(const item of prompts){
      let container=item.el;
      for(let depth=0;depth<4&&container;depth++,container=container.parentElement){
        const containerText=normalize(container.innerText||container.textContent||"");
        if(containerText.length>2200||!/(?:teams|تيمز|الميكروفون|microphone|camera|الكاميرا)/i.test(containerText))break;
        const controls=[...container.querySelectorAll(selector)].filter(visible);
        close=controls.find(el=>{
          const label=labelOf(el);
          if(closeLabels.test(label)||/(?:dismiss|close|cancel|إغلاق|اغلاق|إقفال)/i.test(label)&&label.length<80)return true;
          const rect=el.getBoundingClientRect(),box=container.getBoundingClientRect();
          const text=normalize(el.innerText||el.textContent||"");
          const nearTop=rect.top>=box.top-4&&rect.top<=box.top+64;
          const nearSide=rect.left<=box.left+72||rect.right>=box.right-72;
          const small=rect.width>0&&rect.height>0&&rect.width<=52&&rect.height<=52;
          return !text&&nearTop&&nearSide&&small;
        })||close;
        continueInBrowser=controls.find(el=>/continue.{0,20}browser|use teams on the web|متابعة.{0,20}(?:المستعرض|المتصفح)|استخدام teams على الويب/i.test(labelOf(el)))||continueInBrowser;
        if(close)break;
      }
      if(close||continueInBrowser)break;
    }
    const target=close||continueInBrowser;
    if(target){try{target.click()}catch(_){return false}}
    await new Promise(resolve=>setTimeout(resolve,350));
    if(teamsAppPromptContainers().length===0)return true;
    // Some Teams web popovers expose an unlabeled X only to accessibility
    // APIs. Escape is a final page-level dismissal attempt after a popup was
    // positively identified; it is never sent to a native desktop window.
    try{document.activeElement?.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}))}catch(_){}
    await new Promise(resolve=>setTimeout(resolve,350));
    return teamsAppPromptContainers().length===0;
  }

  async function prepareInviteeEvidenceView(teacher) {
    const headings=rosterHeadingsInOrder();
    const matches=participantRows(headings).filter(row=>row.group==='invited'&&normalize(row.name)===normalize(teacher));
    for(const match of matches){
      try{match.el.scrollIntoView({block:'nearest',inline:'nearest'})}catch(_){}
      await new Promise(resolve=>setTimeout(resolve,180));
      if(participantRows(rosterHeadingsInOrder()).some(row=>row.group==='invited'&&normalize(row.name)===normalize(teacher)))return true;
    }
    return false;
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
    panel.querySelector("#mirsad-probe-scan").addEventListener("click", async () => {
      const teacher = panel.querySelector("#mirsad-teacher-name").value;
      const target = panel.querySelector("#mirsad-probe-results");
      target.replaceChildren();
      const line = text => { const p=document.createElement("p"); p.textContent=text; target.appendChild(p); };
      if (!normalize(teacher)) { line("اكتب اسم المعلم أولًا."); return; }
      const sections = findSections();
      if (!sections.invited.length) {
        line("لم أستطع قراءة قسم «تمت دعوة الآخرين»؛ النتيجة غير محسومة.");
        return;
      }
      line("جارٍ تحديد المنظّم وفحص قائمة «تمت دعوة الآخرين»...");
      const organizer = await scanOrganizerAcrossPage(teacher, sections);
      if (!target.isConnected) return;
      target.replaceChildren();
      if (!organizer.name) {
        line("تعذّر تحديد اسم المعلم من «المنظّم» حتى بعد البحث بالمسطرة؛ النتيجة غير محسومة.");
      } else {
        line("اسم المنظّم من Teams: " + organizer.name);
        const result = organizer.inInvitees?{status:"absent",teacher:organizer.name}:scheduleCore?.classifyOrganizerMembership(organizer.name, "", true, organizer.fullyScanned);
        if (result?.status === "absent") {
          line("النتيجة الأولية: غائب — اسم المنظّم موجود ضمن «تمت دعوة الآخرين». يلزم حفظ دليل الغياب قبل اعتماده.");
        } else if (result?.status === "present") {
          line("النتيجة: حاضر — اكتمل فحص قائمة «تمت دعوة الآخرين» ولم يوجد اسم المنظّم فيها.");
        } else {
          line("النتيجة: غير محسوم — لم تكتمل قراءة قائمة «تمت دعوة الآخرين» (المقروء " + organizer.observedCount + " من " + (organizer.expectedCount ?? "عدد غير معروف") + ").");
        }
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
    if(!await dismissTeamsAppPopup())return {status:"unresolved",teacher,detail:"ظهرت نافذة فتح تطبيق Teams وتعذر إغلاقها؛ لم تُفحص قائمة المشاركين ولم يُسجّل غياب."};
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
    const organizer=await scanOrganizerAcrossPage(teacher,sections);
    if(!organizer.name)return {status:"unresolved",teacher,reason:"organizer-not-found",retryable:!organizer.ambiguous,detail:organizer.ambiguous?"ظهر أكثر من اسم محتمل مرتبط بوسم «المنظّم»؛ لم تُسجّل حالة حضور أو غياب.":"تعذّر العثور على اسم مرتبط بوسم «المنظّم» بعد البحث والتمرير في الصفحة؛ لم تُسجّل حالة حضور أو غياب."};
    // Present = organizer identity + not found in the scanned invitee list.
    // Displayed invitee totals are not a prerequisite.
    // No membership in an attendance or presenter group is required.
    const decision=organizer.inInvitees?{status:"absent",teacher:organizer.name}:scheduleCore?.classifyOrganizerMembership(organizer.name,"",organizer.inviteesReadable,organizer.fullyScanned);
    if(decision?.status==="absent"){
      const evidenceReady=await prepareInviteeEvidenceView(organizer.name);
      if(!evidenceReady)return {status:"unresolved",teacher,detail:"اسم المنظّم «"+organizer.name+"» ظهر ضمن المدعوين، لكن تعذّر إظهار الاسم وعنوان القائمة معًا للتصوير؛ لم يُسجّل غياب."};
      return {status:"absent",teacher:organizer.name,evidenceTeacher:organizer.name,detail:"اسم المنظّم «"+organizer.name+"» مرتبط بالمعلم ويظهر تحت «تمت دعوة الآخرين»؛ الحالة غائب. جُهزت القائمة للتصوير.",evidence:{verified:true,teacherInInvitees:true,teacherNotPresent:true,inviteesReadable:true}};
    }
    if(decision?.status==="present")return {status:"present",teacher:organizer.name,detail:"اسم المنظّم «"+organizer.name+"» مرتبط بالمعلم، ولم يظهر تحت «تمت دعوة الآخرين» بعد فحص القائمة؛ الحالة حاضر."};
    return {status:"unresolved",teacher:organizer.name,detail:(organizer.reason||"تعذر تأكيد اكتمال القائمة")+"؛ الأسماء المقروءة من المدعوين=" + organizer.observedCount + ". "+organizer.diagnostics};
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MIRSAD_AUTO_SCAN") {
      automaticScan(message.teacher || "").then(sendResponse).catch(error => sendResponse({status:"unresolved",teacher:message.teacher||"",detail:"تعذر فحص واجهة Teams بسبب خطأ داخلي: "+String(error?.message||error||"خطأ غير معروف").slice(0,180)+"؛ لم تُسجّل حالة حضور أو غياب."}));
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

  function securedMeetingReason() {
    const text=normalize(document.body?.innerText||"").toLocaleLowerCase();
    // Only explicit access restrictions; generic loading/network/sign-in failures are not secured lessons.
    if(/(?:this |the )?meeting (?:is|has been) locked|you (?:can.t|cannot) join this meeting|you (?:don.t|do not) have permission to join|only people (?:from|in) (?:this|the) organi[sz]ation can join/.test(text)||
       /(?:تم (?:قفل|تأمين|تامين) الاجتماع|(?:هذا )?الاجتماع (?:مغلق|مقفل|مؤمن|مومن)|لا يمكنك الانضمام (?:الي|الى|إلى) هذا الاجتماع|غير مسموح لك بالانضمام|ليس لديك (?:اذن|إذن|صلاحية) للانضمام)/.test(text))return "الحصة مؤمّنة: تعرض Teams رسالة صريحة بقفل الاجتماع أو منع الدخول.";
    if(/waiting in the lobby|someone will let you in|في ساحة الانتظار|بانتظار (?:موافقة|السماح)|انتظار موافقة المنظم/.test(text))return "الحصة مؤمّنة: الدخول يتطلب سماح المنظّم من ساحة الانتظار.";
    return "";
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
      if(securedMeetingReason())return "entry-blocked";
      if (clickExactButton(joinLabels)) {
        // Wait for the meeting view to appear, rather than assuming a click means success.
        for (let wait = 0; wait < 15; wait++) {
          await new Promise(resolve => setTimeout(resolve, 1000));
          if (meetingLooksJoined()) return "joined";
          if(securedMeetingReason())return "entry-blocked";
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
    await new Promise(resolve => setTimeout(resolve, 2000));
    const clicked = clickExactButton(["leave","leave meeting","مغادرة","مغادرة الاجتماع"]);
    if (clicked) await new Promise(resolve => setTimeout(resolve, 2000));
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
      if(joinState === "entry-blocked"){
        result={status:"unresolved",teacher:target.teacher,detail:securedMeetingReason()||"الحصة مؤمّنة: تعذر الدخول بسبب قيود الاجتماع."};
      } else if (joinState === "join-not-available") {
        result = {status:"unresolved",detail:"لم يظهر زر «الانضمام الآن» جاهزًا. قد تتطلب الصفحة تسجيل الدخول أو اختيار الحساب؛ لم يُسجّل غياب."};
      } else if (joinState === "waiting-for-admission") {
        result = {status:"unresolved",teacher:target.teacher,detail:"الحصة مؤمّنة: تم طلب الانضمام لكن Teams يعرض انتظار موافقة المنظّم؛ لم يُسجّل غياب."};
      } else if (joinState === "join-clicked-not-confirmed") {
        result = {status:"unresolved",detail:"ضغط مرصاد زر الانضمام، لكن لم يتأكد ظهور واجهة الاجتماع؛ لم يُسجّل غياب."};
      } else {
        // Shorten settling/retries so a 12-class cycle does not waste time on every link.
        await new Promise(resolve => setTimeout(resolve, 2000));
        let organizerWaited=false;
        for (let attempt = 0; attempt < 6; attempt++) {
          if (attempt > 0) await new Promise(resolve => setTimeout(resolve, 1000));
          result = await automaticScan(target.teacher);
          if(result.reason==="organizer-not-found"&&result.retryable&&!organizerWaited){
            // Wait five full seconds, once, only when the organizer badge was not found.
            organizerWaited=true;
            await new Promise(resolve=>setTimeout(resolve,5000));
            result=await automaticScan(target.teacher);
          }
          if (result.reason==="organizer-not-found"||result.status !== "unresolved" ||
              !/لم يمكن تحديد أقسام الحضور|لم يتم الانضمام|لم تظهر قائمة المشاركين|تعذر تحديد أقسام|التشخيص:/i.test(result.detail || "")) {
            break;
          }
        }
      }
      // A final absence requires a verified, saved screenshot before leaving.
      if (result.status === "absent") {
        try {
          const evidenceTeacher=result.evidenceTeacher||result.teacher||target.teacher;
          const popupClosed=await dismissTeamsAppPopup();
          const viewReady=popupClosed&&await prepareInviteeEvidenceView(evidenceTeacher);
          if(!viewReady){result={status:"unresolved",teacher:evidenceTeacher,detail:"تعذر إغلاق نافذة Teams أو إظهار اسم المعلم وقائمة المدعوين للتصوير؛ لم يُسجّل غياب."};}
          else {
          const saved=await chrome.runtime.sendMessage({type:"MIRSAD_CAPTURE_EVIDENCE",scanId:target.scanId,teacher:evidenceTeacher,period:target.period,status:result.status,detail:result.detail,evidence:result.evidence});
          if (!saved?.ok) result={status:"unresolved",teacher:target.teacher,detail:"تعذر حفظ لقطة تُظهر اسم المعلم في قائمة المدعوين"+(saved?.error?": "+String(saved.error).slice(0,180):"")+"؛ لم يُسجّل غياب."};
          else result.detail += " حُفظت لقطة الدليل: "+saved.filename;
          }
        } catch (_) {
          result={status:"unresolved",teacher:target.teacher,detail:"تعذر حفظ لقطة قائمة المدعوين؛ لم يُسجّل غياب."};
        }
      }
      // Diagnostic evidence is distinct from an absence proof and never changes the result.
      if(result.status === "unresolved"){
        const diagnosticTeacher=result.teacher||target.teacher;
        try{
          const saved=await chrome.runtime.sendMessage({type:"MIRSAD_CAPTURE_EVIDENCE",scanId:target.scanId,teacher:diagnosticTeacher,period:target.period,status:"unresolved",detail:result.detail});
          result.detail+=saved?.ok?" حُفظت صورة غير محسوم: "+saved.filename:" تعذر حفظ صورة غير محسوم"+(saved?.error?": "+String(saved.error).slice(0,180):"");
        }catch(error){result.detail+=" تعذر حفظ صورة غير محسوم: "+String(error?.message||error).slice(0,180)}
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
