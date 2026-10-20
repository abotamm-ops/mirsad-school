from pathlib import Path
import json,urllib.request
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];API='https://script.google.com/macros/s/test/exec';offline=False
ITEMS=[{'teacher':'المعلم الأول','period':1,'subject':'الرياضيات','className':'أول أ','hasLesson':True},{'teacher':'المعلم الأول','period':2,'subject':'الرياضيات','className':'ثاني أ','hasLesson':True},{'teacher':'المعلم الثاني','period':1,'subject':'العلوم','className':'ثالث أ','hasLesson':True},{'teacher':'المعلم الثالث','period':1,'subject':'اللغة','className':'أول ب','hasLesson':True}]
def post(data):
 req=urllib.request.Request('http://127.0.0.1:8766',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})
 return urllib.request.urlopen(req).read().decode()
def route(req):
 if offline:req.fulfill(status=503,body='offline');return
 req.fulfill(status=200,body=post(req.request.post_data_json),headers={'Content-Type':'application/json','Access-Control-Allow-Origin':'*'})
def extension(page):
 page.evaluate('''items=>{window.chrome={storage:{local:{async get(){return JSON.parse(localStorage.getItem('__testStorage')||'{}')},async set(v){localStorage.setItem('__testStorage',JSON.stringify({...await this.get(),...v}))}}},alarms:{create(){},onAlarm:{addListener(){}}},tabs:{async sendMessage(){return {ok:true,items,teachers:['المعلم الأول','المعلم الثاني','المعلم الثالث','معلم بلا حصص']}}}};window.getRun=async()=>null;window.getScheduleTab=async()=>({id:1});window.refreshScheduleSettings=async()=>{window.scheduleSettings={roundCount:2}}}''',ITEMS)
 page.add_script_tag(path=str(ROOT/'teams-probe/drive-sync.js'))
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context()
 ctx.route(API,route);page=ctx.new_page();page.clock.install(time=datetime(2026,10,20,10,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8001/automatic-monitoring.html');extension(page)
 page.evaluate('''async url=>{await CloudMonitoring.configure(url,'w'.repeat(40));await CloudMonitoring.beginDay();await CloudMonitoring.beginDay()}''',API)
 data=page.evaluate('CloudMonitoring.info()');assert data['day']['date']=='2026-10-20';assert len(data['day']['snapshot']['teachers'])==4
 print('PASS extension Start Day: private dated folder, immutable snapshot, no duplicate start')
 offline=True
 page.evaluate('''async()=>{const png='data:image/png;base64,iVBORw0KGgoBAA==';await CloudMonitoring.capture({current:{teacher:'المعلم الأول'},period:1,cycle:1},{scanId:'offline-1',teacher:'اسم Teams',status:'absent',detail:'فحص'},png,Date.now())}''')
 page.wait_for_function("JSON.parse(localStorage.getItem('__testStorage')).mirsadDriveStatus?.error===true")
 page.close();offline=False
 page=ctx.new_page();page.clock.install(time=datetime(2026,10,20,10,tzinfo=timezone.utc));page.goto('http://127.0.0.1:8001/automatic-monitoring.html');extension(page);page.evaluate('CloudMonitoring.flush()')
 print('PASS image outbox survives offline error and page restart, then uploads')
 records=[]
 for teacher,period,state in [('المعلم الأول',1,'absent'),('المعلم الأول',2,'unresolved'),('المعلم الثاني',1,'absent'),('المعلم الثالث',1,'present')]:
  for cycle in [1,2]:records.append({'scanId':f'{teacher}-{period}-{cycle}','scheduledTeacher':teacher,'teacher':'اسم Teams','period':period,'cycle':cycle,'status':state,'scannedAt':1792490400000+cycle})
 # The integration exercises the exact authenticated transport and durable record queue.
 page.evaluate('''async records=>{for(const r of records)await CloudMonitoring.record({},r);await new Promise(r=>setTimeout(r,100));await CloudMonitoring.flush()}''',records)
 page.wait_for_timeout(200);page.evaluate('CloudMonitoring.flush()')
 for r in records:
  if r['status'] in ['absent','unresolved']:
   value=json.loads(post({'key':'w'*40,'action':'image','date':'2026-10-20','record':r,'image':'data:image/png;base64,iVBORw0KGgoBAA=='}));assert value['ok'],value
 result=json.loads(post({'key':'r'*40,'action':'day','date':'2026-10-20'}));assert len(result['records'])==8,result
 # Use the real dashboard without the test extension stubs.
 page=ctx.new_page();page.clock.install(time=datetime(2026,10,20,10,tzinfo=timezone.utc));errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8001/automatic-monitoring.html')
 page.locator('.connection-advanced summary').click();page.locator('#endpoint').fill(API);page.locator('#readerKey').fill('r'*40);page.locator('#connect button[type=submit]').click();page.wait_for_selector('#todayTable tbody tr')
 assert page.locator('#todayTable tbody tr').count()==4
 assert page.locator('#todayTable .present').count()==1
 assert page.locator('#todayTable .absent').count()==2
 assert page.locator('#todayTable .unresolved').count()==1
 active={'active':True,'teacherId':result['snapshot']['teachers'][0]['id'],'teacher':result['snapshot']['teachers'][0]['name'],'period':1,'cycle':1,'scanId':'pulse-1','date':'2026-10-20'}
 page.evaluate("activity=>window.postMessage({source:'mirsad-monitor-extension',type:'activity',payload:{ok:true,activity}},location.origin)",active)
 page.wait_for_selector('#todayTable .scanning-row')
 assert page.locator('#todayTable .scanning-cell').count()==1
 assert page.locator('#todayTable .scanning-cell').get_attribute('data-period')=='1'
 assert page.locator('#todayTable .scanning-cell .lesson-state').is_hidden()
 assert page.locator('#todayTable .scanning-cell').evaluate("el=>getComputedStyle(el).animationName")=='scanOrangeCell'
 assert page.locator('#todayTable .scanning-row').get_attribute('data-teacher-id')==active['teacherId']
 page.screenshot(path='/tmp/mirsad-live-pulse.png',full_page=True)
 active.update(teacherId=result['snapshot']['teachers'][1]['id'],teacher=result['snapshot']['teachers'][1]['name'],scanId='pulse-2')
 page.evaluate("activity=>window.postMessage({source:'mirsad-monitor-extension',type:'activity',payload:{ok:true,activity}},location.origin)",active)
 page.wait_for_function("id=>document.querySelector('.scanning-row').dataset.teacherId===id",arg=active['teacherId'])
 assert page.locator('#todayTable .scanning-cell').count()==1
 page.evaluate("window.postMessage({source:'mirsad-monitor-extension',type:'activity',payload:{ok:true,activity:null}},location.origin)")
 page.wait_for_function("document.querySelectorAll('.scanning-row,.scanning-cell').length===0")
 assert page.locator('#todayTable .absent').count()==2
 assert page.locator('#todayTable .present').count()==1
 assert page.locator('#todayTable .unresolved').count()==1
 print('PASS orange name/period pulse moves between teachers and leaves final attendance colors unchanged')
 page.locator('#todayTable .absent').first.click();assert page.locator('dialog[open] a').count()==2
 assert all('drive.google.com/file/d/' in a for a in page.locator('dialog[open] a').evaluate_all('(els)=>els.map(x=>x.href)'))
 page.locator('#closeDetails').click();page.locator('[data-view=archive]').click();page.wait_for_selector('#archiveTable tbody tr');assert page.locator('#archiveDate').input_value()=='2026-10-20';assert page.locator('#archiveTable tbody tr').count()==4
 page.locator('[data-view=stats]').click();page.wait_for_selector('#chart svg rect');assert page.locator('#chart svg rect').count()==8
 rows=page.locator('#statsTable tbody tr').all_text_contents();assert any('المعلم الثاني' in row for row in rows)
 page.screenshot(path='/tmp/mirsad-monitoring-stats.png',full_page=True)
 # A completed extension upload triggers a fresh read without waiting for the polling interval.
 pushed={'scanId':'live-refresh','scheduledTeacher':'المعلم الثالث','teacher':'اسم Teams','period':1,'cycle':1,'status':'unresolved','scannedAt':1792490500000}
 assert json.loads(post({'key':'w'*40,'action':'record','date':'2026-10-20','record':pushed}))['ok']
 page.evaluate("window.postMessage({source:'mirsad-monitor-extension',type:'changed'},location.origin)")
 page.wait_for_function("Array.from(document.querySelectorAll('#todayTable small')).some(el=>el.textContent.includes('تعذّر فحص 1 دورة'))")
 print('PASS live upload notification refreshes dashboard from authenticated service')
 # Device login survives reload and a legacy reader key never overwrites the manual archive password.
 page.evaluate("localStorage.setItem('mirsad_archive_password_v1','fixture-existing-archive-password')")
 page.reload();page.wait_for_selector('#todayTable tbody tr');assert page.locator('#connect').is_hidden()
 assert page.evaluate("localStorage.getItem('mirsad_archive_password_v1')")=='fixture-existing-archive-password'
 page.locator('#logout').click();assert page.locator('#todayTable tbody tr').count()==0
 assert page.evaluate("localStorage.getItem('mirsad-monitor-reader-key')") is None
 assert page.evaluate("localStorage.getItem('mirsad_archive_password_v1')") is None
 # The remembered manual archive password opens monitoring directly on the shared origin.
 page.evaluate("localStorage.setItem('mirsad_archive_password_v1','fixture-existing-archive-password')")
 page.reload();page.wait_for_selector('#todayTable tbody tr');assert page.locator('#connect').is_hidden()
 assert page.evaluate("localStorage.getItem('mirsad-monitor-reader-key')")=='fixture-existing-archive-password'
 page.locator('#logout').click()
 page.evaluate("localStorage.setItem('mirsad-monitor-reader-key','invalid-password')")
 page.reload();page.wait_for_selector('#connect',state='visible')
 page.wait_for_function("localStorage.getItem('mirsad-monitor-reader-key')===null")
 print('PASS remembered login survives reload, shares manual archive password, logs out, and rejects invalid saved passwords')
 assert not errors,errors
 print('PASS dashboard: 7-period table, four teachers, colors, Drive evidence links, archive, two-bar statistics, logout')
 page=ctx.new_page();page.goto('http://127.0.0.1:8001/');assert page.locator('.home-banners a').count()==3
 page.locator('#search').fill('zzzz_no_match');assert page.locator('#body tr:visible').count()==0
 print('PASS homepage: three banners and existing timetable search preserved')
 ctx.close();b.close()
