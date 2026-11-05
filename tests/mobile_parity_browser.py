from pathlib import Path
from urllib.parse import urlsplit,quote
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
import json,subprocess
R=Path(__file__).resolve().parents[1]
source="""const b=require('./tests/backend-fixture.cjs')(),date='2026-11-05';b.setDate(date);b.setTime(date+'T09:34:00+03:00');const payload={source:'madrasati',schoolId:'A'.repeat(32),sourceUrl:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId='+'A'.repeat(32),scheduleDate:date,importedForDate:date,totalTeachers:2,totalLessons:2,teachers:['نايف عطية السلمي','معلم الحصة القادمة'],lessons:[{teacher:'نايف عطية السلمي',cellIndex:6,title:'علوم',lesson:'أول أ',time:'09:34',teams:'',linkState:'unprepared'},{teacher:'معلم الحصة القادمة',cellIndex:7,title:'رياضيات',lesson:'ثان أ',time:'10:20',teams:'',linkState:'unprepared'}]};b.write('publishMonitoringTimetable',{payload,confirmed:true,keepPrevious:false,importRequestId:'phone-fixture',roundCount:3,scheduleSettings:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1}});const d=b.read('day',{date});b.write('record',{date,record:{scanId:'phone-missing-cycle1',scheduledTeacher:'نايف عطية السلمي',period:5,cycle:1,status:'no-link',scheduleRevision:d.snapshot.scheduleRevision,scannedAt:Date.parse(date+'T09:34:00+03:00')}});process.stdout.write(JSON.stringify(b.read('day',{date})));"""
fixture=json.loads(subprocess.run(['node','-e',source],cwd=R,capture_output=True,text=True,check=True).stdout)
stamp=int(datetime(2026,11,5,6,34,tzinfo=timezone.utc).timestamp()*1000)
row=next(l for l in fixture['snapshot']['lessons'] if l['period']==5)
# Thursday seventh keeps source lesson information without attendance or missing-link warnings.
fixture['snapshot']['lessons'].append({**row,'period':7,'subject':'حصة الخميس الاختيارية','url':'https://teams.microsoft.com/meet/123456789?p=fixture'})
fixture['records'].append({'scanId':'legacy-thursday7','teacherId':row['teacherId'],'teacherName':row['teacherName'],'period':7,'cycle':1,'status':'absent','scannedAt':stamp})
fixture['serverTime']=stamp;fixture['heartbeat']={'at':stamp,'running':True,'phase':'scanning','period':5,'cycle':1,'totalCycles':3,'activity':{'active':True,'teacher':row['teacherName'],'teacherId':row['teacherId'],'scanId':'phone-active','date':'2026-11-05','period':5,'cycle':1}}
requests=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[]
 ctx.add_init_script("try{localStorage.setItem('mirsad_archive_password_v1','phone-admin')}catch{}")
 ctx.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/(urlsplit(r.request.url).path.lstrip('/') or 'index.html'))))
 def api(r):
  q=r.request.post_data_json;action=q['action']
  if action=='adminLogin':value={'ok':True,'role':'admin'}
  elif action=='dates':value={'ok':True,'dates':['2026-11-05'],'authMode':'site-password'}
  elif action=='manualLessonLink':
   requests.append(q);assert q['key']=='phone-admin' and q['period']==5 and q['teacherId']==row['teacherId'];assert q['expectedRevision']==fixture['snapshot']['scheduleRevision'];assert q['expectedUrl']==row['url'];row['url']=q['url'];value={'ok':True,'saved':True,'snapshot':fixture['snapshot']}
  elif action=='setSeventhPeriod':
   assert q['key']=='phone-admin';assert q['expectedEnabled']==fixture['snapshot'].get('seventhPeriodEnabled',False);fixture['snapshot']['seventhPeriodEnabled']=q['enabled'];value={'ok':True,'saved':True}
  elif action=='override':
   requests.append(q);fixture.setdefault('adjustments',[]).append({'id':q['requestId'],'sequence':len(requests),'type':'override','teacherId':q['teacherId'],'period':q['period'],'status':q['status'],'at':fixture['serverTime']});value={'ok':True,'saved':True}
  else:value=fixture
  r.fulfill(json=value)
 ctx.route('https://script.google.com/**',api)
 page=ctx.new_page();page.clock.install(time=datetime(2026,11,5,6,34,tzinfo=timezone.utc));page.on('pageerror',lambda e:errors.append(str(e)));page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#todayTable tbody tr')
 cell=page.locator('#todayTable tr[data-teacher-id="'+row['teacherId']+'"] td[data-period="5"]')
 assert 'غائب' in cell.inner_text()
 seventh=page.locator('#todayTable tr[data-teacher-id="'+row['teacherId']+'"] td[data-period="7"]');assert seventh.inner_text()=='';assert seventh.locator('button').count()==0;assert not seventh.evaluate("el=>el.classList.contains('missing-link-cell')")
 page.get_by_role('button',name='تفعيل الحصة السابعة',exact=True).click();page.wait_for_function("document.querySelector('#todayTable .seventh-period-toggle')?.getAttribute('aria-pressed')==='true'")
 assert 'حصة الخميس الاختيارية' in seventh.inner_text();assert seventh.locator('a.teams-lesson-link').count()==1;assert seventh.locator('button.edit-lesson').count()==1
 page.reload();page.wait_for_selector('#todayTable tbody tr');assert page.get_by_role('button',name='تعطيل الحصة السابعة',exact=True).count()==1
 page.get_by_role('button',name='تعطيل الحصة السابعة',exact=True).click();page.wait_for_function("document.querySelector('#todayTable .seventh-period-toggle')?.getAttribute('aria-pressed')==='false'");assert seventh.inner_text()==''
 assert cell.evaluate("el=>el.classList.contains('missing-link-cell')")
 assert cell.evaluate("el=>getComputedStyle(el).backgroundColor")=='rgb(219, 234, 254)'
 page.wait_for_selector('#todayTable .scanning-cell')
 assert cell.evaluate("el=>el.classList.contains('round-active-cell')")
 assert cell.evaluate("el=>getComputedStyle(el).animationName")=='roundCellPulse'
 assert 'قيد الرصد' in page.locator('#roundCountdown').inner_text()
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/mirsad-phone-live.png')
 # The server's actual next-cycle timestamp drives the countdown on a phone.
 fixture['serverTime']=stamp+5000;fixture['heartbeat']={'at':stamp+5000,'running':True,'phase':'waiting','period':5,'cycle':1,'nextCycle':2,'nextCycleAt':stamp+245000,'totalCycles':3}
 page.clock.fast_forward(5000);page.wait_for_selector('#roundCountdown[data-phase="waiting"]');assert page.locator('#roundCountdownValue').inner_text()=='00:04:00'
 assert page.locator('#todayTable .round-active-cell').count()==0
 fixture['serverTime']=stamp+65000;fixture['heartbeat']['at']=stamp+65000
 page.clock.fast_forward(60000);page.wait_for_function("document.querySelector('#roundCountdownValue').textContent==='00:03:00'")
 # Save, reopen and reload a fifth-period link without any extension installed.
 cell.locator('.round-info').click();field=page.get_by_role('textbox',name='رابط تيمز للحصة');url='https://teams.microsoft.com/l/meetup-join/naif-fifth?anon=true'
 field.fill('https://teams.microsoft.com/dl/launcher/launcher.html?url='+quote('/_#/l/meetup-join/naif-fifth?anon=true',safe=''));page.get_by_role('button',name='حفظ رابط تيمز',exact=True).click();page.wait_for_selector('#details',state='hidden')
 assert row['url']==url and 'missing-link-cell' not in (cell.get_attribute('class') or '')
 assert cell.locator('.teams-lesson-link').get_attribute('href')==url
 page.reload();page.wait_for_selector('#todayTable tbody tr');cell.locator('.round-info').click();assert field.input_value()==url
 choice=page.get_by_role('combobox',name='الحالة المعتمدة');assert choice.locator('option').count()==5;choice.select_option('partial-absence');page.get_by_role('button',name='حفظ التعديل',exact=True).click();page.wait_for_selector('#details',state='hidden');assert 'غياب جزئي' in cell.inner_text()
 assert fixture['records'][0]['status']=='no-link'
 # Statistics are fully usable on the same mobile admin session.
 page.locator('[data-view="stats"]').click();page.wait_for_selector('#statsTable tbody tr');assert page.locator('#statsTable tbody tr').count()==2
 assert 'غياب جزئي' in page.locator('#statsTable thead').inner_text()
 assert page.locator('#statsSummary .summary-card strong').last.inner_text()=='1'
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/mirsad-phone-stats.png')
 assert not errors,errors
 b.close();print('PASS phone: fifth-period link save/reopen/reload, administrative absence, manual partial, blue missing slots, remote blinking, actual 4-to-3 minute cycle countdown, persisted seventh-period activation/deactivation and statistics without extension')
