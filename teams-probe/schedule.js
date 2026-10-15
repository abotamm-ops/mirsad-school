(() => {
  if (window.__mirsadScheduleBridge) return;
  window.__mirsadScheduleBridge = true;
  const norm = s => String(s || "").replace(/\s+/g, " ").trim();
  function collectSchedule() {
    const rows = [...document.querySelectorAll("tr[data-teacher]")];
    const items = [];
    for (const row of rows) {
      const teacher = norm(row.getAttribute("data-teacher") || row.querySelector(".teacher-name")?.innerText);
      // Use the visible cell order, not data-period: the data source's internal
      // cellIndex values are not the displayed lesson numbers.
      const cells = [...row.querySelectorAll("td")];
      cells.forEach((cell, cellIndex) => {
        const period = cellIndex + 1;
        for (const a of cell.querySelectorAll('a.teams[href]')) {
          const url = a.href;
          if (!teacher || !url || !/^https:\/\/(teams\.microsoft\.com|teams\.live\.com)\//i.test(url)) continue;
          items.push({teacher, period, url, label:norm(a.closest(".lesson")?.innerText || cell.innerText)});
        }
      });
    }
    return items;
  }
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === "MIRSAD_GET_SCHEDULE") {
      sendResponse({ok:true,items:collectSchedule(),page:location.href,title:document.title});
      return false;
    }
  });
})();