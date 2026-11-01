(()=>{
 const $=id=>document.getElementById(id),DATE_KEY='mirsadMadrasatiSelectedDate';let editing=false,dateEditing=false,errorText='',selectionNotice='';
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 async function refresh(){try{
  const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_INFO'});if(!r?.ok)return;
  if(!editing)$('scheduleSource').value=r.mode;$('collectMadrasati').hidden=false;
  for(const id of ['madrasatiDateLabel','madrasatiDateHint'])$(id).hidden=r.mode!=='madrasati';
  $('madrasatiSourceDate').disabled=!!r.state?.running;
  if(!dateEditing&&!$('madrasatiSourceDate').value)$('madrasatiSourceDate').value=r.selectedDate;
  $('collectMadrasati').disabled=!!r.state?.running;$('scheduleSource').disabled=!!r.state?.running;
  if(!errorText)void globalThis.MirsadPopupWorkflow?.source(r);const selected=$('madrasatiSourceDate').value,last=r.lastSuccess;
  const result=r.mode==='naqar'?'المصدر نقار — التحميل مباشرة إلى الرصد الآلي':r.state?.error?r.state.text:last?.date&&last.date!==selected?'التاريخ المختار: '+selected+' — آخر نقل ناجح: '+last.date+' ('+last.lessons+' حصة)':r.state?.text;
  $('scheduleSourceStatus').textContent=errorText||(r.state?.running?r.state.text:selectionNotice||result)||(r.mode==='naqar'?'المصدر نقار — بالطريقة الحالية':'المصدر مدرستي — جاهز للجمع');
 }catch{}}
 async function saveDate(showNotice=true){dateEditing=true;const value=$('madrasatiSourceDate').value;if(!validDate(value))return false;
  errorText='';if(showNotice)selectionNotice='جارٍ حفظ التاريخ المختار…';
  try{await chrome.storage.local.set({[DATE_KEY]:value});if(showNotice&&$('madrasatiSourceDate').value===value){selectionNotice='تم حفظ تاريخ الجدول '+value+'؛ اضغط «نقل من مدرستي إلى مرصاد» لبدء الجمع.';$('scheduleSourceStatus').textContent=selectionNotice}return true}
  catch{errorText='تعذر حفظ التاريخ؛ أعد اختيار التاريخ قبل النقل';$('scheduleSourceStatus').textContent=errorText;return false}
 }
 $('scheduleSource').onchange=async()=>{editing=true;errorText='';selectionNotice='';const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_SELECT',mode:$('scheduleSource').value});if(!r?.ok){errorText=r?.error||'تعذر حفظ المصدر؛ حدّث السكربت';$('scheduleSourceStatus').textContent=errorText;return}editing=false;await refresh()};
 $('collectMadrasati').onclick=async()=>{errorText='';selectionNotice='';const wf=globalThis.MirsadPopupWorkflow;wf?.mark('collectMadrasati','busy');$('collectMadrasati').disabled=true;try{if($('scheduleSource').value==='naqar'){const r=await chrome.runtime.sendMessage({type:'MIRSAD_IMPORT_NAQAR'});if(!r?.ok)throw new Error(r?.error||'لم يُطبق جدول نقار في الرصد الآلي');await wf?.naqarDone();selectionNotice='تم تطبيق جدول نقار في الرصد الآلي — '+r.day.snapshot.lessons.length+' حصة';$('scheduleSourceStatus').textContent=selectionNotice;return}if(!await saveDate(false))throw new Error('اختر تاريخًا صحيحًا قبل النقل');wf?.sourceStarted(await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_INFO'}));const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_COLLECT',date:$('madrasatiSourceDate').value});if(!r?.ok)throw new Error(r?.error||'تعذر بدء الجمع');$('scheduleSourceStatus').textContent='جارٍ تحميل الجدول؛ يصبح الزر أخضر بعد اكتمال النقل.'}catch(e){errorText=e.message;wf?.mark('collectMadrasati','error');$('scheduleSourceStatus').textContent=errorText}finally{$('collectMadrasati').disabled=false}};
 // Start the storage request during the input event; closing the popup does not undo it.
 $('madrasatiSourceDate').oninput=()=>void saveDate();$('madrasatiSourceDate').onchange=()=>void saveDate();void refresh();setInterval(refresh,1500);
})();
