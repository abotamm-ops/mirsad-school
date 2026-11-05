(function(root){'use strict';
 function state(data,now=Date.now()){
  const h=data?.heartbeat;if(!h?.running)return {kind:'inactive'};
  const fresh=Number.isFinite(h.at)&&now-h.at<=75000&&h.at<=now+10000,device=h.device;
  if(!fresh||!device||!Number.isFinite(device.at)||now-device.at>75000||device.at>now+10000)return {kind:'unknown'};
  return {kind:device.sessionState==='locked'?'locked':['active','idle'].includes(device.sessionState)?'unlocked':'unknown'};
 }
 root.MirsadScreenLockAlert={state};if(typeof module!=='undefined')module.exports={state};
 if(typeof document==='undefined')return;
 const box=document.createElement('section');box.className='screen-lock-monitor';box.setAttribute('aria-label','حالة قفل جهاز الرصد');
 const message=document.createElement('strong');message.textContent='حالة قفل جهاز الرصد: بانتظار الاتصال';message.setAttribute('role','status');
 const enable=document.createElement('button');enable.type='button';enable.textContent='تفعيل صوت تحذير القفل';
 const mute=document.createElement('button');mute.type='button';mute.textContent='كتم التحذير دقيقة';mute.hidden=true;
 box.append(message,enable,mute);(document.querySelector('main')||document.body).prepend(box);
 let data=null,offset=0,disconnected=false,current='inactive',audio=null,soundEnabled=false,mutedUntil=0,lastAlarm=0,nodes=[];
 function stopSound(){for(const n of nodes)try{n.stop()}catch{}nodes=[]}
 function sound(){if(!soundEnabled||!audio||audio.state!=='running'||Date.now()<mutedUntil)return;stopSound();const start=audio.currentTime;for(let i=0;i<4;i++){const oscillator=audio.createOscillator(),volume=audio.createGain();oscillator.type='sine';oscillator.frequency.value=i%2?660:990;volume.gain.setValueAtTime(0,start+i*.3);volume.gain.linearRampToValueAtTime(.35,start+i*.3+.02);volume.gain.setValueAtTime(.35,start+i*.3+.18);volume.gain.linearRampToValueAtTime(0,start+i*.3+.24);oscillator.connect(volume);volume.connect(audio.destination);oscillator.start(start+i*.3);oscillator.stop(start+i*.3+.25);nodes.push(oscillator)}lastAlarm=Date.now()}
 function render(){const result=disconnected&&data?.heartbeat?.running?{kind:'unknown'}:state(data,Date.now()+offset),kind=result.kind;box.dataset.state=kind;
  message.textContent=kind==='locked'?'تنبيه عاجل: جلسة ويندوز على جهاز الرصد مقفلة — افتح القفل؛ تصوير إثبات الغياب قد يتعطل.':kind==='unknown'?'تعذر التأكد من حالة قفل جهاز الرصد — تحقق من اتصال الإضافة وتحديثها.':kind==='unlocked'?'جهاز الرصد غير مقفل وفق آخر تحديث':'تنبيه قفل جهاز الرصد — الرصد متوقف أو لم يصل تحديث بعد';
  message.setAttribute('role',kind==='locked'?'alert':'status');mute.hidden=kind!=='locked';
  if(kind==='locked'&&(current!=='locked'||Date.now()-lastAlarm>=10000))sound();else if(kind!=='locked')stopSound();
  current=kind;enable.textContent=soundEnabled&&audio?.state==='running'?'صوت تحذير القفل مفعّل':'تفعيل صوت تحذير القفل';
 }
 enable.onclick=async()=>{try{const Audio=root.AudioContext||root.webkitAudioContext;if(!Audio)throw new Error('unsupported');audio=audio||new Audio();await audio.resume();soundEnabled=audio.state==='running';if(soundEnabled){lastAlarm=0;sound()}render()}catch{soundEnabled=false;enable.textContent='تعذر تشغيل الصوت — تحقق من إعدادات المتصفح'}};
 mute.onclick=()=>{mutedUntil=Date.now()+60000;stopSound();mute.textContent='الصوت مكتوم لمدة دقيقة';setTimeout(()=>{mute.textContent='كتم التحذير دقيقة';render()},60000)};
 root.addEventListener('mirsad-remote-day',event=>{data=event.detail;offset=Number.isFinite(data?.serverTime)?data.serverTime-Date.now():0;disconnected=false;render()});
 root.addEventListener('mirsad-remote-disconnected',()=>{disconnected=true;render()});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)render()});setInterval(render,1000);
})(globalThis);
