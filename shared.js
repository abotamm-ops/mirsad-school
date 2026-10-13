(() => {
  const ENDPOINT = "https://script.google.com/macros/s/AKfycbznAVdLw5KVYmESB6Dx4av84-UQi3lewoK2Si59UNf_03y9keQf3CNxtXu0KhGbudX7Ng/exec";
  const cb = "__mirsadSharedCallback";
  const script = document.createElement("script");
  let finished = false;
  const timer = setTimeout(() => finish("تعذر تحميل البيانات المشتركة؛ نعرض الجدول المنشور."), 12000);
  function finish(message) {
    if (finished) return; finished = true; clearTimeout(timer);
    try { delete window[cb]; } catch (_) { window[cb] = undefined; }
    script.remove();
    if (message) {
      let n = document.getElementById("mirsad-sync-note");
      if (!n) { n = document.createElement("div"); n.id = "mirsad-sync-note"; document.querySelector("main")?.prepend(n); }
      if (n) { n.textContent = message; Object.assign(n.style,{background:"#fff7df",padding:"10px",margin:"10px",borderRadius:"8px",direction:"rtl",fontFamily:"Tahoma"}); }
    }
  }
  window[cb] = (r) => {
    if (finished) return;
    if (!r || !r.ok || !r.payload || !Array.isArray(r.payload.lessons) || !r.payload.lessons.length) {
      finish("لا توجد بيانات مشتركة صالحة؛ الجدول المنشور لم يتغير."); return;
    }
    render(r.payload); finish();
  };
  script.onerror = () => finish("تعذر الاتصال بالمصدر المشترك؛ الجدول المنشور لم يتغير.");
  script.src = ENDPOINT + "?callback=" + encodeURIComponent(cb) + "&_=" + Date.now();
  document.head.appendChild(script);
  function esc(v) { return String(v == null ? "" : v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
  function render(p) {
    const ls=p.lessons, teachers=[...new Set(ls.map(x=>x.teacher).filter(Boolean))], cells=[2,3,4,5,6,7,8];
    const by=new Map(teachers.map(t=>[t,Array.from({length:7},()=>[])]));
    ls.forEach(l=>{const i=cells.indexOf(Number(l.cellIndex)); if(i>=0 && by.has(l.teacher)) by.get(l.teacher)[i].push(l);});
    const old=document.querySelector("main"); if(!old) return;
    const app=document.createElement("section"); app.id="mirsad-live-shared";
    app.innerHTML=`<div style="background:white;padding:10px;border-radius:8px;margin-bottom:10px;direction:rtl;font:13px Tahoma">آخر مزامنة: ${esc(p.updatedAt ? new Date(p.updatedAt).toLocaleString("ar-SA") : "غير معروف")} — ${ls.length} حصة</div>
    <div style="background:white;padding:10px;border-radius:8px;margin-bottom:10px"><input id="mirsad-live-search" placeholder="ابحث باسم المعلم أو عنوان الدرس" style="font:14px Tahoma;padding:10px;width:100%;box-sizing:border-box"></div>
    <div style="overflow:auto;background:white;border-radius:8px"><table style="border-collapse:collapse;width:100%;min-width:1100px;direction:rtl;font:12px Tahoma"><thead><tr><th style="background:#0e7490;color:white;padding:10px">المعلم</th>${["الأولى","الثانية","الثالثة","الرابعة","الخامسة","السادسة","السابعة"].map(x=>`<th style="background:#0e7490;color:white;padding:10px">الحصة ${x}</th>`).join("")}</tr></thead><tbody>${teachers.map((t,i)=>`<tr><th style="background:#edf6f7;padding:9px;text-align:right;border:1px solid #ddd">${i+1}. ${esc(t)}</th>${by.get(t).map(a=>`<td style="vertical-align:top;padding:5px;border:1px solid #ddd;min-width:130px">${a.length?a.map(l=>`<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:7px;padding:7px;margin-bottom:4px"><b>${esc(l.title||l.lesson||"حصة")}</b>${l.lesson && l.title && l.lesson!==l.title?`<div style="margin-top:4px">${esc(l.lesson)}</div>`:""}${l.time?`<div style="color:#475569;margin-top:4px">${esc(l.time)}</div>`:""}${l.teams?`<div style="margin-top:6px"><a href="${esc(l.teams)}" target="_blank" rel="noopener noreferrer">فتح Teams</a></div>`:""}</div>`).join(""):"<div style='text-align:center;color:#cbd5e1;padding:15px'>—</div>"}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
    old.replaceChildren(app);
    app.querySelector("#mirsad-live-search").addEventListener("input",e=>{const q=e.target.value.trim().toLocaleLowerCase("ar");app.querySelectorAll("tbody tr").forEach(tr=>tr.hidden=!tr.innerText.toLocaleLowerCase("ar").includes(q));});
  }
})();