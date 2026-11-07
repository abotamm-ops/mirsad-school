(()=>{const b=document.getElementById('quick-daily-start');if(!b)return;b.onclick=async()=>{
 if(!confirm('متأكد أنك ضبطت توقيت الحصص والدورات؟\nسيُحمّل جدول اليوم وتُحفظ الإعدادات ويبدأ الرصد حسب التوقيت.'))return;
 const fields=['startPeriod','endPeriod','manualStart','periodDuration','manualGapMinutes','scanDelay','roundCount','roundGapMinutes','thirdRoundGapMinutes'];
 const settings=Object.fromEntries(fields.map(k=>[k,k==='manualStart'?document.getElementById(k).value:Number(document.getElementById(k).value)]));
 b.disabled=true;
 try{const ticket=crypto.randomUUID();await chrome.storage.local.set({['mirsadQuickStart:'+ticket]:{settings,at:Date.now()}});await chrome.tabs.create({url:chrome.runtime.getURL('quick-start.html')+'#'+ticket,active:true})}catch(e){document.getElementById('status').textContent='تعذر البدء السريع: '+e.message}finally{b.disabled=false}
};})();
