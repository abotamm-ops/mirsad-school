from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
from datetime import datetime,timezone
import subprocess,json,zipfile
R=Path(__file__).resolve().parents[1]
source="""const b=require('./tests/backend-fixture.cjs')(),date='2026-11-01';b.setDate(date);b.setTime(date+'T08:00:00+03:00');const p={source:'madrasati',schoolId:'A'.repeat(32),sourceUrl:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId='+'A'.repeat(32),importedForDate:date,totalTeachers:2,totalLessons:2,scheduleDate:'2026-10-11',teachers:['معلم أول','معلم ثان'],lessons:[{teacher:'معلم أول',cellIndex:2,title:'علوم',time:'06:30–07:15',linkState:'linked',lesson:'أول أ',teams:'https://teams.microsoft.com/l/meetup-join/test'},{teacher:'معلم ثان',cellIndex:3,title:'رياضيات',time:'07:16–08:01',linkState:'unprepared',lesson:'ثان أ',teams:''}]},r=b.write('publishMonitoringTimetable',{payload:p,confirmed:true,keepPrevious:false,importRequestId:'browser-import-001',roundCount:3,scheduleSettings:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1}});if(!r.ok)throw Error(r.error);const record={scanId:'proof',scheduledTeacher:'معلم أول',period:1,cycle:1,status:'absent',scannedAt:Date.parse(date+'T06:35:00+03:00'),scheduleRevision:r.snapshot.scheduleRevision};b.write('image',{date,record,image:'data:image/png;base64,iVBORw0KGgo='});b.write('record',{date,record});process.stdout.write(JSON.stringify(b.read('day',{date})));"""
fixture=json.loads(subprocess.run(['node','-e',source],cwd=R,capture_output=True,text=True,check=True).stdout)
second=fixture['snapshot']['teachers'][1];fixture['records'].append({'scanId':'second','teacherId':second['id'],'teacherName':second['name'],'period':2,'cycle':1,'status':'absent','scannedAt':1793507100000})
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
 page=context.new_page();page.clock.install(time=datetime(2026,11,1,4,30,tzinfo=timezone.utc));page.on('pageerror',lambda e:errors.append(str(e)));page.goto('https://mirsad-school.onrender.com/index.html');page.wait_for_selector('#todayTable tbody tr');assert page.url.endswith('/automatic-monitoring.html');assert page.locator('#todayTable tbody tr').count()==2
 page.locator('[data-view="reports"]').click();page.wait_for_function("document.querySelectorAll('#teacherReportList .teacher-report-card').length===2")
 deleted=page.locator('#teacherReportList details summary strong').first.inner_text();messages=[]
 def confirm(d):messages.append(d.message);d.accept()
 page.once('dialog',confirm);page.locator('#teacherReportList .delete-letter').first.click();page.wait_for_function("document.querySelectorAll('#teacherReportList .teacher-report-card').length===1");assert '2026-11-01' in messages[-1]
 page.reload();page.wait_for_selector('#todayTable tbody tr');page.locator('[data-view="reports"]').click();page.wait_for_function("document.querySelectorAll('#teacherReportList .teacher-report-card').length===1")
 with page.expect_download() as info:page.locator('#downloadDailyReportsWord').click()
 with zipfile.ZipFile(info.value.path()) as z:assert len(z.namelist())==1 and all(deleted not in n for n in z.namelist())
 page.once('dialog',confirm);page.locator('#deleteAllLetters').click();page.wait_for_function("document.querySelectorAll('#teacherReportList .teacher-report-card').length===0");assert page.locator('#downloadDailyReportsWord').is_disabled();assert page.locator('#restoreLetters').is_visible()
 page.reload();page.wait_for_selector('#todayTable tbody tr');page.locator('[data-view="reports"]').click();page.wait_for_function("!document.querySelector('#restoreLetters').hidden");assert page.locator('#teacherReportList .teacher-report-card').count()==0
 page.locator('#restoreLetters').click();page.wait_for_function("document.querySelectorAll('#teacherReportList .teacher-report-card').length===2")
 assert len(fixture['records'])==2;assert not any(x in actions for x in ['override','purgeDay','purgeRange','resetReport']);assert not errors,errors
 b.close();print('PASS delete one/all with explicit confirmations, persist on reload, exclude deleted letters from ZIP, restore, and issue no attendance/image deletion calls')
