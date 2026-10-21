"""Show each real round immediately; keep statistics/letters governed by completed rounds."""
from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];PORT=8797;DATE='2026-10-20';ID='11111111-2222-4333-8444-555555555555'
source=(R/'tests/server.cjs').read_text().replace('8766',str(PORT)).replace('const server=',"backend.setTime('2026-10-20T06:40:00+03:00');const server=")
proc=subprocess.Popen(['node','-e',source],cwd=R/'tests',stdout=subprocess.DEVNULL)
def post(data):return json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})).read())
try:
 for _ in range(60):
  try:post({'action':'dates','key':'r'*40});break
  except Exception:time.sleep(.05)
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1440,'height':1000});ctx.add_init_script("localStorage.setItem('mirsad-monitor-reader-key','r'.repeat(40))")
  ctx.route('https://script.google.com/**',lambda r:r.fulfill(json=post(r.request.post_data_json)))
  ctx.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0])))
  for trial in [False,True]:
   extra={'environment':'experiment','experimentId':ID} if trial else {}
   assert post({'action':'startDay','key':'w'*40,'date':DATE,'roundCount':3,'teachers':['معلم الاختبار'],'items':[{'teacher':'معلم الاختبار','period':1,'url':'https://teams.microsoft.com/one'}],**extra})['ok']
   page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,20,3,40,tzinfo=timezone.utc));page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html'+('?experiment='+ID if trial else ''));page.wait_for_selector('#todayTable tbody tr')
   cell=page.locator('#todayTable tbody tr').first.locator('td').first
   first={'scanId':'cycle-1','scheduledTeacher':'معلم الاختبار','period':1,'cycle':1,'status':'absent','scannedAt':int(datetime(2026,10,20,3,35,tzinfo=timezone.utc).timestamp()*1000)}
   assert post({'action':'image','key':'w'*40,'date':DATE,'record':first,'image':'data:image/png;base64,iVBORw0KGgoBAA==',**extra})['ok']
   page.clock.run_for(31000);page.wait_for_selector('#todayTable td[data-provisional=true] .lesson-state.absent');assert cell.locator('.lesson-state').inner_text()=='غائب';assert '(1/3)' in cell.locator('.provisional-note').inner_text();assert cell.locator('a').count()==1
   assert page.locator('#todaySummary .summary-card strong').nth(1).inner_text()=='0'
   cell.locator('.round-info').click();assert 'بانتظار اكتمال الدورات' in page.locator('#detailBody').inner_text();page.locator('#closeDetails').click()
   for cycle in [2,3]:
    assert post({'action':'record','key':'w'*40,'date':DATE,'record':{**first,'scanId':'cycle-'+str(cycle),'cycle':cycle,'status':'present','scannedAt':first['scannedAt']+cycle*60000},**extra})['ok']
    page.clock.run_for(31000)
    if cycle==2:
     page.wait_for_selector('#todayTable td[data-provisional=true] .lesson-state.present');assert cell.locator('.lesson-state').inner_text()=='حاضر';assert '(2/3)' in cell.locator('.provisional-note').inner_text()
    else:
     page.wait_for_selector('#todayTable td[data-provisional=false] .lesson-state.partial');assert cell.locator('.lesson-state').inner_text()=='حضور جزئي';assert cell.locator('.provisional-note').count()==0
   assert cell.locator('a').count()==1;assert not errors,errors;page.close()
  b.close();print('PASS official and experiment show absence from first photo, presence from second result, final partial after third; provisional result does not inflate absence statistics')
finally:proc.terminate()
