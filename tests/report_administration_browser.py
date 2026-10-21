"""Anonymous viewer + protected edits/reset against the real Apps Script fixture."""
from pathlib import Path
import json,subprocess,time,urllib.request
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];PIN='fixture-admin-pin';PORT=8788
source=(R/'tests/server.cjs').read_text().replace('8766',str(PORT)).replace('const server=',"backend.props.MONITOR_PUBLIC_READ='true';backend.props.MONITOR_ADMIN_PIN_HASH=require('node:crypto').createHash('sha256').update('fixture-admin-pin').digest('hex');const server=")
proc=subprocess.Popen(['node','-e',source],cwd=R/'tests',stdout=subprocess.DEVNULL)
def post(data):return json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})).read())
try:
 for _ in range(60):
  try:post({'action':'dates'});break
  except Exception:time.sleep(.05)
 items=[{'teacher':name,'period':period,'url':url,'subject':'عنوان درس طويل لاختبار توازن الأعمدة ووضوح القراءة','className':'أولى أ'} for name,url in [('معلم بروابط','https://teams.microsoft.com/one'),('أحمد العمري','')] for period in [1,2]]
 assert post({'key':'w'*40,'action':'startDay','date':'2026-10-20','teachers':['معلم بروابط','أحمد العمري','معلم بلا حصص'],'items':items,'roundCount':2})['ok']
 record={'scanId':'original-absent','scheduledTeacher':'معلم بروابط','period':1,'cycle':1,'status':'absent','scannedAt':1792490400000}
 assert post({'key':'w'*40,'action':'record','date':'2026-10-20','record':record})['ok']
 assert post({'key':'w'*40,'action':'image','date':'2026-10-20','record':record,'image':'data:image/png;base64,iVBORw0KGgoBAA=='})['ok']
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.clock.install(time=datetime(2026,10,20,13,tzinfo=timezone.utc))
  page.route('https://script.google.com/**',lambda r:r.fulfill(json=post(r.request.post_data_json)))
  page.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0])))
  page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#todayTable tbody tr')
  assert page.locator('#connection').is_hidden();assert page.locator('#todayTable .absent').count()==4
  assert page.locator('[data-reset-target=todayTable]').is_visible();assert page.locator('.edit-lesson').count()==4
  widths=page.locator('#todayTable tbody tr').first.locator('td').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().width)');assert max(widths)-min(widths)<1
  page.locator('[data-view=stats]').click();page.wait_for_selector('#statsTable tbody tr');page.evaluate('window.savedStatsNode=document.querySelector("#statsTable table");window.savedChartNode=document.querySelector("#chart svg")');page.clock.fast_forward(31000);assert page.evaluate('window.savedStatsNode===document.querySelector("#statsTable table")');assert page.evaluate('window.savedChartNode===document.querySelector("#chart svg")')
  page.locator('[data-view=reports]').click();page.wait_for_selector('.teacher-report-folder');page.evaluate('window.savedLetterNode=document.querySelector(".teacher-report-folder")');page.clock.fast_forward(31000);assert page.evaluate('window.savedLetterNode===document.querySelector(".teacher-report-folder")')
  page.locator('[data-view=today]').click();page.wait_for_selector('#todayTable tbody tr')
  page.screenshot(path='/tmp/mirsad-report-redesign.png',full_page=True)
  page.locator('[data-view=reports]').click();page.locator('#teacherReportDate').fill('2026-10-20');page.locator('#loadTeacherReports').click();page.wait_for_selector('.teacher-report-folder');assert page.locator('.teacher-report-folder').count()==2;assert 'معلم بلا حصص' not in page.locator('#teacherReportList').inner_text()
  for folder in page.locator('.teacher-report-folder').all():
   if folder.locator('.teacher-report-card').count():assert folder.get_attribute('open') is not None
  page.wait_for_selector('.teacher-report-card');assert page.locator('.teacher-report-card').count()==2
  assert 'غياب يوم كامل' in page.locator('.teacher-report-card').first.inner_text()
  page.locator('#teacherReportSchool').fill('متوسطة مرصاد')
  with page.expect_download() as download_info:page.locator('.teacher-report-card [data-format=word]').first.click()
  download=download_info.value;assert download.suggested_filename.endswith('.docx')
  import zipfile,xml.etree.ElementTree as ET
  with zipfile.ZipFile(download.path()) as doc:
   assert doc.testzip() is None
   for name in doc.namelist():
    if name.endswith(('.xml','.rels')):ET.fromstring(doc.read(name))
   xml=doc.read('word/document.xml').decode();assert 'متوسطة مرصاد' in doc.read('word/header2.xml').decode();assert '2026-10-20' in xml;assert 'إفادة المعلم' in xml
  page.locator('[data-view=today]').click();page.wait_for_selector('#todayTable tbody tr')
  page.locator('#todayTable .edit-lesson').first.click()
  form=page.locator('.edit-lesson-form');form.locator('select').select_option('present');form.locator('input[type=password]').fill('wrong');form.locator('button').click();page.wait_for_function("document.querySelector('.edit-lesson-form').textContent.includes('غير صحيح')")
  form.locator('input[type=password]').fill(PIN);form.locator('input[aria-label="سبب التعديل"]').fill('حضور مثبت إداريًا');form.locator('button').click();page.wait_for_selector('#details',state='hidden')
  assert page.locator('#todayTable .present').count()==1
  raw=post({'action':'day','date':'2026-10-20'});assert raw['records'][0]['status']=='absent';assert raw['records'][0]['evidenceUrl'];assert len(raw['adjustments'])==1
  page.locator('[data-view=stats]').click();page.wait_for_selector('#statsTable tbody tr');assert page.locator('#statsSummary .summary-card strong').all_text_contents()[:2]==['3','1']
  page.locator('[data-view=today]').click();page.wait_for_selector('#todayTable tbody tr')
  page.locator('#todayTable .edit-lesson').first.click();form=page.locator('.edit-lesson-form');form.locator('select').select_option('unresolved');form.locator('input[type=password]').fill(PIN);form.locator('button').click();page.wait_for_selector('#details',state='hidden')
  assert page.locator('#todayTable .unresolved').count()==1
  raw=post({'action':'day','date':'2026-10-20'});assert raw['records'][0]['status']=='absent';assert raw['records'][0]['evidenceUrl'];assert len(raw['adjustments'])==2
  page.locator('[data-view=stats]').click();page.wait_for_selector('#statsTable tbody tr')
  assert page.locator('#statsSummary .summary-card strong').all_text_contents()==['3','1','0','1','0']
  assert page.locator('#chart [data-series=unknown][data-value="1"]').count()==1
  assert page.locator('#chart [data-series=present]').count()==3
  assert 'حضور الحصص' in page.locator('#statsTable thead').inner_text();assert 'غير محسوم' in page.locator('#chart .chart-legend').inner_text()
  page.locator('[data-view=today]').click();page.wait_for_selector('#todayTable tbody tr')
  page.locator('[data-reset-target=todayTable]').click()
  page.locator('#resetPin').fill('wrong');page.locator('#resetForm button').click();page.wait_for_function("document.querySelector('#resetFeedback').textContent.includes('غير صحيح')")
  assert len(post({'action':'day','date':'2026-10-20'})['adjustments'])==2
  page.locator('#resetPin').fill(PIN);page.locator('#resetForm button').click();page.wait_for_selector('#resetDialog',state='hidden')
  assert page.locator('#todayTable .absent').count()==0;assert page.locator('#todayTable tbody tr').count()==0
  assert post({'action':'day','date':'2026-10-20'})['ok'] is False
  assert post({'action':'dates'})['dates']==[]
  assert 'نهائيًا' in page.locator('#status').inner_text()
  assert PIN not in page.evaluate('JSON.stringify(localStorage)');assert not errors,errors
  page.screenshot(path='/tmp/mirsad-report-reset.png',full_page=True)
  print('PASS anonymous reports, equal columns, protected correction, correct statistics, protected permanent day deletion (original evidence remains after individual correction), no saved PIN')
  b.close()
finally:proc.terminate()
