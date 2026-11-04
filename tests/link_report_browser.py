from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1280,'height':900},accept_downloads=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 page.route('**/*',lambda r:r.fulfill(path=str(R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/'))) if (R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/')).is_file() else r.abort())
 page.add_init_script('''window.writes=0;window.report={id:'fixture',status:'preview',date:'2026-11-04',sourceDate:'2026-11-04',at:Date.now(),found:[{teacher:'معلم تجريبي',teacherId:'id',period:1,url:'https://teams.microsoft.com/l/meetup-join/fixture',source:'rendered-details'},{teacher:'معلم آخر',period:5,url:'https://teams.microsoft.com/meet/fifth'}],completed:[],missing:[{teacher:'معلم ثالث',period:7,reason:'لم يظهر رابط بعد إعادة التحقق'}],conflicts:[]};window.report=JSON.parse(localStorage.getItem('report')||'null')||window.report;window.chrome={storage:{local:{get:async()=>({mirsadLinkCompletionReports:[report]})}},runtime:{sendMessage:async m=>{if(m.type!=='MIRSAD_APPLY_MISSING_LINKS')throw Error('unexpected command');writes++;report.status='applied';report.appliedAt=Date.now();report.completed=report.found;localStorage.setItem('report',JSON.stringify(report));return {ok:true,saved:true,filled:2}}}}''')
 page.goto('http://report.test/link-completion.html?id=fixture');page.wait_for_selector('#rows tr');assert page.locator('#rows tr').count()==2;assert 'لم تُضف بعد' in page.locator('#summary').inner_text();assert page.evaluate('writes')==0
 assert 'إعادة فتح التفاصيل' in page.locator('#rows').inner_text();assert 'معلم ثالث' in page.locator('#missing').inner_text()
 page.locator('#period').select_option('5');assert page.locator('#rows tr').count()==1;page.locator('#period').select_option('')
 page.locator('#apply').click();page.wait_for_function("document.querySelector('#summary').textContent.includes('أُضيف 2')");assert page.evaluate('writes')==1;assert page.locator('#apply').is_disabled()
 with page.expect_download() as event:page.locator('#export').click()
 text=Path(event.value.path()).read_text(encoding='utf-8-sig');assert 'مضاف' in text and 'معلم تجريبي' in text and 'meet/fifth' in text
 page.reload();page.wait_for_selector('#rows tr');assert page.locator('#rows tr').count()==2;assert page.locator('#apply').is_disabled()
 page.evaluate("report.found=[];report.status='preview';report.completed=[];localStorage.setItem('report',JSON.stringify(report))")
 page.reload();page.wait_for_function("document.querySelector('#summary').textContent.includes('لا جديد')");assert page.locator('#apply').is_disabled()
 assert not errors,errors;b.close();print('PASS review report, whole-day period filters, source diagnostics, explicit one-click approval, applied receipt, CSV and no-new message')
