(() => {
  if (window.__mirsadScheduleBridge) return;
  window.__mirsadScheduleBridge = true;
  const core = globalThis.MirsadScheduleCore;
  if (!core) return;

  const norm = core.normalize;
  const headerRows = table => [...table.querySelectorAll("tr,[role=row]")].filter(row => {
    const cells = [...row.querySelectorAll("th,td,[role=columnheader]")];
    if (cells.length < 7) return false;
    return core.mapHeaders(cells.map(cell => ({
      label:cell.innerText || cell.textContent,
      cellIndex:Number.isInteger(cell.cellIndex) ? cell.cellIndex : [...(cell.parentElement?.children || [])].indexOf(cell),
      columnSpan:cell.colSpan || 1
    }))).length === 7;
  });
  const readHeaders = table => {
    const rows = headerRows(table);
    for (const row of rows) {
      const cells = [...row.querySelectorAll("th,td,[role=columnheader]")];
      const mapped = core.mapHeaders(cells.map(cell => ({
        label: cell.innerText || cell.textContent,
        cellIndex: Number.isInteger(cell.cellIndex) ? cell.cellIndex : [...(cell.parentElement?.children || [])].indexOf(cell),
        columnSpan: cell.colSpan || 1
      })));
      if (mapped.length === 7) return mapped;
    }
    return [];
  };

  const readOrdinalColumns = table => {
    return new Map(readHeaders(table).map(item => [item.cellIndex,item.n]));
  };

  const tableRows = table => {
    const headers = new Set(headerRows(table));
    return [...table.querySelectorAll("tr")].filter(row => !headers.has(row) && row.querySelectorAll("td,th").length >= 2);
  };
  const readTeacherColumn = table => {
    const rows = headerRows(table);
    const cells = rows.flatMap(row => [...row.querySelectorAll("th,td,[role=columnheader]")]);
    const labeled = cells.find(cell => /معلم|teacher|اسم المعلم/i.test(norm(cell.innerText || cell.textContent)));
    if (labeled) return Number.isInteger(labeled.cellIndex) ? labeled.cellIndex : [...(labeled.parentElement?.children || [])].indexOf(labeled);
    const headers = readHeaders(table);
    const periodColumns = new Set(headers.map(header => header.cellIndex));
    return cells.find(cell => !periodColumns.has(cell.cellIndex))?.cellIndex ?? 0;
  };

  function collectSchedule(manualPeriodMapping = false) {
    const items = [];
    const tables = [...document.querySelectorAll("table")];
    const tableMaps = tables.map(table => ({
      headers:readHeaders(table),
      ordinalColumns:readOrdinalColumns(table),
      teacherColumn:readTeacherColumn(table)
    }));
    // Some timetable pages render sticky headers and the scrolling teacher
    // rows in separate tables. Reuse the complete seven-period map for those
    // body tables when they do not carry their own header row.
    const sharedMap = tableMaps.find(map => map.headers.length === 7 && map.ordinalColumns.size === 7) ||
      tableMaps.find(map => map.headers.length === 7) || null;
    for (let tableIndex = 0; tableIndex < tables.length; tableIndex++) {
      const table = tables[tableIndex];
      const localMap = tableMaps[tableIndex];
      const headers = localMap.headers.length === 7 ? localMap.headers : (sharedMap?.headers || localMap.headers);
      const ordinalColumns = localMap.ordinalColumns.size === 7 ? localMap.ordinalColumns : (sharedMap?.ordinalColumns || localMap.ordinalColumns);
      const teacherColumn = localMap.headers.length === 7 || !sharedMap ? localMap.teacherColumn : sharedMap.teacherColumn;
      for (const row of tableRows(table)) {
        const cells = [...row.querySelectorAll("td,th")];
        const teacherCell = cells.find(cell => cell.cellIndex === teacherColumn) || cells[0];
        const teacher = norm(row.getAttribute("data-teacher") || row.querySelector(".teacher-name")?.innerText || teacherCell?.innerText || teacherCell?.textContent);
        if (!teacher) continue;
        for (const cell of cells) {
          if (cell.cellIndex === teacherColumn) continue;
          const lesson = cell.querySelector(".lesson");
          const root = lesson || cell;
          const anchors = [...root.querySelectorAll("a[href]")];
          const anchor = anchors.find(item => core.validTeamsUrl(item.href || item.getAttribute("href")));
          const url = anchor ? (anchor.href || anchor.getAttribute("href")) : "";
          // A schedule cell is actionable only when it contains a valid Teams
          // meeting link. Empty cells, teachers without a lesson, arrows, and
          // lessons without links are skipped in place; row order stays top-to-bottom.
          if (!url) continue;
          const explicit = [cell.getAttribute("data-period"), lesson?.getAttribute("data-period"), lesson?.querySelector("[data-period]")?.getAttribute("data-period")].find(value => value != null && String(value).trim() !== "");
          const cellLabel = norm(lesson?.innerText || lesson?.textContent || cell.innerText || cell.textContent);
          // Mirsad renders empty schedule cells as a dash; they are not lessons
          // and must not trigger an unknown-period error.
          const placeholder = /^[—–−\-↔←→↖↗↘↙⇐⇒➜➝➞➤›»]+$/u.test(cellLabel);
          if (!anchor && explicit == null && (!cellLabel || placeholder)) continue;
          const cellIndex = Number.isInteger(cell.cellIndex) ? cell.cellIndex : [...(cell.parentElement?.children || [])].indexOf(cell);
          // In this timetable the teacher column is followed by the seven
          // lesson columns. Rank by physical distance from the teacher cell:
          // the adjacent cell is period 1, then 2, through 7. Cell lesson text
          // and unreliable header semantics must not shift that sequence.
          const columnNumber = Math.abs(cellIndex - teacherColumn); // teacher column is internal column 0
          const physicalMapping = manualPeriodMapping && columnNumber >= 1 && columnNumber <= 7 ? columnNumber : null;
          // For the timetable link picker, the seven physical lesson columns
          // are authoritative: teacher column is excluded, adjacent = period 1.
          // This also corrects the observed one-column shift (table column 8 = period 7).
          let period = physicalMapping || (explicit != null ? core.resolveCellPeriod(headers, cellIndex, explicit) : null) || core.resolveCellPeriod(headers, cellIndex) || ordinalColumns.get(cellIndex) || null;
          const common = { teacher, period, url, hasLesson: true, validPeriod: Number.isInteger(period), label: cellLabel };
          if (!common.validPeriod) {
            items.push({ ...common, period: null, cellIndex, reason: "المعلم «" + teacher + "»، نص الخلية «" + (cellLabel || "(فارغة)") + "»، موضع العمود " + cellIndex + ": تعذر ربط الخلية برقم حصة." });
            continue;
          }
          items.push({ ...common, className: norm(lesson?.querySelector(".class")?.innerText), subject: norm(lesson?.querySelector(".lesson-title")?.innerText) });
        }
      }
    }
    return items;
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MIRSAD_GET_SCHEDULE") {
      sendResponse({ ok: true, items: collectSchedule(true), teachers: [...document.querySelectorAll("tr[data-teacher]")].map(row=>row.dataset.teacher), page: location.href, title: document.title });
      return false;
    }
  });
})();
