from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
from datetime import datetime,timezone
import subprocess,json
R=Path(__file__).resolve().parents[1]
source="""const b=require('./tests/backend-fixture.cjs')(),date='2026-11-01';b.setDate(date);b.setTime(date+'T08:00:00+03:00');const p={source:'naqar',scheduleDate:'2026-10-11',teachers:['معلم أول','معلم ثان'],lessons:[{teacher:'معلم أول',cellIndex:2,title:'علوم',lesson:'أول أ',teams:'https://teams.microsoft.com/l/meetup-join/test'},{teacher:'معلم ثان',cellIndex:3,title:'رياضيات',lesson:'ثان أ',teams:''}]},r=b.write('publishMonitoringTimetable',{payload:p,roundCount:3,scheduleSettings:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1}});if(!r.ok)throw Error(r.error);const record={scanId:'proof',scheduledTeacher:'معلم أول',period:1,cycle:1,status:'absent',scannedAt:Date.parse(date+'T06:35:00+03:00'),scheduleRevision:r.snapshot.scheduleRevision};b.write('image',{date,record,image:'data:image/png;base64,iVBORw0KGgo='});b.write('record',{date,record});process.stdout.write(JSON.stringify(b.read('day',{date})));"""
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
 assert page.locator('#todayTable .period-time').count()==7
 assert page.locator('#todayTable .period-time').first.inner_text()=='06:30–07:15'
 assert page.locator('#todayTable .teams-lesson-link').count()==1
 assert page.locator('#todayTable .teams-lesson-link').get_attribute('href').startswith('https://teams.microsoft.com/')
 assert page.locator('#todayTable a[href*="drive.google.com"]').count()==1
 assert 'رياضيات' in page.locator('#todayTable').inner_text()
 page.reload();page.wait_for_selector('#todayTable tbody tr');assert page.locator('#todayTable a[href*="drive.google.com"]').count()==1
 assert not any(a in actions for a in ['getTimetableSource','classicStartDay','prepareCurrentTimetable'])
 page.locator('#todayTable').scroll_into_view_if_needed();page.screenshot(path='/tmp/mirsad-unified-desktop.png')
 page.set_viewport_size({'width':390,'height':844});page.screenshot(path='/tmp/mirsad-unified-mobile.png');assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 assert not errors,errors
 b.close();print('PASS legacy home redirects to official monitor; seven timed columns, Teams links, linkless lessons and proof survive reload; no source-page dependency; responsive width')
