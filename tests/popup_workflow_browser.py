from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
import json
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':790,'height':600});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def route(r):
  file=R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/')
  if file.is_file():r.fulfill(path=str(file))
  else:r.abort()
 page.route('**/*',route)
 page.add_init_script('''globalThis.state={};globalThis.messages=[];globalThis.run=null;globalThis.fetch=async()=>({ok:true,json:async()=>({ok:true,payload:{scheduleDate:'2026-10-31',teachers:[],lessons:Array.from({length:13},(_,i)=>({teacher:'معلم '+(i+1),cellIndex:2,teams:'https://teams.microsoft.com/l/meetup-join/'+i}))}})});globalThis.chrome={permissions:{contains:async()=>true,request:async()=>true},runtime:{id:'fixture',sendMessage:async m=>{messages.push(m);switch(m.type){case 'MIRSAD_GET_LIVE_REPORT':return {ok:true,scheduleSettings:{manualStart:'06:30',startPeriod:1,endPeriod:7,roundCount:3}};case 'MIRSAD_STATUS':return {status:{text:'جاهز لبدء الرصد وفق التوقيت المحفوظ'},run};case 'MIRSAD_SOURCE_INFO':return {ok:true,mode:'madrasati',selectedDate:'2026-10-31'};case 'MIRSAD_LOCAL_BACKUP_INFO':return {status:{text:'الحفظ المحلي متصل — C:\\Users\\School\\Documents\\MirsadSchools-Data'},pendingImages:0,capturedCount:25};case 'MIRSAD_PREVIEW_TIMETABLE':return {ok:true,...(globalThis.pendingPreview||{changed:false})};case 'MIRSAD_ADOPT_TIMETABLE':globalThis.adoptions=(globalThis.adoptions||0)+1;globalThis.pendingPreview=null;return {ok:true};case 'MIRSAD_BEGIN_DAY':globalThis.beginnings=(globalThis.beginnings||0)+1;return {ok:true};case 'MIRSAD_DRIVE_INFO':return {pendingAdoption:globalThis.pendingPreview,configured:true,status:{text:'تم حفظ النتائج على هذا الجهاز'}};case 'MIRSAD_SAVE_SCHEDULE_SETTINGS':return {ok:true,settings:m.settings};default:return {ok:true}}}},storage:{local:{get:async key=>state,set:async value=>Object.assign(state,value)}},tabs:{query:async()=>[{id:1,url:'https://mirsad-school.onrender.com/index.html'}],sendMessage:async()=>({ok:true,items:Array.from({length:13},(_,i)=>({teacher:'معلم '+(i+1),hasLesson:true,period:1,url:'https://teams.microsoft.com/l/meetup-join/'+i}))})},downloads:{download:async()=>1}}''')
 page.goto('http://popup.test/popup.html');page.wait_for_function("document.querySelector('#madrasatiSourceDate').value==='2026-10-31'")


 page.evaluate("""()=>{const original=chrome.runtime.sendMessage;window.sourceInfo={ok:true,mode:'madrasati',selectedDate:'2026-10-31'};window.driveDay=null;chrome.runtime.sendMessage=async m=>{if(m.type==='MIRSAD_SOURCE_INFO')return sourceInfo;if(m.type==='MIRSAD_SOURCE_COLLECT'){sourceInfo.state={running:true};return {ok:true}}if(m.type==='MIRSAD_BEGIN_DAY'){if(window.failDay)return {ok:false,error:'fixture failed'};return await new Promise(resolve=>window.finishDay=()=>{const d=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());window.driveDay={date:d,snapshot:{sourceType:'madrasati',sourceScheduleDate:'2026-10-31',scheduleRevision:'verified',lessons:[{period:1}]}};resolve({ok:true,day:driveDay})})}if(m.type==='MIRSAD_DRIVE_INFO')return {configured:true,ready:true,day:driveDay};if(m.type==='MIRSAD_START'){window.run={running:true};return {ok:true}}return original(m)}}""")
 def state(id):return page.locator('#'+id).get_attribute('data-step-state')
 assert [page.locator('#'+id).get_attribute('data-step') for id in ['collectMadrasati','save-time','begin-day','start']]==['1','2','3','4']
 assert state('collectMadrasati')!='done'
 page.locator('#collectMadrasati').click();page.wait_for_timeout(1700);assert state('collectMadrasati')=='busy'
 page.evaluate("""()=>{sourceInfo.state={running:false};sourceInfo.lastSuccess={date:'2026-10-31',importedForDate:new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Riyadh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date()),lessons:70,monitoringPrepared:true,activeVerified:true,updatedAt:'verified-import'}}""")
 page.wait_for_function("document.querySelector('#collectMadrasati').dataset.stepState==='done'")
 page.locator('#save-time').click();page.wait_for_function("document.querySelector('#save-time').dataset.stepState==='done'")
 page.locator('#periodDuration').fill('42');assert state('save-time')=='pending';page.locator('#save-time').click();page.wait_for_function("document.querySelector('#save-time').dataset.stepState==='done'")
 page.evaluate('window.failDay=true');page.locator('#begin-day').click();page.wait_for_function("document.querySelector('#begin-day').dataset.stepState==='error'");page.evaluate('driveInfo()');assert state('begin-day')=='error'
 page.evaluate('window.failDay=false');page.locator('#begin-day').click();page.wait_for_function('!!window.finishDay');assert state('begin-day')=='busy';page.evaluate('finishDay()');page.wait_for_function("document.querySelector('#begin-day').dataset.stepState==='done'")
 page.locator('#start').click();page.wait_for_function("document.querySelector('#start').dataset.stepState==='done'");page.evaluate('window.run={running:false,paused:true};refresh()');page.wait_for_function("document.querySelector('#start').dataset.stepState==='paused'")
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert page.evaluate('document.documentElement.scrollHeight<=600'),page.evaluate('document.documentElement.scrollHeight')
 assert not errors,errors
 page.screenshot(path='/tmp/mirsad-workflow37.png')
 b.close()
 print('PASS four numbered actions: async import/day remain orange until verified; failures red; save green then dirty orange; running green and paused orange; fits popup')
