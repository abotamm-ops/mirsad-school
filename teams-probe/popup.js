const statusNode=document.getElementById("status");
async function refresh(){
 try{
  const r=await chrome.runtime.sendMessage({type:"MIRSAD_STATUS"});
  statusNode.textContent=r?.status?.text||"لا توجد حالة";
  const run=r?.run;
  if(run?.running&&run.period)statusNode.textContent+="\nالتقدم: الحصة "+run.period+"، الدورة "+(run.cycle||1)+"، "+run.index+"/"+(run.periodItems?.length||0);
  if(run?.results?.length){
   const recent=run.results.slice(-6).map(x=>(x.scheduledTeacher||x.teacher)+" — الحصة "+x.period+": "+(x.status==="present"?"حاضر":x.status==="absent"?"غياب مبدئي":x.status==="invited"?"ضمن المدعوين":"غير محسوم"));
   statusNode.textContent+="\n\nآخر النتائج:\n"+recent.join("\n");
  }
 }catch(_){statusNode.textContent="تعذر قراءة حالة الإضافة."}
}
document.getElementById("start").addEventListener("click",async()=>{
 statusNode.textContent="جارٍ بدء المراقبة لجميع روابط الحصص…";
 await chrome.runtime.sendMessage({type:"MIRSAD_START"});
 setTimeout(refresh,500);
});
document.getElementById("stop").addEventListener("click",async()=>{
 statusNode.textContent="جارٍ إيقاف المراقبة…";
 await chrome.runtime.sendMessage({type:"MIRSAD_STOP"});
 setTimeout(refresh,300);
});
setInterval(refresh,1500);refresh();
function csvCell(value){return '"'+String(value??"").replace(/"/g,'""')+'"'}
document.getElementById("export").addEventListener("click",async()=>{
 const button=document.getElementById("export");button.disabled=true;
 try{
  const response=await chrome.runtime.sendMessage({type:"MIRSAD_STATUS"}),rows=response?.run?.results||[];
  if(!rows.length){statusNode.textContent="لا توجد فحوصات محفوظة لتصديرها حتى الآن.";return}
  const stored=await chrome.storage.local.get("mirsadManualMappings"),mappings=stored.mirsadManualMappings||{};
  const headers=["وقت الفحص","المعلم من الجدول","اسم Teams المرصود","المعلم المطابق يدويًا","رقم الحصة","الحالة","التفاصيل","الدورة"];
  const lines=[headers,...rows.map(item=>[
   item.scannedAt?new Date(item.scannedAt).toLocaleString("ar-SA"):"",
   item.scheduledTeacher||"",item.teacher||"",mappings[item.teacher]||"",item.period||"",
   item.status==="present"?"حاضر":item.status==="absent"?"غياب مبدئي":item.status==="invited"?"ضمن المدعوين":"غير محسوم",
   item.detail||"",item.cycle||""
  ])].map(row=>row.map(csvCell).join(","));
  const url="data:text/csv;charset=utf-8,"+encodeURIComponent("\uFEFF"+lines.join("\r\n"));
  await chrome.downloads.download({url,filename:"mirsad-teams-report-"+new Date().toISOString().slice(0,10)+".csv",saveAs:true});
  statusNode.textContent="جهز مرصاد تقريرًا محليًا يحتوي على "+rows.length+" نتيجة. الحالات أولية وليست اعتمادًا نهائيًا للغياب.";
 }catch(_){statusNode.textContent="تعذر تنزيل التقرير. تأكد من صلاحية التنزيل ثم أعد المحاولة."}
 finally{button.disabled=false}
});
