from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
import re
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 html=re.sub(r'<script\b[^>]*>.*?</script>','',(R/'teams-probe/popup.html').read_text(),flags=re.S)
 page.route('**/*',lambda r:r.fulfill(body=html,content_type='text/html') if urlsplit(r.request.url).path=='/popup.html' else r.fulfill(path=str(R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/'))) if (R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/')).is_file() else r.abort())
 page.add_init_script('''window.state={};window.calls=[];window.info={ok:true,mode:'madrasati',selectedDate:'2026-11-04',state:{running:false},lastSuccess:{revision:'rev',updatedAt:1,date:'2026-11-04',activeVerified:true,missingLinks:[{teacher:'معلم تجريبي',period:1}],deepChecked:false}};window.chrome={storage:{local:{get:async k=>({[k]:state[k]}),set:async s=>Object.assign(state,s)}},runtime:{sendMessage:async m=>{calls.push(m);return m.type==='MIRSAD_SOURCE_INFO'?info:{ok:true,started:true}}}}''')
 page.goto('http://popup.test/popup.html');page.add_script_tag(path=str(R/'teams-probe/madrasati-ui.js'));page.wait_for_selector('#deepLinksPrompt[open]');assert 'وجدت حصصًا بدون روابط' in page.locator('#deepLinksPrompt').inner_text();assert page.locator('#deepLinksSummary').inner_text().endswith('معلم تجريبي (الحصة 1)')
 page.locator('#deepLinksLater').click();page.wait_for_function("!document.querySelector('#deepLinksPrompt').open");page.wait_for_timeout(1700);assert not page.locator('#deepLinksPrompt').is_visible();assert not page.evaluate("calls.some(c=>c.type==='MIRSAD_SOURCE_DEEP_SEARCH')")
 page.evaluate('info.lastSuccess.updatedAt=2');page.wait_for_selector('#deepLinksPrompt[open]');page.locator('#deepLinksAccept').click();page.wait_for_function("calls.some(c=>c.type==='MIRSAD_SOURCE_DEEP_SEARCH')");assert not page.locator('#deepLinksPrompt').is_visible()
 page.evaluate('info.lastSuccess.updatedAt=3;info.lastSuccess.deepChecked=true');page.wait_for_timeout(1700);assert not page.locator('#deepLinksPrompt').is_visible();assert not errors,errors
 b.close();print('PASS optional deep-search prompt, exact missing teacher/period, later without writes, explicit acceptance and no repeated prompt after deep completion')
