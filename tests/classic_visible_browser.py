from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit,parse_qs
from datetime import datetime,timezone
import subprocess,json
R=Path(__file__).resolve().parents[1]
source="""const b=require('./tests/backend-fixture.cjs')(),ref=require('./visible-schedule.js');const date='2026-11-01';b.setDate(date);b.setTime(date+'T08:00:00+03:00');b.write('startDay',{date,teachers:['معلم أول'],items:[{teacher:'معلم أول',period:7,subject:'قديم للتجربة',url:''}],roundCount:3,sourceType:'madrasati',sourceScheduleDate:'2026-10-11',sourceImportDate:date});const revision=b.read('day',{date}).snapshot.scheduleRevision;b.write('record',{date,record:{scanId:'keep-today',scheduledTeacher:'معلم أول',period:7,cycle:1,status:'present',scannedAt:Date.parse(date+'T07:00:00+03:00'),scheduleRevision:revision}});const old=b.read('day',{date}),payload={source:'naqar',updatedAt:date+'T05:00:00Z',selectedDate:'2026-10-11',teachers:['معلم أول','معلم ثان'],lessons:[{teacher:'معلم أول',cellIndex:2,title:'علوم جديدة',lesson:'أول أ',teams:''},{teacher:'معلم ثان',cellIndex:5,title:'رياضيات جديدة',lesson:'ثان أ',teams:'https://teams.microsoft.com/l/meetup-join/new'}]},reference=ref.reference(payload,date);process.stdout.write(JSON.stringify({old,current:b.read('day',{date}),payload}));"""
fixture=json.loads(subprocess.run(['node','-e',source],cwd=R,capture_output=True,text=True,check=True).stdout)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1360,'height':900});errors=[];state={'day':fixture['old'],'matches':0}
 context.add_init_script("""try{localStorage.setItem('mirsad_archive_password_v1','fixture-admin')}catch{}window.addEventListener('message',async e=>{if(e.source!==window||e.data?.source!=='mirsad-monitor-control'||e.data.type!=='classicSync')return;const r=await(await fetch('https://script.google.com/macros/s/fixture/exec',{method:'POST',headers:{'Content-Type':'text/plain'},body:JSON.stringify({action:'fixtureMatch'})})).json();window.postMessage({source:'mirsad-monitor-extension',type:'classicSync',payload:r},location.origin)});""")
 context.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/(urlsplit(r.request.url).path.lstrip('/') or 'index.html'))))
 def api(r):
  if r.request.method=='GET':
   callback=parse_qs(urlsplit(r.request.url).query).get('callback',[''])[0];r.fulfill(content_type='application/javascript',body=callback+'('+json.dumps({'ok':True,'payload':fixture['payload']})+')');return
  action=r.request.post_data_json['action']
  if action=='adminLogin':value={'ok':True,'role':'admin'}
  elif action=='getTimetableSource':value={'ok':True,'mode':'naqar','payload':None}
  elif action=='dates':value={'ok':True,'dates':['2026-11-01'],'authMode':'site-password'}
  elif action=='fixtureMatch':state['day']=fixture['current'];state['matches']+=1;value={'ok':True,'serviceUrl':'https://script.google.com/macros/s/fixture/exec'}
  else:value=state['day']
  r.fulfill(json=value)
 context.route('https://script.google.com/**',api)
 main=context.new_page();main.clock.install(time=datetime(2026,11,1,5,0,tzinfo=timezone.utc));main.on('pageerror',lambda e:errors.append(str(e)));main.goto('https://mirsad-school.onrender.com/index.html');main.wait_for_function("()=>!!localStorage.getItem('mirsad-visible-schedule-v32')");assert main.locator('#body tr').count()==2
 monitor=context.new_page();monitor.clock.install(time=datetime(2026,11,1,5,0,tzinfo=timezone.utc));monitor.on('pageerror',lambda e:errors.append(str(e)));monitor.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');monitor.wait_for_selector('#todayTable tbody tr');assert state['matches']==0;assert monitor.locator('#todayTable tbody tr').count()==1;text=monitor.locator('#todayTable').inner_text();assert 'قديم للتجربة' in text and 'علوم جديدة' not in text and 'حاضر' in text;assert monitor.locator('#lockedScheduleNotice').inner_text();monitor.reload();monitor.wait_for_selector('#todayTable tbody tr');assert 'قديم للتجربة' in monitor.locator('#todayTable').inner_text();assert state['matches']==0;assert len(context.pages)==2;assert not errors,errors;monitor.screenshot(path=str(R/'tests/classic-match.png'),full_page=True);b.close();print('PASS saved attendance remains visible across source mismatch and reload; zero adoption requests and zero extra tabs')
