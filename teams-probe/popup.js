const statusNode=document.getElementById("status");
async function refresh(){
  try{
    const r=await chrome.runtime.sendMessage({type:"MIRSAD_STATUS"});
    statusNode.textContent=r?.status?.text||"لا توجد حالة";
    const run=r?.run;
    if(run?.running) statusNode.textContent += "\nالتقدم: "+run.index+" / "+run.queue.length;
    if(run?.results?.length){
      const recent=run.results.slice(-5).map(x=>x.teacher+" — الحصة "+x.period+": "+(x.status==="present"?"حاضر":x.status==="absent"?"غياب مبدئي":x.status==="invited"?"ضمن المدعوين":x.status==="unresolved"?"غير محسوم":"نتيجة غير معروفة"));
      statusNode.textContent += "\n\nآخر النتائج:\n"+recent.join("\n");
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
