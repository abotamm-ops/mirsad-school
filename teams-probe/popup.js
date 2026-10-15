const statusNode=document.getElementById("status");
async function refresh(){
  try{
    const r=await chrome.runtime.sendMessage({type:"MIRSAD_STATUS"});
    statusNode.textContent=r?.status?.text||"لا توجد حالة";
    const run=r?.run;
    if(run?.running&&run.period)statusNode.textContent+="\nالتقدم: الحصة "+run.period+"، الدورة "+(run.cycle||1)+"، "+run.index+"/"+(run.periodItems?.length||0);
    if(run?.results?.length){
      const recent=run.results.slice(-5).map(x=>x.teacher+" — الحصة "+x.period+": "+(x.status==="present"?"حاضر":x.status==="absent"?"غياب مبدئي":x.status==="invited"?"ضمن المدعوين":"غير محسوم"));
      statusNode.textContent+="\n\nآخر النتائج:\n"+recent.join("\n");
      const grouped=new Map();
      for(const x of run.results){
        const key=x.period+"|"+x.teacher;
        if(!grouped.has(key))grouped.set(key,{period:x.period,teacher:x.teacher,present:0,absent:0,unresolved:0,invited:0,scans:0});
        const g=grouped.get(key);g.scans++;
        if(x.status==="present")g.present++;else if(x.status==="absent")g.absent++;else if(x.status==="invited")g.invited++;else g.unresolved++;
      }
      const rows=[...grouped.values()].sort((a,b)=>a.period-b.period||a.teacher.localeCompare(b.teacher,"ar"));
      const summary=rows.slice(-12).map(g=>{
        const known=g.present+g.absent;
        const pct=known?Math.round(g.present/known*100)+"%":"—";
        return "ح"+g.period+" "+g.teacher+": "+pct+" ظهور ("+g.present+"/"+known+")، غير محسوم "+g.unresolved;
      });
      statusNode.textContent+="\n\nملخص الزيارات الأخيرة:\n"+summary.join("\n");
      statusNode.textContent+="\nالنسبة أولية للزيارات المقروءة فقط، وليست حكمًا نهائيًا بالغياب.";
    }
  }catch(_){statusNode.textContent="تعذر قراءة حالة الإضافة."}
}
document.getElementById("start").addEventListener("click",async()=>{
  statusNode.textContent="جارٍ بدء المراقبة…";
  await chrome.runtime.sendMessage({type:"MIRSAD_START"});
  setTimeout(refresh,500);
});
document.getElementById("stop").addEventListener("click",async()=>{
  statusNode.textContent="جارٍ إيقاف المراقبة…";
  await chrome.runtime.sendMessage({type:"MIRSAD_STOP"});
  setTimeout(refresh,300);
});
refresh();
setInterval(refresh,1500);


function csvCell(value){
  const text=String(value??"");
  return '"' + text.replace(/"/g,'""') + '"';
}
document.getElementById("export").addEventListener("click",async()=>{
  const button=document.getElementById("export");
  button.disabled=true;
  try{
    const response=await chrome.runtime.sendMessage({type:"MIRSAD_STATUS"});
    const run=response?.run;
    const rows=run?.results||[];
    if(!rows.length){
      statusNode.textContent="لا توجد فحوصات محفوظة لتصديرها حتى الآن.";
      return;
    }
    const headers=["وقت الفحص","المعلم","رقم الحصة","الحالة","التفاصيل","الدورة"];
    const lines=[headers,...rows.map(item=>[
      item.scannedAt?new Date(item.scannedAt).toLocaleString("ar-SA"):"",
      item.teacher||"",
      item.period||"",
      item.status==="present"?"حاضر":item.status==="absent"?"غياب مبدئي":item.status==="invited"?"ضمن المدعوين":"غير محسوم",
      item.detail||"",
      item.cycle||""
    ])].map(row=>row.map(csvCell).join(","));
    const csv="\\uFEFF"+lines.join("\\r\\n");
    const url="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);
    await chrome.downloads.download({
      url,
      filename:"mirsad-teams-report-"+new Date().toISOString().slice(0,10)+".csv",
      saveAs:true
    });
    statusNode.textContent="جهز مرصاد تقريرًا محليًا يحتوي على "+rows.length+" نتيجة. النسب والحالات أولية وليست اعتمادًا نهائيًا للغياب.";
  }catch(_){
    statusNode.textContent="تعذر تنزيل التقرير. تأكد من صلاحية التنزيل ثم أعد المحاولة.";
  }finally{
    button.disabled=false;
  }
});
