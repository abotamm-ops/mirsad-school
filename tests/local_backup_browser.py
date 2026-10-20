from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context();ctx.route('https://mirsad-local.invalid/**',lambda r:r.fulfill(body='<html></html>',content_type='text/html'))
 def init(page):
  page.goto('https://mirsad-local.invalid/')
  page.evaluate('''()=>{window.mode='offline';window.calls=[];window.chrome={runtime:{id:'a'.repeat(32),sendNativeMessage(host,message,cb){calls.push(message);if(mode==='offline'){chrome.runtime.lastError={message:'host missing'};cb();delete chrome.runtime.lastError}else cb({ok:true,paths:mode==='fallback'?['G:\\Data Copy','C:\\Data Copy']:['G:\\Data Copy','K:\\Data Copy'],fallback:mode==='fallback'})}},storage:{local:{async get(){return JSON.parse(localStorage.getItem('fixture')||'{}')},async set(v){localStorage.setItem('fixture',JSON.stringify({...await this.get(),...v}))}}},alarms:{create(){},onAlarm:{addListener(){}}}}}''')
  page.add_script_tag(path=str(R/'teams-probe/monitor-model.js'));page.add_script_tag(path=str(R/'teams-probe/local-backup.js'))
 page=ctx.new_page();init(page)
 page.evaluate('''async()=>{await LocalBackup.enqueue({scanId:'proof-1',status:'absent',scannedAt:Date.now()},'data:image/png;base64,iVBORw0KGgoBAA==','teacher.png')}''')
 page.wait_for_function("JSON.parse(localStorage.getItem('fixture')).mirsadLocalBackupStatus?.error===true")
 page.close();page=ctx.new_page();init(page);page.evaluate("window.mode='fallback';LocalBackup.flush()")
 page.wait_for_function("JSON.parse(localStorage.getItem('fixture')).mirsadLocalBackupStatus?.paths?.includes('C:\\\\Data Copy')".replace('\\\\','\\'))
 result=page.evaluate('LocalBackup.info()');assert 'C' in str(result['status']['paths']);assert page.evaluate('calls[0].image').startswith('data:image/png')
 page.evaluate("calls=[];LocalBackup.flush()");page.wait_for_timeout(100);assert page.evaluate('calls.length')==0
 page.evaluate("mode='both';LocalBackup.enqueue({scanId:'present-1',status:'present',scannedAt:Date.now()})");page.wait_for_function("calls.length===1")
 assert page.evaluate('calls[0].image') is None
 assert 'Downloads' not in str(page.evaluate('calls'))
 b.close();print('PASS persistent image/record outbox: unavailable host, restart, C fallback acknowledgement, no duplicate and no Downloads')
