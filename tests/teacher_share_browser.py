"""Sharing is independent of administration login, with a reliable user-gesture retry."""
from pathlib import Path
import json,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];PORT=8796
source=(R/'tests/server.cjs').read_text().replace('8766',str(PORT)).replace('const server=',"backend.props.MONITOR_PUBLIC_READ='true';backend.props.MONITOR_EVIDENCE_PRIVATE='true';const server=")
proc=subprocess.Popen(['node','-e',source],cwd=R/'tests',stdout=subprocess.DEVNULL)
def post(data):return json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})).read())
try:
 for _ in range(60):
  try:post({'action':'teachersLive','audience':'teachers'});break
  except Exception:time.sleep(.05)
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context();requests=[]
  ctx.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0])))
  def api(r):
   data=r.request.post_data_json;requests.append(data);r.fulfill(json=post(data))
  ctx.route('https://script.google.com/**',api);page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#copyTeachersLiveLink')
  page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('gesture required')}}});document.execCommand=()=>false")
  page.locator('#copyTeachersLiveLink').click();page.wait_for_function("document.querySelector('#teacherShareUrl').value.endsWith('/teachers-live.html')")
  assert page.locator('#teacherShareDialog').is_visible();assert page.locator('#teacherShareUrl').input_value()=='https://mirsad-school.onrender.com/teachers-live.html';assert page.locator('#copyTeacherShareUrl').is_enabled();assert 'Ctrl+C' in page.locator('#teacherShareFeedback').inner_text()
  page.evaluate("Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>window.copied=value}})")
  page.locator('#copyTeacherShareUrl').click();page.wait_for_selector('#teacherShareDialog',state='hidden');assert page.evaluate('copied')=='https://mirsad-school.onrender.com/teachers-live.html';assert 'نُسخ' in page.locator('#teacherLinkFeedback').inner_text()
  assert not any(x['action']=='teacherLink' for x in requests);assert not page.evaluate("localStorage.getItem('mirsad-monitor-reader-key')");assert not errors,errors
  # A restricted feed must never be replaced with a guessed public link.
  restricted=ctx.new_page();restricted.route('https://script.google.com/**',lambda r:r.fulfill(json={'ok':False,'error':'رابط المشاهدة غير مصرح'}));restricted.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');restricted.locator('#copyTeachersLiveLink').click();restricted.wait_for_function("document.querySelector('#teacherShareFeedback').textContent.includes('مقيّد')");assert restricted.locator('#teacherShareUrl').input_value()=='';assert restricted.locator('#copyTeacherShareUrl').is_disabled()
  b.close();print('PASS logged-out public link copy, clipboard-denied dialog/retry, no administration credential needed, restricted feed fails closed')
finally:proc.terminate()
