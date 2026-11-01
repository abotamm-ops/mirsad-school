(()=>{
 const $=id=>document.getElementById(id),DATE_KEY='mirsadMadrasatiSelectedDate';let editing=false,dateEditing=false,errorText='',selectionNotice='';
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T12:00:00Z'))&&new Date(value+'T12:00:00Z').toISOString().slice(0,10)===value;
 async function refresh(){try{
  const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_INFO'});if(!r?.ok)return;
  if(!editing)$('scheduleSource').value=r.mode;$('collectMadrasati').hidden=false;
  for(const id of ['madrasatiDateLabel','madrasatiDateHint'])$(id).hidden=r.mode!=='madrasati';
  $('madrasatiSourceDate').disabled=!!r.state?.running||!!r.pending;
  if(!dateEditing&&!$('madrasatiSourceDate').value)$('madrasatiSourceDate').value=r.selectedDate;
  $('collectMadrasati').disabled=!!r.state?.running||!!r.pending;$('scheduleSource').disabled=!!r.state?.running;
  if(!errorText)void globalThis.MirsadPopupWorkflow?.source(r);const dialog=$('importDecision');if(r.pending){$('importDecisionSummary').textContent='الجديد: '+r.pending.sourceDate+' · '+r.pending.nextLessons+' حصة. السابق: '+r.pending.previousLessons+' حصة · '+r.pending.previousRecords+' نتيجة · '+r.pending.previousImages+' صورة.';if(!dialog.open)dialog.showModal()}else if(dialog.open&&!decisionBusy)dialog.close();const selected=$('madrasatiSourceDate').value,last=r.lastSuccess;
  const result=r.state?.error?r.state.text:last?.date&&last.date!==selected?'التاريخ المختار: '+selected+' — آخر نقل ناجح: '+last.date+' ('+last.lessons+' حصة)':r.state?.text;
  $('scheduleSourceStatus').textContent=errorText||(r.state?.running?r.state.text:selectionNotice||result)||'المصدر مدرستي — جاهز للتحميل إلى الرصد الآلي';
 }catch{}}
 async function saveDate(showNotice=true){dateEditing=true;const value=$('madrasatiSourceDate').value;if(!validDate(value))return false;
  errorText='';if(showNotice)selectionNotice='جارٍ حفظ التاريخ المختار…';
  try{await chrome.storage.local.set({[DATE_KEY]:value});if(showNotice&&$('madrasatiSourceDate').value===value){selectionNotice='تم حفظ تاريخ الجدول '+value+'؛ اضغط «نقل من مدرستي إلى مرصاد» لبدء الجمع.';$('scheduleSourceStatus').textContent=selectionNotice}return true}
  catch{errorText='تعذر حفظ التاريخ؛ أعد اختيار التاريخ قبل النقل';$('scheduleSourceStatus').textContent=errorText;return false}
 }
 $('scheduleSource').onchange=async()=>{editing=true;errorText='';selectionNotice='';const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_SELECT',mode:$('scheduleSource').value});if(!r?.ok){errorText=r?.error||'تعذر حفظ المصدر؛ حدّث السكربت';$('scheduleSourceStatus').textContent=errorText;return}editing=false;await refresh()};
 $('collectMadrasati').onclick=async()=>{errorText='';selectionNotice='';const wf=globalThis.MirsadPopupWorkflow;wf?.mark('collectMadrasati','busy');$('collectMadrasati').disabled=true;try{if(!await saveDate(false))throw new Error('اختر تاريخًا صحيحًا قبل النقل');wf?.sourceStarted(await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_INFO'}));const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_COLLECT',date:$('madrasatiSourceDate').value});if(!r?.ok)throw new Error(r?.error||'تعذر بدء الجمع');$('scheduleSourceStatus').textContent='جارٍ تحميل الجدول؛ يصبح الزر أخضر بعد اكتمال النقل.'}catch(e){errorText=e.message;wf?.mark('collectMadrasati','error');$('scheduleSourceStatus').textContent=errorText}finally{$('collectMadrasati').disabled=false}};
 let decisionBusy=false;
 async function decide(keepPrevious){if(decisionBusy)return;decisionBusy=true;$('importDecisionError').textContent='جارٍ تطبيق اختيارك والتحقق من الرصد…';for(const id of ['keepPreviousImport','discardPreviousImport','cancelPendingImport'])$(id).disabled=true;try{const r=await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_CONFIRM_IMPORT',keepPrevious});if(!r?.ok)throw new Error(r?.error||'لم يُطبّق الجدول');errorText='';selectionNotice='تم تطبيق الجدول الجديد والتحقق منه في الرصد';$('importDecision').close();await refresh()}catch(e){$('importDecisionError').textContent=e.message;errorText=e.message;globalThis.MirsadPopupWorkflow?.mark('collectMadrasati','error')}finally{decisionBusy=false;for(const id of ['keepPreviousImport','discardPreviousImport','cancelPendingImport'])$(id).disabled=false}}
 $('keepPreviousImport').onclick=()=>decide(true);$('discardPreviousImport').onclick=()=>decide(false);$('cancelPendingImport').onclick=async()=>{if(decisionBusy)return;await chrome.runtime.sendMessage({type:'MIRSAD_SOURCE_CANCEL_IMPORT'});errorText='';$('importDecision').close();await refresh()};$('importDecision').addEventListener('cancel',e=>{e.preventDefault();if(!decisionBusy)$('cancelPendingImport').click()});
 // Start the storage request during the input event; closing the popup does not undo it.
 $('madrasatiSourceDate').oninput=()=>void saveDate();$('madrasatiSourceDate').onchange=()=>void saveDate();void refresh();setInterval(refresh,1500);
})();
