from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
from datetime import datetime,timezone
import subprocess,json
R=Path(__file__).resolve().parents[1]
source="""const b=require('./tests/backend-fixture.cjs')(),date='2026-11-01';b.setDate(date);b.setTime(date+'T08:00:00+03:00');const p={source:'madrasati',schoolId:'A'.repeat(32),sourceUrl:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId='+'A'.repeat(32),importedForDate:date,totalTeachers:2,totalLessons:2,scheduleDate:'2026-10-11',teachers:['معلم أول','معلم ثان'],lessons:[{teacher:'معلم أول',cellIndex:2,title:'علوم',time:'06:30–07:15',linkState:'linked',lesson:'أول أ',teams:'https://teams.microsoft.com/l/meetup-join/test'},{teacher:'معلم ثان',cellIndex:3,title:'رياضيات',time:'07:16–08:01',linkState:'unprepared',lesson:'ثان أ',teams:''}]},r=b.write('publishMonitoringTimetable',{payload:p,confirmed:true,keepPrevious:false,importRequestId:'browser-import-001',roundCount:3,scheduleSettings:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1}});if(!r.ok)throw Error(r.error);const record={scanId:'proof',scheduledTeacher:'معلم أول',period:1,cycle:1,status:'absent',scannedAt:Date.parse(date+'T06:35:00+03:00'),scheduleRevision:r.snapshot.scheduleRevision};b.write('image',{date,record,image:'data:image/png;base64,iVBORw0KGgo='});b.write('record',{date,record});process.stdout.write(JSON.stringify(b.read('day',{date})));"""
fixture=json.loads(subprocess.run(['node','-e',source],cwd=R,capture_output=True,text=True,check=True).stdout)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1360,'height':900});errors=[];actions=[]
 context.add_init_script("try{localStorage.setItem('mirsad_archive_password_v1','fixture-admin')}catch{}")
 context.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/(urlsplit(r.request.url).path.lstrip('/') or 'index.html'))))
 def api(r):
  action=r.request.post_data_json['action'];actions.append(action)
  if action=='adminLogin':value={'ok':True,'role':'admin'}
  elif action=='dates':value={'ok':True,'dates':['2026-11-01'],'authMode':'site-password'}
  else:value=fixture
  r.fulfill(json=value)
 context.route('https://script.google.com/**',api)
 page=context.new_page();page.clock.install(time=datetime(2026,11,1,5,0,tzinfo=timezone.utc));page.on('pageerror',lambda e:errors.append(str(e)));page.goto('https://mirsad-school.onrender.com/index.html');page.wait_for_selector('#todayTable tbody tr');assert page.url.endswith('/automatic-monitoring.html');assert page.locator('#todayTable tbody tr').count()==2
 assert page.locator('.add-lesson-link').count()==0
 page.evaluate("window.addEventListener('message',e=>{if(e.data?.source==='mirsad-monitor-control'&&e.data.type==='manualLink')window.manualRequest=e.data.payload})")
 page.locator('#todayTable tbody tr').nth(1).locator('td[data-period="2"] .round-info').click()
 field=page.get_by_role('textbox',name='رابط تيمز للحصة');field.fill('https://evil.example/meet/x');assert 'غير صالح' in page.locator('#detailBody').inner_text()
 page.get_by_role('button',name='حفظ رابط تيمز',exact=True).click()
 page.wait_for_function("document.querySelector('#detailBody').textContent.includes('ألصق رابط حضور')")
 assert not page.evaluate('!!window.manualRequest')
 url='https://teams.microsoft.com/l/meetup-join/manual-fixture'
 from urllib.parse import quote
 field.fill('https://teams.microsoft.com/dl/launcher/launcher.html?url='+quote('/_#/l/meetup-join/manual-fixture',safe=''));assert 'صيغة الرابط صحيحة' in page.locator('#detailBody').inner_text();page.get_by_role('button',name='حفظ رابط تيمز',exact=True).click()
 page.wait_for_function('!!window.manualRequest')
 request=page.evaluate('window.manualRequest');row=fixture['snapshot']['lessons'][1]
 assert request['date']=='2026-11-01' and request['teacherId']==row['teacherId'] and request['period']==2
 assert request['expectedUrl']==''
 assert request['expectedRevision']==fixture['snapshot']['scheduleRevision']
 # Correlation prevents an unrelated/stale response from closing the editor.
 page.evaluate("window.postMessage({source:'mirsad-monitor-extension',type:'manualLink',payload:{ok:true,saved:true,requestId:'wrong'}},location.origin)")
 assert page.locator('#details').is_visible()
 fixture['snapshot']['lessons'][1]['url']=url
 page.evaluate("r=>window.postMessage({source:'mirsad-monitor-extension',type:'manualLink',payload:{ok:true,saved:true,requestId:r.requestId}},location.origin)",request)
 page.wait_for_function("!document.querySelector('#details').open")
 assert page.locator('#todayTable a.teams-lesson-link').count()==2
 assert page.locator('#todayTable a.teams-lesson-link').nth(1).get_attribute('href')==url
 page.locator('#todayTable tbody tr').nth(1).locator('td[data-period="2"] .lesson-state').click()
 assert page.get_by_role('textbox',name='رابط تيمز للحصة').input_value()==url
 assert page.get_by_role('textbox',name='رابط تيمز للحصة').get_attribute('readonly') is None
 assert page.get_by_role('button',name='حفظ رابط تيمز',exact=True).count()==1
 page.evaluate('window.manualRequest=null')
 corrected='https://teams.microsoft.com/meet/corrected-fixture'
 page.get_by_role('textbox',name='رابط تيمز للحصة').fill(corrected)
 page.get_by_role('button',name='حفظ رابط تيمز',exact=True).click()
 page.wait_for_function('!!window.manualRequest');edit=page.evaluate('window.manualRequest')
 assert edit['expectedUrl']==url and edit['url']==corrected
 fixture['snapshot']['lessons'][1]['url']=corrected
 page.evaluate("r=>window.postMessage({source:'mirsad-monitor-extension',type:'manualLink',payload:{ok:true,saved:true,requestId:r.requestId}},location.origin)",edit)
 page.wait_for_function("!document.querySelector('#details').open")
 assert page.locator('#todayTable a.teams-lesson-link').nth(1).get_attribute('href')==corrected
 page.locator('#todayTable tbody tr').nth(1).locator('td[data-period="2"] .lesson-state').click()
 page.evaluate('window.manualRequest=null')
 page.get_by_role('textbox',name='رابط تيمز للحصة').fill('')
 page.get_by_role('button',name='حفظ رابط تيمز',exact=True).click()
 page.wait_for_function('!!window.manualRequest');clear=page.evaluate('window.manualRequest')
 assert clear['url']=='' and clear['expectedUrl']==corrected
 fixture['snapshot']['lessons'][1]['url']=''
 fixture['snapshot']['lessons'][1]['attendanceUrl']=corrected
 page.evaluate("r=>window.postMessage({source:'mirsad-monitor-extension',type:'manualLink',payload:{ok:true,saved:true,requestId:r.requestId}},location.origin)",clear)
 page.wait_for_function("!document.querySelector('#details').open")
 assert page.locator('#todayTable a.teams-lesson-link').count()==1
 page.locator('#todayTable tbody tr').nth(1).locator('td[data-period="2"] .round-info').click()
 assert page.get_by_role('textbox',name='رابط تيمز للحصة').input_value()==''
 assert not errors,errors
 b.close();print('PASS manual link editor validation, exact date/teacher/period/revision request, correlated confirmation and persisted table refresh without browser errors')
