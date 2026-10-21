"""Full administration + live pages use the same real backend, with explicit experiment context."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];PORT=8795;ID='11111111-2222-4333-8444-555555555555';CONTEXT={'environment':'experiment','experimentId':ID};DATE='2026-10-20'
source=(R/'tests/server.cjs').read_text().replace('8766',str(PORT)).replace('const server=',"backend.setTime('2026-10-20T06:40:00+03:00');backend.props.MONITOR_PUBLIC_READ='true';backend.props.MONITOR_EVIDENCE_PRIVATE='true';const server=")
proc=subprocess.Popen(['node','-e',source],cwd=R/'tests',stdout=subprocess.DEVNULL)
def post(data):
 return json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})).read())
try:
 for _ in range(60):
  try:post({'action':'dates','key':'r'*40});break
  except Exception:time.sleep(.05)
 for trial,name in [(False,'المعلم الرسمي'),(True,'معلم التجربة')]:
  assert post({'action':'startDay','key':'w'*40,'date':DATE,'teachers':[name],'items':[{'teacher':name,'period':1,'url':'https://teams.microsoft.com/one'}],'roundCount':3,**(CONTEXT if trial else {})})['ok']
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=browser.new_context(viewport={'width':1440,'height':1000});ctx.add_init_script("localStorage.setItem('mirsad-monitor-reader-key','r'.repeat(40))")
  ctx.route('https://script.google.com/**',lambda r:r.fulfill(json=post(r.request.post_data_json)))
  ctx.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0])))
  page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,20,3,40,tzinfo=timezone.utc));page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html?experiment='+ID);page.wait_for_selector('#todayTable tbody tr');assert 'معلم التجربة' in page.locator('#todayTable').inner_text();assert 'المعلم الرسمي' not in page.locator('#todayTable').inner_text()
  for cycle in [1,2,3]:
   record={'scanId':'trial-'+str(cycle),'scheduledTeacher':'معلم التجربة','period':1,'cycle':cycle,'status':'absent','scannedAt':1792467300000+cycle*60000}
   assert post({'action':'record','key':'w'*40,'date':DATE,'record':record,**CONTEXT})['ok']
  page.clock.run_for(31000);page.wait_for_function("document.querySelector('#todayTable').textContent.includes('غائب')");page.locator('[data-view=reports]').click();page.wait_for_selector('.teacher-report-card');assert 'معلم التجربة' in page.locator('#teacherReportList').inner_text()
  link=post({'action':'teacherLink','key':'r'*40,**CONTEXT})['url'];live=ctx.new_page();live.clock.install(time=datetime(2026,10,20,3,40,tzinfo=timezone.utc));live.goto(link);live.wait_for_function("document.body.textContent.includes('معلم التجربة')");assert 'وضع' in live.locator('body').inner_text() or 'تجربة' in live.locator('body').inner_text();assert 'المعلم الرسمي' not in live.locator('body').inner_text()
  official=ctx.new_page();official.clock.install(time=datetime(2026,10,20,3,40,tzinfo=timezone.utc));official.goto('https://mirsad-school.onrender.com/teachers-live.html');official.wait_for_function("document.body.textContent.includes('المعلم الرسمي')");assert 'معلم التجربة' not in official.locator('body').inner_text()
  assert post({'action':'day','date':DATE,'key':'r'*40})['records']==[]
  assert not errors,errors;page.screenshot(path='/tmp/mirsad-experiment-reports.png',full_page=True);browser.close();print('PASS experiment admin table, full daily letters and LIVE; official page stays isolated')
finally:proc.terminate()
