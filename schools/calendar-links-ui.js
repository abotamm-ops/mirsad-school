(function(root){
 'use strict';
 const labels={madrasati:'مدرستي',calendar:'تقويم تيمز'},states={present:'حاضر',absent:'غائب',unresolved:'غير محسوم','no-link':'لا يوجد رابط'};
 function meetingUrl(value){try{return root.MirsadScheduleCore?.normalizeTeamsUrl(value)||''}catch{return ''}}
 function meetingKey(value){return meetingUrl(value).split(/[?#]/)[0]}
 function links(lesson){
  const primary=meetingUrl(lesson?.url),calendar=meetingUrl(lesson?.calendarUrl),result=[];
  if(primary)result.push({source:'madrasati',label:labels.madrasati,url:primary});
  if(calendar&&meetingKey(calendar)!==meetingKey(primary))result.push({source:'calendar',label:labels.calendar,url:calendar});
  return result;
 }
 function sourceOf(result){return ['calendar','teams-calendar','calendar-teams'].includes(result?.source)?'calendar':'madrasati'}
 function safeEvidence(value){try{const url=new URL(value);return url.protocol==='https:'&&url.hostname==='drive.google.com'&&/^\/file\/d\/[\w-]+\/view$/.test(url.pathname)?url.href:''}catch{return ''}}
 function evidence(cell){
  const result=[],seen=new Set();
  for(const record of [...(cell.evidence||[]),...(cell.history||[])]){
   for(const item of [record,...(Array.isArray(record.linkResults)?record.linkResults:[])]){
    const url=safeEvidence(item.evidenceUrl);if(!url||item.status==='present'||seen.has(url))continue;
    seen.add(url);result.push({...item,cycle:record.cycle,evidenceUrl:url});
   }
  }
  return result;
 }
 function element(parent,tag,value){const node=parent.ownerDocument.createElement(tag);if(value!==undefined)node.textContent=value;return node}
 function appendLink(parent,result,lesson){
  const source=result.source,link=element(parent,'a',labels[source]);link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';link.className='teams-lesson-link lesson-link-'+source;link.dataset.source=source;
  link.setAttribute('aria-label','فتح '+labels[source]+' — '+(lesson.teacherName||'المعلم')+' — الحصة '+lesson.period);parent.append(link);return link;
 }
 function appendLinks(parent,lesson){for(const result of links(lesson))appendLink(parent,result,lesson)}
 function appendResults(parent,record,lesson){
  if(!Array.isArray(record.linkResults)||!record.linkResults.length)return;
  const list=element(parent,'ul');list.className='link-results';list.setAttribute('aria-label','تفاصيل روابط الدورة '+(record.cycle||''));
  for(const result of record.linkResults){
   const source=sourceOf(result),item=element(list,'li');item.className='link-result link-result-'+source;item.dataset.source=source;item.dataset.scanId=String(result.scanId||'');
   const line=element(item,'p',labels[source]+' — '+(states[result.status]||states.unresolved));line.className='link-result-status '+(['present','absent'].includes(result.status)?result.status:'unresolved');item.append(line);
   const url=meetingUrl(result.url);if(url)appendLink(item,{source,url},lesson);
   if(result.scannedAt){const time=element(item,'time');try{time.dateTime=new Date(result.scannedAt).toISOString();time.textContent=new Date(result.scannedAt).toLocaleString('ar-SA',{timeZone:'Asia/Riyadh',dateStyle:'short',timeStyle:'short'});item.append(time)}catch{}}
   if(result.detail)item.append(element(item,'p',String(result.detail)));
   const proof=safeEvidence(result.evidenceUrl);if(proof){const link=element(item,'a','فتح صورة '+labels[source]);link.href=proof;link.target='_blank';link.rel='noopener noreferrer';link.className='link-result-evidence';item.append(link)}
   list.append(item);
  }
  parent.append(list);
 }
 const api={links,meetingKey,evidence,appendLinks,appendResults};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.MirsadCalendarLinksUI=Object.freeze(api);
})(globalThis);
