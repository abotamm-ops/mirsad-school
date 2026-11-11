/* Dedicated recording tab only. Never produces attendance results. */
(()=>{'use strict';
 const norm=v=>String(v||'').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640\u200B-\u200F\u202A-\u202E\u2066-\u2069]/g,'').replace(/[أإآ]/g,'ا').replace(/\s+/g,' ').trim().toLowerCase();
 const visible=e=>!!e&&!!e.getBoundingClientRect().width&&!!e.getBoundingClientRect().height;
 const enabled=e=>visible(e)&&!e.disabled&&e.getAttribute('aria-disabled')!=='true';
 const controls=()=>[...document.querySelectorAll('button,a,[role=button],[role=switch]')].filter(enabled);
 const names=e=>[e.getAttribute('aria-label'),e.getAttribute('title'),e.innerText,e.textContent,e.value].filter(Boolean).map(norm);
 const matches=(e,labels,contains=false)=>names(e).some(n=>labels.some(l=>n===norm(l)||n.startsWith(norm(l)+' (')||n.startsWith(norm(l)+' ')||contains&&n.includes(norm(l))));
 const find=(labels,contains=false)=>controls().find(e=>matches(e,labels,contains));
 const peopleLabels=['أشخاص','الأشخاص','المشاركون','المشاركين','عرض المشاركين','people','participants','view participants','show participants'];
 function people(){const exact=[...document.querySelectorAll('button#roster-button,button[data-inp="roster-button"],button[aria-label="أشخاص"]')].find(enabled);if(exact)return exact;return find(peopleLabels)}
 function panelOpen(){
  // Toolbar icons and participant video tiles are not the roster pane.
  const panels=[...document.querySelectorAll('[data-tid="roster-pane"],[data-tid="roster-list"],[data-tid="roster-content"],[data-tid="participants-panel"],[data-tid="calling-roster-panel"]')];
  if(panels.some(e=>visible(e)&&!e.closest?.('button,[role=button]')))return true;
  const headings=[...document.querySelectorAll('[role=heading],h1,h2,h3,h4')].filter(e=>visible(e)&&!e.closest?.('button,[role=button]'));
  const labels=['الحضور','تمت دعوة الآخرين','في هذا الاجتماع','المشاركون','المشاركين','in this meeting','attendees','other invitees','others invited','participants'];
  return headings.some(e=>matches(e,labels));
 }
 const leaveLabels=['leave','leave meeting','مغادرة','مغادرة الاجتماع'];
 async function authorized(p,leave=false){return (await chrome.runtime.sendMessage({type:'MIRSAD_VIDEO_AUTH',id:p.id,leave})).allowed===true}
 function mute(){for(const e of controls()){const n=names(e)[0]||'';if(e.getAttribute('role')==='switch'&&e.getAttribute('aria-checked')==='true'&&/(microphone|camera|ميكروفون|كاميرا)/.test(n))e.click();else if(/^(turn (?:camera|mic|microphone) off|mute(?: microphone)?(?:\s|\(|$)|كتم (?:الصوت|الميكروفون)|ايقاف(?: تشغيل)? (?:الكاميرا|الميكروفون|الفيديو))/.test(n))e.click()}}
 function click(e){try{e.scrollIntoView?.({block:'nearest'});e.focus?.({preventScroll:true});e.click();return true}catch{return false}}
 async function enter(p){let clicked=null,stage='دخول الاجتماع';while(Date.now()<p.deadline-5000){
  if(!await authorized(p))throw Error('انتهى فاصل التسجيل');const button=people();
  if(button){mute();if(panelOpen())return {joined:true,peopleReady:true};stage='إظهار قائمة الأشخاص';if(clicked!==button&&click(button))clicked=button;await new Promise(r=>setTimeout(r,700));continue}
  mute();const web=find(['continue on this browser','continue in this browser','use teams on the web instead','join on the web instead','متابعة على هذا المستعرض','المتابعة على هذا المستعرض','استخدام teams على الويب','الانضمام على الويب بدلا من ذلك'],true);
  if(web){stage='المتابعة على المستعرض';click(web);await new Promise(r=>setTimeout(r,1200));continue}
  const join=find(['join now','join meeting','join','join the meeting','الانضمام','انضمام','الانضمام إلى الاجتماع','الانضمام الان','انضمام الان','انضم الان']);if(join){stage='الانضمام إلى الاجتماع';click(join)}await new Promise(r=>setTimeout(r,700));
 }throw Error('تعذر '+stage+' قبل نهاية فاصل التسجيل؛ لم يبدأ تسجيل صفحة غير جاهزة')}
 async function leave(p){if(!await authorized(p,true))return {left:false};const button=find(leaveLabels);if(!button)return {left:false};click(button);for(let i=0;i<10;i++){await new Promise(r=>setTimeout(r,100));if(!find(leaveLabels))return {left:true}}return {left:false}}
 chrome.runtime.onMessage.addListener((p,s,reply)=>{if(!['MIRSAD_VIDEO_ENTER','MIRSAD_VIDEO_LEAVE'].includes(p?.type)||s.id!==chrome.runtime.id)return;(p.type==='MIRSAD_VIDEO_ENTER'?enter(p):leave(p)).then(r=>reply({ok:true,...r})).catch(e=>reply({ok:false,error:e.message}));return true});
})();
