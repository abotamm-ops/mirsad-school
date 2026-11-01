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



 page.evaluate("""()=>{const orig=chrome.runtime.sendMessage;window.choices=[];window.cancels=0;window.pending={sourceDate:'2026-10-31',nextLessons:84,previousLessons:70,previousRecords:12,previousImages:5};chrome.runtime.sendMessage=async m=>{if(m.type==='MIRSAD_SOURCE_INFO')return {ok:true,mode:'madrasati',selectedDate:'2026-10-31',state:{running:false},pending};if(m.type==='MIRSAD_SOURCE_CONFIRM_IMPORT'){choices.push(m.keepPrevious);pending=null;return {ok:true}}if(m.type==='MIRSAD_SOURCE_CANCEL_IMPORT'){cancels++;pending=null;return {ok:true}}return orig(m)}}""")
 page.wait_for_selector('#importDecision[open]');assert '12' in page.locator('#importDecisionSummary').inner_text();assert page.evaluate('choices.length')==0
 assert page.locator('#scheduleSource option').count()==1;assert page.locator('#scheduleSource option').get_attribute('value')=='madrasati'
 page.locator('#keepPreviousImport').click();page.wait_for_function('!document.querySelector("#importDecision").open');assert page.evaluate('choices')==[True]
 page.evaluate("pending={sourceDate:'2026-10-31',nextLessons:84,previousLessons:70,previousRecords:12,previousImages:5}");page.wait_for_selector('#importDecision[open]');page.locator('#discardPreviousImport').click();page.wait_for_function('!document.querySelector("#importDecision").open');assert page.evaluate('choices')==[True,False]
 page.evaluate("pending={sourceDate:'2026-10-31',nextLessons:84,previousLessons:70,previousRecords:12,previousImages:5}");page.wait_for_selector('#importDecision[open]');page.screenshot(path='/tmp/mirsad-import-choice39.png');page.locator('#cancelPendingImport').click();page.wait_for_function('!document.querySelector("#importDecision").open');assert page.evaluate('cancels')==1;assert page.evaluate('choices')==[True,False]
 assert not errors,errors
 b.close();print('PASS Madrasati-only selector; pending import never confirms itself; save, discard and cancel dispatch distinct explicit choices')
