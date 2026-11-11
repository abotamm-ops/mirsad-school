/* Incoming tab audio/video only. No microphone or camera permission is requested. */
(()=>{'use strict';let stream=null,audioContext=null,recorder=null,active=null,hardStop=null,guard=null,writes=Promise.resolve(),index=0,bytes=0,startedAt=0,stopping=false;const urls=new Map(),cancelled=new Set();let finalized=Promise.resolve(),resolveFinalized=()=>{};
 const emit=(event,extra={})=>chrome.runtime.sendMessage({type:'MIRSAD_VIDEO_EVENT',event,...extra}).catch(()=>{});
 async function prepare(p){if(recorder?.state==='recording')throw Error('يوجد تسجيل جارٍ');if(stream)stream.getTracks().forEach(t=>t.stop());stream=await navigator.mediaDevices.getUserMedia({audio:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:p.streamId}},video:{mandatory:{chromeMediaSource:'tab',chromeMediaSourceId:p.streamId,maxWidth:1280,maxHeight:720,maxFrameRate:15}}});if(!stream.getAudioTracks().length||!stream.getVideoTracks().length){stream.getTracks().forEach(t=>t.stop());stream=null;throw Error('يلزم السماح بصورة تبويب تيمز وصوته')}
  if(audioContext)await audioContext.close();audioContext=new AudioContext();audioContext.createMediaStreamSource(stream).connect(audioContext.destination);await audioContext.resume();
  for(const t of stream.getTracks())t.addEventListener('ended',()=>{void stop('انقطع التقاط تبويب التسجيل');void emit('unprepared')},{once:true});return {ready:true};
 }
 async function start(p){if(!stream?.getTracks().every(t=>t.readyState==='live'))throw Error('هيئ تسجيل تبويب تيمز أولًا');if(active||recorder&&recorder.state!=='inactive')throw Error('يوجد مقطع آخر جارٍ');const duration=Math.min(p.durationMs,p.job.deadline-Date.now());if(duration<5000||duration>600000)throw Error('لا يتبقى فاصل آمن للتسجيل');
  const mime=['video/webm;codecs=vp9,opus','video/webm;codecs=vp8,opus','video/webm'].find(t=>MediaRecorder.isTypeSupported(t));if(!mime)throw Error('هذا المتصفح لا يدعم تسجيل فيديو WebM');
  active=p.job;finalized=new Promise(resolve=>resolveFinalized=resolve);stopping=false;index=0;bytes=0;writes=Promise.resolve();startedAt=0;
  try{await MirsadVideoStore.put({id:active.id,job:active,scope:p.scope,mime,phase:'recording',createdAt:Date.now(),localSaved:false,driveSaved:false});
  recorder=new MediaRecorder(stream,{mimeType:mime,videoBitsPerSecond:1000000,audioBitsPerSecond:96000});
  recorder.ondataavailable=e=>{if(!e.data.size)return;const n=index++;bytes+=e.data.size;writes=writes.then(()=>MirsadVideoStore.chunk(active.id,n,e.data));writes.catch(()=>{void stop('تعذر حفظ الفيديو على الجهاز')});if(bytes>200*1024*1024)void stop('تجاوز التسجيل حد مساحة المقطع')};
  recorder.onstart=()=>{startedAt=Date.now();void emit('recording',{id:active.id})};
  recorder.onerror=e=>void stop(e.error?.message||'تعذر تسجيل الفيديو');
  recorder.onstop=()=>{const job=active,durationMs=startedAt?Date.now()-startedAt:0;clearTimeout(hardStop);clearInterval(guard);void (async()=>{try{await writes;if(cancelled.has(job.id)){await MirsadVideoStore.erase(job.id);return}await MirsadVideoStore.patch(job.id,{phase:'saved',size:bytes,durationMs,error:stopping===true?'':String(stopping||'')});await emit('saved',{id:job.id,durationMs});}catch(e){await emit('failed',{id:job.id,error:e.message})}finally{if(active?.id===job.id)active=null;resolveFinalized()}})()};
  if(p.job.deadline-Date.now()<5000){active=null;throw Error('انتهى فاصل التسجيل أثناء تجهيز الحفظ')}recorder.start(1000);guard=setInterval(()=>{const id=active?.id;if(!id)return;Promise.race([chrome.runtime.sendMessage({type:'MIRSAD_VIDEO_CHECK',id}),new Promise(resolve=>setTimeout(()=>resolve({allowed:false}),2000))]).then(r=>{if(!r?.allowed)void stop('')}).catch(()=>void stop('تعذر التحقق من موعد الرصد'))},1000);hardStop=setTimeout(()=>void stop(''),Math.max(0,Math.min(duration,p.job.deadline-Date.now())));return {started:true};}catch(e){active=null;resolveFinalized();throw e}
 }
 async function stop(reason=''){if(!recorder||recorder.state==='inactive')return {stopped:true};stopping=reason||true;clearTimeout(hardStop);clearInterval(guard);recorder.stop();return {stopped:true}}
 async function makeURL(id){if(urls.has(id))return {url:urls.get(id)};const blob=await MirsadVideoStore.blob(id);if(!blob.size)throw Error('المقطع فارغ');const url=URL.createObjectURL(blob);urls.set(id,url);return {url}}
 chrome.runtime.onMessage.addListener((p,s,reply)=>{if(p?.target!=='mirsad-video-offscreen'||s.id!==chrome.runtime.id||s.tab)return;let action;
  if(p.type==='erase')action=(async()=>{if(active?.date===p.date&&(active.generation||0)<p.generation){cancelled.add(active.id);await stop('تصفير اليوم');await finalized}return {erased:true}})();
  if(p.type==='prepare')action=prepare(p);
  if(p.type==='start')action=start(p);
  if(p.type==='stop')action=stop(p.reason);
  if(p.type==='release')action=(async()=>{await stop(p.reason);if(stream)stream.getTracks().forEach(t=>t.stop());stream=null;return {ready:false}})();
  if(p.type==='status')action=Promise.resolve({ready:!!stream?.getTracks().every(t=>t.readyState==='live'),recording:recorder?.state==='recording',id:active?.id||null});
  if(p.type==='url')action=makeURL(p.id);
  if(p.type==='revoke')action=Promise.resolve().then(()=>{if(urls.has(p.id))URL.revokeObjectURL(urls.get(p.id));urls.delete(p.id);return {ok:true}});
  if(!action)return;action.then(r=>reply({ok:true,...r})).catch(e=>reply({ok:false,error:e.message}));return true;
 });
})();
