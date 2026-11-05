from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
import json,subprocess
R=Path(__file__).resolve().parents[1]
source="""const b=require('./tests/backend-fixture.cjs')(),date='2026-11-05';b.setDate(date);const payload={source:'madrasati',schoolId:'A'.repeat(32),sourceUrl:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId='+'A'.repeat(32),scheduleDate:date,importedForDate:date,totalTeachers:1,totalLessons:2,teachers:['معلم'],lessons:[1,2].map(p=>({teacher:'معلم',cellIndex:p+1,title:'علوم',lesson:'أول أ',time:'06:30',teams:'',linkState:'unprepared'}))};b.write('publishMonitoringTimetable',{payload,confirmed:true,keepPrevious:false,importRequestId:'browser-partial',roundCount:3,scheduleSettings:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1}});process.stdout.write(JSON.stringify(b.read('day',{date})));"""
fixture=json.loads(subprocess.run(['node','-e',source],cwd=R,capture_output=True,text=True,check=True).stdout)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);context=b.new_context(viewport={'width':1360,'height':900});errors=[];edits=[]
 context.add_init_script("try{localStorage.setItem('mirsad_archive_password_v1','fixture-admin')}catch{}")
 context.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/(urlsplit(r.request.url).path.lstrip('/') or 'index.html'))))
 def api(r):
  q=r.request.post_data_json;action=q['action']
  if action=='adminLogin':value={'ok':True,'role':'admin'}
  elif action=='dates':value={'ok':True,'dates':['2026-11-05'],'authMode':'site-password'}
  elif action=='override':
   edits.append(q);fixture.setdefault('adjustments',[]).append({'id':q['requestId'],'sequence':len(edits),'type':'override','teacherId':q['teacherId'],'period':q['period'],'status':q['status'],'note':q['note'],'at':1793849400000});value={'ok':True,'saved':True}
  else:value=fixture
  r.fulfill(json=value)
 context.route('https://script.google.com/**',api)
 page=context.new_page();page.clock.install(time=datetime(2026,11,5,3,30,tzinfo=timezone.utc));page.on('pageerror',lambda e:errors.append(str(e)));page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#todayTable tbody tr')
 assert 'غائب' in page.locator('#todayTable td[data-period="1"]').inner_text()
 assert 'غائب' not in page.locator('#todayTable td[data-period="2"] .round-info').inner_text()
 for status,label in [('partial-absence','غياب جزئي'),('partial','حضور جزئي')]:
  page.locator('#todayTable td[data-period="1"] .round-info').click();choice=page.get_by_role('combobox',name='الحالة المعتمدة')
  assert choice.locator('option').count()==5
  assert page.get_by_role('textbox',name='رابط تيمز للحصة').count()==1
  choice.select_option(status);page.get_by_role('button',name='حفظ التعديل',exact=True).click();page.wait_for_selector('#details',state='hidden')
  assert label in page.locator('#todayTable td[data-period="1"]').inner_text()
  page.locator('#todayTable td[data-period="1"] .round-info').click();assert choice.input_value()==status
  assert label+' معتمد يدويًا' in page.locator('#detailBody').inner_text()
  page.locator('#details').evaluate('(el)=>el.close()')
 assert [e['status'] for e in edits]==['partial-absence','partial']
 assert fixture['records']==[]
 page.screenshot(path='/tmp/mirsad-manual-partial.png')
 assert not errors,errors
 b.close();print('PASS no-link absence at class start, future class pending, five manual choices, both partial states save/reopen and link editor remains available')
