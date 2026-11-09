/* Bounded, DOM-only Teams Calendar adapter. No credentials or service APIs.
 * Supported contract: an explicit day/date and a complete semantic row grid.
 * Actual Teams builds without that contract are reported as unsupported.
 */
(() => {
  'use strict';
  if (globalThis.__mirsadTeamsCalendarReader) return;
  globalThis.__mirsadTeamsCalendarReader = true;

  const MESSAGE = 'MIRSAD_TEAMS_CALENDAR_';
  const EVENT_SELECTOR = '[data-tid="calendar-event"],[data-testid="calendar-event"],[data-tid="calendar-event-card"],[data-testid="calendar-event-card"]';
  const DIALOG_SELECTOR = '[role="dialog"],[data-tid="event-details"],[data-testid="event-details"]';
  const MAX_EVENTS = 1000;
  let active = null;
  const normalize = value => String(value || '').normalize('NFKC')
    .replace(/[\u064b-\u065f\u0670\u0640\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/\s+/g, ' ').trim();
  const digits = value => String(value || '').replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)));
  const rendered = node => {
    if (!node?.isConnected || !node.getBoundingClientRect) return false;
    const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
    return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
  };
  const validDate = date => /^\d{4}-\d{2}-\d{2}$/.test(date || '') &&
    Number.isFinite(Date.parse(date + 'T12:00:00Z')) && new Date(date + 'T12:00:00Z').toISOString().slice(0, 10) === date;
  const warning = (context, value) => {
    if (!context.warnings.includes(value) && context.warnings.length < 40) context.warnings.push(value);
  };
  const fail = message => Object.assign(new Error(message), {calendarReadError: true});
  function checkpoint(context) {
    if (context.cancelled) throw fail('أُوقفت قراءة تقويم تيمز لإعطاء الرصد أولوية.');
    if (Date.now() >= context.deadlineAt) throw fail('انتهت مهلة قراءة تقويم تيمز؛ لم تُفترض روابط للأحداث غير المقروءة.');
    if (location.href !== context.location) throw fail('تغيّرت صفحة تيمز أثناء القراءة؛ أُهملت نتائج التقويم.');
  }
  async function pause(context, milliseconds) {
    checkpoint(context);
    await new Promise(resolve => setTimeout(resolve, Math.min(milliseconds, Math.max(0, context.deadlineAt - Date.now()))));
    checkpoint(context);
  }

  function calendarView() {
    if (!/^https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|teams\.cloud\.microsoft)\//i.test(location.href)) return null;
    const route = location.pathname + location.search + location.hash;
    if (/(?:meetup-join|\/meet\/|prejoin|\/meeting(?:[/?#]|$)|\/call(?:[/?#]|$))/i.test(route)) return null;
    const calendarRoute = /(?:[/?#=])calendar(?:v2)?(?:[/?#=&]|$)/i.test(route);
    const selectedCalendar = [...document.querySelectorAll('[aria-selected="true"],[aria-current="page"]')].some(node =>
      rendered(node) && /^(?:calendar|التقويم|تقويم)$/i.test(normalize(node.getAttribute('aria-label') || node.innerText)));
    if (!calendarRoute && !selectedCalendar) return null;
    const grids = [...document.querySelectorAll('[role="grid"]')].filter(grid => {
      if (!rendered(grid)) return false;
      const label = normalize(grid.getAttribute('aria-label'));
      return /(?:calendar|تقويم)/i.test(label) && /(?:\bday\b|يوم|اليومي)/i.test(label) &&
        !/(?:\bweek\b|\bmonth\b|اسبوع|شهر)/i.test(label);
    });
    return grids.length === 1 ? {grid: grids[0], scope: grids[0].closest('main,[role="main"]') || document.body} : null;
  }

  function dateFromText(value) {
    const text = normalize(digits(value));
    if (validDate(text)) return text;
    const iso = /(?:^|\s)(\d{4}-\d{2}-\d{2})(?:$|\s)/.exec(text);
    if (iso && validDate(iso[1])) return iso[1];
    const arabic = ['يناير', 'فبراير', 'مارس', 'ابريل', 'مايو', 'يونيو', 'يوليو', 'اغسطس', 'سبتمبر', 'اكتوبر', 'نوفمبر', 'ديسمبر'];
    const english = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    for (let index = 0; index < 12; index++) {
      const month = '(?:' + arabic[index] + '|' + english[index] + '|' + english[index].slice(0, 3) + ')';
      const before = new RegExp('(?:^|[\\s،,])([0-9]{1,2})\\s+' + month + '[\\s،,]+([0-9]{4})(?:$|[\\s،,])', 'i').exec(text);
      const after = new RegExp('(?:^|[\\s،,])' + month + '\\s+([0-9]{1,2})[\\s،,]+([0-9]{4})(?:$|[\\s،,])', 'i').exec(text);
      const match = before || after;
      if (match) {
        const date = match[2] + '-' + String(index + 1).padStart(2, '0') + '-' + match[1].padStart(2, '0');
        if (validDate(date)) return date;
      }
    }
    return '';
  }
  function selectedDate(view) {
    const selectors = 'time[datetime],[aria-selected="true"][data-date],[aria-current="date"][data-date],h1,h2,[role="heading"]';
    const values = new Set();
    for (const node of view.scope.querySelectorAll(selectors)) {
      if (!rendered(node) || view.grid.contains(node) || node.closest(DIALOG_SELECTOR)) continue;
      const value = dateFromText(node.getAttribute('datetime') || node.getAttribute('data-date') || node.getAttribute('aria-label') || node.innerText);
      if (value) values.add(value);
    }
    return values.size === 1 ? [...values][0] : '';
  }
  function probe() {
    const view = calendarView();
    return {ok: true, isCalendar: !!view, ...(view && selectedDate(view) ? {date: selectedDate(view)} : {})};
  }

  function diagnostic(options = {}) {
    // A deliberately small structural report for an unsupported Calendar build.
    // Never serialize HTML, hrefs, form values, scripts, storage or credentials.
    const route = location.pathname + location.search + location.hash;
    const onCalendarRoute = /^https:\/\/(?:teams\.microsoft\.com|teams\.live\.com|teams\.cloud\.microsoft)\//i.test(location.href) &&
      /(?:[/?#=])calendar(?:v2)?(?:[/?#=&]|$)/i.test(route) &&
      !/(?:meetup-join|\/meet\/|prejoin|\/meeting(?:[/?#]|$)|\/call(?:[/?#]|$))/i.test(route);
    const view = calendarView();
    if (!view && !onCalendarRoute && options.explicitUserRequest !== true) return {ok: true, isCalendar: false, supportedStructure: false, nodes: [], warnings: ['الصفحة ليست تقويم تيمز معروفًا؛ لم تُجمع بنية صفحة أخرى.']};
    const scope = view?.scope || document.querySelector('main,[role="main"]');
    if (!scope) return {ok: true, isCalendar: true, supportedStructure: false, nodes: [], warnings: ['لم يظهر محتوى تقويم قابل للفحص.']};
    const clean = (value, limit = 180) => String(value || '').slice(0, 4000)
      .replace(/https?:\/\/[^\s<>"']+/gi, '[رابط محذوف]')
      .replace(/(?:bearer\s+)?[A-Za-z0-9_+\/-]{48,}(?:={0,2})/g, '[قيمة طويلة محذوفة]')
      .replace(/(?:access_token|refresh_token|authorization|password|csrf)[\s:=]+\S+/gi, '[قيمة محذوفة]')
      .replace(/\s+/g, ' ').trim().slice(0, limit);
    const textSnippet = node => {
      const excluded = 'script,style,noscript,input,textarea,select,option,form,[contenteditable]';
      if (node.closest(excluded)) return '';
      const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), pieces = [];
      let current, visited = 0, length = 0;
      while ((current = walker.nextNode()) && visited++ < 400 && length < 2000) {
        const parent = current.parentElement;
        if (!parent || parent.closest(excluded) || !rendered(parent)) continue;
        const part = String(current.nodeValue || '').trim();
        if (part) { pieces.push(part); length += part.length; }
      }
      return clean(pieces.join(' '));
    };
    const describe = node => {
      const rect = node.getBoundingClientRect();
      return {tag: node.tagName.toLowerCase(), role: clean(node.getAttribute('role'), 40),
        dataTid: clean(node.getAttribute('data-tid'), 120), testId: clean(node.getAttribute('data-testid'), 120),
        className: clean(node.getAttribute('class'), 180), label: clean(node.getAttribute('aria-label')),
        rowCount: clean(node.getAttribute('aria-rowcount'), 10), rowIndex: clean(node.getAttribute('aria-rowindex'), 10),
        rect: {top: Math.round(rect.top), left: Math.round(rect.left), width: Math.round(rect.width), height: Math.round(rect.height)},
        scroll: {top: Math.round(node.scrollTop), height: Math.round(node.scrollHeight), clientHeight: Math.round(node.clientHeight)},
        text: textSnippet(node), children: node.children.length};
    };
    const selected = new Set([scope]);
    // Include semantic roots and a capped sample of candidate event structures;
    // unknown selectors remain evidence for a later adapter, not accepted events.
    const structural = [...scope.querySelectorAll('[role="grid"],[role="row"],time[datetime],h1,h2,[role="heading"]')].filter(rendered);
    for (const node of structural.slice(0, 22)) selected.add(node);
    const candidates = [...scope.querySelectorAll('[data-tid],[data-testid],[role="button"],[role="gridcell"]')]
      .filter(node => rendered(node) && !node.closest('form,input,textarea,select,script,style,noscript') &&
        (node.getAttribute('role') === 'button' || node.getAttribute('role') === 'gridcell' || /(?:event|appointment|calendar)/i.test((node.getAttribute('data-tid') || '') + ' ' + (node.getAttribute('data-testid') || ''))));
    for (const node of candidates.slice(0, 32)) {
      selected.add(node);
      for (const child of [...node.children].filter(rendered).slice(0, 2)) {
        if (!/^(?:INPUT|TEXTAREA|SELECT|SCRIPT|STYLE|NOSCRIPT|FORM)$/.test(child.tagName)) selected.add(child);
      }
    }
    for (const dialog of [...document.querySelectorAll(DIALOG_SELECTOR)].filter(rendered).slice(0, 1)) selected.add(dialog);
    let supportedStructure = false;
    if (view) try { completeRows(view); supportedStructure = true; } catch (_) {}
    const reportDate = view && selectedDate(view);
    return {ok: true, isCalendar: !!view || onCalendarRoute, userSelected: options.explicitUserRequest === true, source: 'visible-dom-only', supportedStructure,
      ...(reportDate ? {date: reportDate} : {}), nodes: [...selected].slice(0, 100).map(describe),
      warnings: supportedStructure ? [] : ['بنية هذا التقويم غير مدعومة حاليًا. لا يكفي عدد صفوف الوقت 48 أو 96 لإثبات ترتيب الحصص؛ التقرير للتشخيص فقط ولم يُضف روابط.']};
  }

  function completeRows(view) {
    // An event list alone cannot prove that earlier virtualized rows exist.
    // Require the full declared day and reject unknown/incomplete row counts.
    const rawCount = view.grid.getAttribute('aria-rowcount');
    if (!/^[1-7]$/.test(rawCount || '')) throw fail('تعذر إثبات اكتمال صفوف يوم تقويم تيمز؛ هذه البنية غير مدعومة دون تخمين ترتيب الحصص.');
    if ([...view.grid.querySelectorAll('[aria-busy="true"],[role="progressbar"]')].some(rendered) || view.grid.getAttribute('aria-busy') === 'true') {
      throw fail('صفوف تقويم تيمز ما زالت قيد التحميل؛ لم يُعتمد ترتيب ناقص.');
    }
    const count = Number(rawCount), rows = [...view.grid.querySelectorAll('[role="row"]')].filter(row => rendered(row) && row.closest('[role="grid"]') === view.grid);
    if (rows.length !== count) throw fail('لم تظهر جميع صفوف اليوم في تقويم تيمز؛ لم تُرقّم الحصص من الجزء الظاهر فقط.');
    rows.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    if (rows.some((row, index) => Number(row.getAttribute('aria-rowindex')) !== index + 1 ||
      index > 0 && row.getBoundingClientRect().top - rows[index - 1].getBoundingClientRect().top < 2)) {
      throw fail('ترتيب صفوف تقويم تيمز ملتبس؛ لم تُربط أحداث بحصص بالتخمين.');
    }
    // Known event cards outside the enumerated rows would make coverage partial.
    if ([...view.grid.querySelectorAll(EVENT_SELECTOR)].some(card => rendered(card) && !rows.some(row => row.contains(card)))) {
      throw fail('بعض أحداث تقويم تيمز خارج صفوف اليوم المعروفة؛ تعذر إثبات ترتيب كامل.');
    }
    return rows;
  }
  function assertDay(context, view) {
    checkpoint(context);
    if (calendarView()?.grid !== view.grid || selectedDate(view) !== context.date) throw fail('تغيّر تاريخ أو عرض تقويم تيمز أثناء القراءة؛ أُهملت النتائج.');
  }

  function requestedTeachers(values) {
    if (!Array.isArray(values) || !values.length || values.length > 500) throw fail('قائمة معلمي تقويم تيمز غير صالحة.');
    const names = new Map();
    for (const value of values) {
      if (typeof value !== 'string' || !normalize(value) || value.length > 180) throw fail('اسم معلم تقويم تيمز غير صالح.');
      const key = normalize(value), existing = names.get(key);
      if (existing && existing !== value.trim()) throw fail('قائمة المعلمين تتضمن أسماء متطابقة بعد التطبيع؛ تعذر تعيين الهوية بوضوح.');
      names.set(key, value.trim());
    }
    return names;
  }
  function teacherNames(node, names) {
    const fragments = new Set();
    const add = value => {
      for (const part of String(value || '').split(/[\n،,|]/)) {
        const text = normalize(part);
        if (text) fragments.add(text);
        const invited = /^(?:قام\s+(.+?)\s+بدعوتك[.!؟]?|invited by\s+(.+?)|(.+?)\s+invited you[.!?]?)$/i.exec(text);
        if (invited) fragments.add(normalize(invited[1] || invited[2] || invited[3]));
        const labelled = /^(?:المعلم|المنظم|teacher|organizer|organiser)\s*[:：]\s*(.+)$/i.exec(text);
        if (labelled) fragments.add(normalize(labelled[1]));
      }
    };
    add(node.innerText); add(node.getAttribute('aria-label'));
    for (const child of node.querySelectorAll('span,div,p,[aria-label]')) {
      if (!rendered(child)) continue;
      if (!child.children.length) add(child.innerText || child.textContent);
      add(child.getAttribute('aria-label'));
    }
    return [...names.keys()].filter(name => fragments.has(name));
  }
  function organizerNames(node) {
    const names = new Set();
    for (const part of String(node.innerText || '').split(/[\n،,|]/)) {
      const match = /^(?:قام\s+(.+?)\s+بدعوتك[.!؟]?|invited by\s+(.+?)|(.+?)\s+invited you[.!?]?)$/i.exec(normalize(part));
      if (match) names.add(normalize(match[1] || match[2] || match[3]));
    }
    return names;
  }
  function meetingLinks(node) {
    const core = globalThis.MirsadScheduleCore;
    if (!core?.normalizeTeamsUrl || !core?.teamsMeetingKey) throw fail('مساعد التحقق من روابط تيمز غير جاهز؛ حدّث الإضافة.');
    const links = new Map();
    for (const anchor of node.querySelectorAll('a[href]')) {
      if (!rendered(anchor)) continue;
      const url = core.normalizeTeamsUrl(anchor.getAttribute('href'));
      if (url) links.set(core.teamsMeetingKey(url), url);
    }
    return [...links.entries()].map(([key, url]) => ({key, url}));
  }
  function eventTitle(node, teachers) {
    const headings = [...node.querySelectorAll('h1,h2,h3,h4,[role="heading"]')].filter(rendered);
    const values = headings.map(heading => heading.innerText).concat(String(node.innerText || '').split('\n'));
    const title = values.map(value => String(value || '').replace(/\s+/g, ' ').trim()).find(value => {
      const text = normalize(value);
      return text && !teachers.has(text) && !/^(?:join|join now|انضمام|الانضمام|الانضمام الان|close|اغلاق)$/i.test(text) &&
        !/^(?:قام\s|invited by\s)/i.test(text) && !/^\d{1,2}:\d{2}(?:\s|$)/.test(digits(text));
    });
    return String(title || '').slice(0, 300);
  }
  function scrollState(view) {
    const nodes = new Set([document.scrollingElement, view.grid]);
    for (let node = view.grid.parentElement; node; node = node.parentElement) nodes.add(node);
    for (const node of view.grid.querySelectorAll('*')) if (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth) nodes.add(node);
    return [...nodes].filter(Boolean).map(node => ({node, top: node.scrollTop, left: node.scrollLeft}));
  }
  function closeOwnedDialog(context) {
    const dialog = context.dialog;
    context.dialog = null;
    if (!dialog?.isConnected) return;
    const close = [...dialog.querySelectorAll('button,[role="button"]')].find(button => rendered(button) &&
      /^(?:close|close event details|dismiss|اغلاق|اغلاق التفاصيل|اغلاق تفاصيل الحدث)$/i.test(normalize(button.getAttribute('aria-label') || button.getAttribute('title') || button.innerText)));
    if (close) close.click();
    else warning(context, 'تعذر العثور على زر إغلاق آمن لتفاصيل الحدث التي فُتحت؛ توقفت القراءة.');
  }
  async function detailLinks(context, view, card, teacherKey) {
    const before = new Set([...document.querySelectorAll(DIALOG_SELECTOR)].filter(rendered));
    if (before.size || card.tagName === 'A' || card.hasAttribute('href') || card.getAttribute('role') !== 'button') {
      warning(context, 'تعذر فتح تفاصيل حدث تقويم بأمان؛ تُرك دون رابط إضافي.');
      return [];
    }
    assertDay(context, view);
    card.scrollIntoView({block: 'nearest', inline: 'nearest'});
    assertDay(context, view);
    card.click();
    try {
      let dialog = null;
      for (let attempt = 0; attempt < 12; attempt++) {
        checkpoint(context);
        const added = [...document.querySelectorAll(DIALOG_SELECTOR)].filter(node => rendered(node) && !before.has(node));
        if (added.length > 1) { warning(context, 'ظهرت تفاصيل أحداث متعددة؛ تعذر تحديد النافذة التي تخص الحدث.'); return []; }
        if (added.length === 1) { dialog = added[0]; context.dialog = dialog; break; }
        await pause(context, 100);
      }
      if (!dialog) { warning(context, 'لم تظهر تفاصيل الحدث في بنية مدعومة؛ لم يُضغط زر الانضمام.'); return []; }
      // Details can mount before their organizer/link content. Wait briefly,
      // checking cancellation between each read, rather than treating that as
      // an established absence of a meeting link.
      for (let attempt = 0; attempt < 12; attempt++) {
        assertDay(context, view);
        const organizers = organizerNames(dialog), matches = teacherNames(dialog, context.teachers);
        if (organizers.size > 1 || organizers.size === 1 && !organizers.has(teacherKey) || matches.length > 1) {
          warning(context, 'اسم المعلم في تفاصيل الحدث غير مطابق أو ملتبس؛ أُهمل رابط الحدث.');
          return [];
        }
        const links = meetingLinks(dialog);
        if (organizers.has(teacherKey) && matches.length === 1 && matches[0] === teacherKey && links.length) {
          return links.map(link => ({...link, title: eventTitle(dialog, context.teachers)}));
        }
        await pause(context, 100);
      }
      warning(context, 'لم تكتمل هوية المعلم ورابطه في تفاصيل حدث التقويم؛ أُهمل الحدث.');
      return [];
    } finally {
      // Cancellation can occur immediately after the card opens a dialog.
      if (!context.dialog) {
        const added = [...document.querySelectorAll(DIALOG_SELECTOR)].filter(node => rendered(node) && !before.has(node));
        if (added.length === 1) context.dialog = added[0];
      }
      closeOwnedDialog(context);
    }
  }

  async function read(payload = {}) {
    const context = {date: payload.date, warnings: [], cancelled: false, dialog: null, location: location.href,
      requestId: typeof payload.requestId === 'string' ? payload.requestId.slice(0, 200) : '',
      deadlineAt: Math.min(Number.isFinite(payload.deadlineAt) ? payload.deadlineAt : Date.now() + 20000, Date.now() + 90000)};
    if (active) return {ok: false, date: payload.date, events: [], warnings: ['قراءة أخرى لتقويم تيمز ما زالت جارية.']};
    active = context;
    let positions = [], events = [];
    try {
      checkpoint(context);
      if (!validDate(context.date)) throw fail('تاريخ قراءة تقويم تيمز غير صالح.');
      context.teachers = requestedTeachers(payload.teachers);
      const view = calendarView();
      if (!view) throw fail('لم يظهر تقويم تيمز في عرض يوم مدعوم؛ لم تُقرأ صفحة اجتماع أو عرض غير معروف.');
      if (selectedDate(view) !== context.date) throw fail('تاريخ تقويم تيمز غير مقروء أو لا يطابق تاريخ جدول مدرستي.');
      const rows = completeRows(view);
      positions = scrollState(view);
      const groups = new Map();
      let count = 0;
      for (let index = 0; index < rows.length; index++) {
        const cards = [...rows[index].querySelectorAll(EVENT_SELECTOR)].filter(card => rendered(card) &&
          !card.parentElement?.closest(EVENT_SELECTOR) && card.closest('[role="row"]') === rows[index]);
        for (const card of cards) {
          if (++count > MAX_EVENTS) throw fail('عدد أحداث التقويم تجاوز حد القراءة الآمن.');
          assertDay(context, view);
          const matches = teacherNames(card, context.teachers);
          if (matches.length !== 1) {
            warning(context, matches.length ? 'ظهر أكثر من اسم معلم مطلوب في بطاقة الحدث؛ أُهملت البطاقة الملتبسة.' : 'تعذر ربط بطاقة حدث باسم معلم مطلوب؛ أُهملت البطاقة.');
            continue;
          }
          const teacherKey = matches[0];
          let links = meetingLinks(card);
          if (!links.length) links = await detailLinks(context, view, card, teacherKey);
          assertDay(context, view);
          if (links.length !== 1) {
            warning(context, links.length ? 'ظهر أكثر من رابط اجتماع في الحدث؛ لم يُختَر رابط بالتخمين.' : 'لم يظهر رابط اجتماع قابل للقراءة في حدث التقويم.');
            continue;
          }
          const period = index + 1, key = teacherKey + '|' + period;
          if (!groups.has(key)) groups.set(key, new Map());
          groups.get(key).set(links[0].key, {teacherName: context.teachers.get(teacherKey), period, url: links[0].url,
            title: eventTitle(card, context.teachers) || links[0].title || '',
            eventId: String(card.getAttribute('data-event-id') || card.id || 'calendar|' + context.date + '|' + key + '|' + links[0].key).slice(0, 1000)});
        }
      }
      assertDay(context, view);
      if (completeRows(view).some((row, index) => row !== rows[index])) throw fail('تغيّرت صفوف اليوم أثناء قراءة التقويم؛ أُهملت النتائج.');
      if (!count) throw fail('لم تظهر أحداث تقويم قابلة للقراءة؛ استخدم تقرير فحص التقويم للتحقق من شكل الصفحة.');
      for (const matches of groups.values()) {
        if (matches.size === 1) events.push([...matches.values()][0]);
        else warning(context, 'يوجد اجتماعا تقويم مختلفان للمعلم نفسه في ترتيب الحصة نفسه؛ أُهملت المطابقة الملتبسة.');
      }
      return {ok: true, date: context.date, events, warnings: context.warnings};
    } catch (error) {
      warning(context, error?.calendarReadError ? error.message : 'تعذرت قراءة تقويم تيمز في بنيته الحالية؛ لم تُعتمد روابط بالتخمين.');
      return {ok: false, date: context.date, events: [], warnings: context.warnings};
    } finally {
      closeOwnedDialog(context);
      for (const {node, top, left} of positions) if (node.isConnected) { node.scrollTop = top; node.scrollLeft = left; }
      active = null;
    }
  }
  function cancel(requestId) {
    if (active && typeof requestId === 'string' && requestId === active.requestId) { active.cancelled = true; return true; }
    return false;
  }

  globalThis.MirsadTeamsCalendarReader = {read, probe, cancel, diagnostic, isCalendarView: () => !!calendarView()};
  globalThis.chrome?.runtime?.onMessage?.addListener((message, _sender, reply) => {
    if (message?.type === MESSAGE + 'PROBE') { reply(probe()); return false; }
    if (message?.type === MESSAGE + 'DIAGNOSTIC') { reply(diagnostic(message)); return false; }
    if (message?.type === MESSAGE + 'CANCEL') { reply({ok: true, cancelled: cancel(message.requestId)}); return false; }
    if (message?.type !== MESSAGE + 'READ') return false;
    read(message).then(reply);
    return true;
  });
})();
