from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':400,'height':600})
 def route(r):
  file=R/r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0]
  r.fulfill(path=str(file))
 ctx.route('https://mirsad-school.onrender.com/**',route)
 page=ctx.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.chrome={runtime:{async sendMessage(m){return {ok:true,status:{text:'الرصد جاهز'},configured:true,scheduleSettings:{manualStart:'06:30',periodDuration:45,manualGapMinutes:1,scanDelay:1,roundCount:2,roundGapMinutes:5}}}},tabs:{async query(){return []}}};''')
 page.goto('https://mirsad-school.onrender.com/teams-probe/popup.html');assert page.locator('[data-panel]:visible').count()==1;assert page.locator('[data-panel=run]').is_visible()
 page.screenshot(path='/tmp/mirsad-popup-debug.png',full_page=True)
 assert page.evaluate('document.documentElement.scrollHeight')<=600, page.evaluate('({height:document.documentElement.scrollHeight,main:document.querySelector("main").offsetHeight,css:getComputedStyle(document.body).fontFamily})')
 for tab in ['timing','drive','tools','run']:
  page.locator('[data-tab='+tab+']').click();assert page.locator('[data-panel]:visible').count()==1;assert page.locator('[data-panel='+tab+']').is_visible()
 page.screenshot(path='/tmp/mirsad-popup-062.png',full_page=True)
 page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.add_script_tag(path=str(R/'teams-probe/monitor-bridge.js'))
 page.evaluate('''()=>{window.savedMessage=null;chrome.runtime.sendMessage=(m,cb)=>{if(m.type==='MIRSAD_DASHBOARD_SCHEDULE'){window.savedMessage=m;cb({ok:true})}else cb({ok:true,scheduleSettings:{manualStart:'07:10',periodDuration:40,manualGapMinutes:2,scanDelay:3,roundCount:3,roundGapMinutes:7}})};window.postMessage({source:'mirsad-monitor-control',type:'state'},location.origin)}''')
 page.wait_for_function("document.getElementById('manualStart').value==='07:10'");page.locator('#periodDuration').fill('42');page.locator('#roundSettings button').click();page.wait_for_function("window.savedMessage?.settings.periodDuration===42")
 assert page.evaluate('window.savedMessage.settings.scanDelay')==3
 assert len(page.evaluate('Object.keys(window.savedMessage.settings)'))==6
 page.set_viewport_size({'width':1280,'height':900});page.screenshot(path='/tmp/mirsad-settings-062.png',full_page=True)
 assert not errors,errors
 b.close();print('PASS compact popup tabs and full website-to-extension settings bridge')
