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
  assert page.locator('.reset-report:visible').count()==0
  widths=page.locator('#todayTable tbody tr').first.locator('td').evaluate_all('(els)=>els.map(e=>e.getBoundingClientRect().width)');assert max(widths)-min(widths)<1
  page.screenshot(path='/tmp/mirsad-report-redesign.png',full_page=True)
  page.locator('#toggleAdministration').click();page.locator('#todayTable .edit-lesson').first.click()
  form=page.locator('.edit-lesson-form');form.locator('select').select_option('present');form.locator('input[type=password]').fill('wrong');form.locator('button').click();page.wait_for_function("document.querySelector('.edit-lesson-form').textContent.includes('غير صحيح')")
  form.locator('input[type=password]').fill(PIN);form.locator('input[aria-label="سبب التعديل"]').fill('حضور مثبت إداريًا');form.locator('button').click();page.wait_for_selector('#details',state='hidden')
  assert page.locator('#todayTable .present').count()==1
  raw=post({'action':'day','date':'2026-10-20'});assert raw['records'][0]['status']=='absent';assert raw['records'][0]['evidenceUrl'];assert len(raw['adjustments'])==1
  page.locator('[data-view=stats]').click();page.wait_for_selector('#statsTable tbody tr');assert page.locator('#statsSummary .summary-card strong').all_text_contents()[:2]==['3','1']
  page.locator('[data-view=today]').click();page.wait_for_selector('#todayTable tbody tr');page.locator('[data-reset-target=todayTable]').click()
  page.locator('#resetPin').fill('wrong');page.locator('#resetForm button').click();page.wait_for_function("document.querySelector('#resetFeedback').textContent.includes('غير صحيح')")
  assert len(post({'action':'day','date':'2026-10-20'})['adjustments'])==1
  page.locator('#resetPin').fill(PIN);page.locator('#resetForm button').click();page.wait_for_selector('#resetDialog',state='hidden')
  assert page.locator('#todayTable .absent').count()==0;assert page.locator('#todayTable .pending').count()==4
  assert 'لم يبدأ الرصد' in page.locator('#todayTable .pending').first.inner_text()
  page.locator('#todayTable .pending').first.click();assert page.locator('#detailBody a').count()==1;assert 'غائب' in page.locator('#detailBody').inner_text();page.locator('#closeDetails').click()
  raw=post({'action':'day','date':'2026-10-20'});assert len(raw['records'])==1;assert raw['records'][0]['evidenceUrl'];assert len(raw['adjustments'])==2
  assert PIN not in page.evaluate('JSON.stringify(localStorage)');assert not errors,errors
  page.screenshot(path='/tmp/mirsad-report-reset.png',full_page=True)
  print('PASS anonymous reports, equal columns, protected correction, correct statistics, protected reset, retained original absence/photo/audit, no saved PIN')
  b.close()
finally:proc.terminate()
