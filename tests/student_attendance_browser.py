from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
fixture={'ok':True,'snapshot':{'date':'2026-11-04','lessons':[]},'records':[{'scanId':'s'+str(c),'teacherName':'معلم الاختبار','period':1,'cycle':c,'status':'present','scannedAt':1793768400000,'studentAttendance':{'available':True,'complete':c==2,'className':'أول أ','absentStudents':['طالب غائب','<img src=x onerror=alert(1)>']}} for c in [1,2]]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(accept_downloads=True);errors=[]
 ctx.add_init_script("try{localStorage.setItem('mirsad_archive_password_v1','fixture-admin')}catch{}")
 ctx.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/urlsplit(r.request.url).path.lstrip('/'))))
 ctx.route('https://script.google.com/**',lambda r:r.fulfill(json={'ok':True,'role':'admin'} if r.request.post_data_json['action']=='adminLogin' else fixture))
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.goto('https://mirsad-school.onrender.com/student-attendance.html');page.wait_for_selector('#studentGroups table tbody tr')
 assert page.locator('#studentGroups tbody tr').count()==4
 assert page.locator('#studentGroups img').count()==0
 assert 'جزئية' in page.locator('#studentGroups').inner_text()
 page.select_option('#studentCycle','1');assert page.locator('#studentGroups tbody tr').count()==2
 page.fill('#studentSearch','طالب غائب');assert page.locator('#studentGroups tbody tr').count()==1
 with page.expect_download() as d:page.click('#studentCsv')
 assert 'طالب غائب' in Path(d.value.path()).read_text(encoding='utf-8-sig')
 page.set_viewport_size({'width':390,'height':844});assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/mirsad-students-mobile.png')
 assert not errors,errors
 b.close();print('PASS private student page, cycle/name filters, partial markers, escaped names, CSV, mobile width')
