const statusNode=document.getElementById("status");
const mappingList=document.getElementById("mapping-list");
const MAPPING_KEY="mirsadManualMappings";
let lastMappingSignature="";
let manualMappings={};
async function renderMappings(run){
  const saved=await chrome.storage.local.get(MAPPING_KEY);
  manualMappings=saved[MAPPING_KEY]||{};
  const results=run?.results||[];
  const relevant=new Map();
  for(const item of results){
    if(item.status!=="present"&&item.status!=="absent")continue;
    const key=String(item.teacher||"").trim();
    if(!key)continue;
    const current=relevant.get(key)||{teacher:key,status:item.status,at:item.scannedAt||0,period:item.period};
    if((item.scannedAt||0)>=current.at){current.status=item.status;current.at=item.scannedAt||0;current.period=item.period;}
    relevant.set(key,current);
  }
  const teachers=[...new Set((run?.schedule||[]).map(x=>String(x.teacher||"").trim()).filter(Boolean))];
  // Keep the teacher roster and the Teams-organizer rows in their original order; never alphabetize them.
  const rows=[...relevant.values()];
  const signature=JSON.stringify({rows:rows.map(x=>[x.teacher,x.status,x.period]),teachers});
  if(signature===lastMappingSignature)return;
  lastMappingSignature=signature;
  mappingList.replaceChildren();
  if(!rows.length){mappingList.textContent="لم تُسجّل أسماء بحالة حاضر أو غائب حتى الآن.";return;}
  for(const row of rows){
    const wrapper=document.createElement("div");wrapper.className="mapping-row";
    const name=document.createElement("div");name.className="teams-name";name.textContent="اسم Teams: "+row.teacher;wrapper.appendChild(name);
    const meta=document.createElement("div");meta.className="mapping-meta";meta.textContent=(row.status==="present"?"الحالة: حاضر":"الحالة: غائب")+" — الحصة "+row.period;wrapper.appendChild(meta);
    const select=document.createElement("select");select.setAttribute("aria-label","اختر المعلم الصحيح للاسم "+row.teacher);
    const placeholder=document.createElement("option");placeholder.value="";placeholder.textContent="— اختر اسم المعلم الصحيح —";select.appendChild(placeholder);
    for(const teacher of teachers){const option=document.createElement("option");option.value=teacher;option.textContent=teacher;select.appendChild(option);}
    select.value=manualMappings[row.teacher]||"";
    select.addEventListener("change",async()=>{
      manualMappings[row.teacher]=select.value;
      if(!select.value)delete manualMappings[row.teacher];
      await chrome.storage.local.set({[MAPPING_KEY]:manualMappings});
      meta.textContent=(row.status==="present"?"الحالة: حاضر":"الحالة: غائب")+" — الحصة "+row.period+(select.value?" — رُبط يدويًا بـ: "+select.value:" — لم يتم اختيار معلم");
    });
    wrapper.appendChild(select);
    if(manualMappings[row.teacher]){const chosen=document.createElement("div");chosen.className="mapping-meta";chosen.textContent="المعلم المختار: "+manualMappings[row.teacher];wrapper.appendChild(chosen);}
    mappingList.appendChild(wrapper);
  }
}
async function refresh(){
  try{
    const r=await chrome.runtime.sendMessage({type:"MIRSAD_STATUS"});
    statusNode.textContent=r?.status?.text||"لا توجد حالة";
    const run=r?.run;
    if(run?.running&&run.period)statusNode.textContent+="\nالتقدم: الحصة "+run.period+"، الدورة "+(run.cycle||1)+"، "+run.index+"/"+(run.periodItems?.length||0);
    await renderMappings(run);
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
document.getElementById("test").addEventListener("click",async()=>{
  statusNode.textContent="جارٍ تجهيز اختبار مباشر لرابط واحد…";
  await chrome.runtime.sendMessage({type:"MIRSAD_TEST_ONE"});
  setTimeout(refresh,500);
});
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
    const mappingStore=await chrome.storage.local.get(MAPPING_KEY);
    const mappings=mappingStore[MAPPING_KEY]||{};
    const headers=["وقت الفحص","اسم Teams","المعلم المطابق يدويًا","رقم الحصة","الحالة","التفاصيل","الدورة"];
    const lines=[headers,...rows.map(item=>[
      item.scannedAt?new Date(item.scannedAt).toLocaleString("ar-SA"):"",
      item.teacher||"",
      mappings[item.teacher]||"",
      item.period||"",
      item.status==="present"?"حاضر":item.status==="absent"?"غياب مبدئي":item.status==="invited"?"ضمن المدعوين":"غير محسوم",
      item.detail||"",
      item.cycle||""
    ])].map(row=>row.map(csvCell).join(","));
    const csv="\uFEFF"+lines.join("\r\n");
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
