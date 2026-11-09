/* Actual scan progress and next-cycle timing are shared through the writer heartbeat. */
var MirsadLiveSender=(()=>{let busy=false,pending=false,pendingForce=false,last=0,lastSignature='';async function sync(force=false){if(busy){pending=true;pendingForce=pendingForce||force;return;}busy=true;try{
 let r=(await chrome.storage.local.get('mirsadAutoRun')).mirsadAutoRun;if(r?.immediateMode||r?.calendarTrial)r=r.suspendedRun;
 const running=!!r?.running&&!r.paused&&!r.testMode&&!r.backtestMode,phase=running?(r.current?'scanning':'waiting'):r?.paused?'paused':'stopped',nextCycleAt=running&&r.waitingForCycle2?r.nextCycleAt:null;
 const device=typeof MirsadDeviceState!=='undefined'?await MirsadDeviceState.read():{sessionState:'unknown'};
 const signature=[device.sessionState,phase,r?.period,r?.cycle,r?.current?.scanId,nextCycleAt].join('|');if(!force&&lastSignature===signature&&(Date.now()-last<20000))return;
 const remoteScope=typeof MirsadAutoLinks!=='undefined'?await MirsadAutoLinks.remoteScope():null;
 const reply=await CloudMonitoring.heartbeat({autoLinksRemote:typeof MirsadAutoLinks!=='undefined'?await MirsadAutoLinks.remoteReport():null,running,phase,device,period:running?r.period:null,cycle:running?r.cycle:null,totalCycles:typeof scheduleSettings!=='undefined'?scheduleSettings.roundCount:null,nextCycleAt:nextCycleAt||null,nextCycleInMs:nextCycleAt?Math.max(0,nextCycleAt-Date.now()):null,nextCycle:nextCycleAt?r.cycle+1:null,activity:running&&r.current?{teacher:r.current.teacher,teacherId:r.current.teacherId||null,scanId:r.current.scanId}:null});
 if(!reply.heartbeatSaved)throw new Error('حدّث سكربت مرصاد لتفعيل النبض');last=Date.now();lastSignature=signature;if(typeof MirsadAutoLinks!=='undefined'&&await MirsadAutoLinks.acceptRemote(reply.autoLinksControl,remoteScope)){pending=true;pendingForce=true;}
 const day=MirsadMonitorModel.day(),key='mirsadRemoteLinksVersion',saved=(await chrome.storage.local.get(key))[key];
 if(reply.linksVersion&&(!saved||saved.date!==day||saved.version!==reply.linksVersion)&&CloudMonitoring.pullRemoteLinks){await CloudMonitoring.pullRemoteLinks();await chrome.storage.local.set({[key]:{date:day,version:reply.linksVersion}})}
 await chrome.storage.local.set({mirsadLiveHeartbeatStatus:{ok:true,at:last}});
 }catch(e){await chrome.storage.local.set({mirsadLiveHeartbeatStatus:{ok:false,at:Date.now(),error:e.message}})}finally{busy=false;if(pending){const force=pendingForce;pending=false;pendingForce=false;void sync(force)}}}
chrome.alarms.onAlarm.addListener(a=>{if(a.name==='mirsadLiveHeartbeat')void sync()});chrome.runtime.onStartup?.addListener(()=>void sync());chrome.runtime.onInstalled?.addListener(()=>void sync());return {sync};})();
