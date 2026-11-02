from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
import zipfile,io,subprocess,re,xml.etree.ElementTree as ET
R=Path(__file__).resolve().parents[1]
data={'ok':True,'snapshot':{'date':'2026-11-02','roundCount':1,'scheduleSettings':{'manualStart':'06:30','periodDuration':45,'manualGapMinutes':1},'teachers':[{'id':'a','name':'معلم الاختبار'}],'lessons':[{'teacherId':'a','teacherName':'معلم الاختبار','period':1,'url':'https://teams.microsoft.com/l/meetup-join/test','subject':'علوم','className':'أول أ'}]},'records':[{'scanId':'final','teacherId':'a','period':1,'cycle':1,'status':'absent','scannedAt':int(datetime(2026,11,2,3,35,tzinfo=timezone.utc).timestamp()*1000)}]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);ctx=b.new_context(viewport={'width':1280,'height':900},has_touch=True);errors=[]
 ctx.add_init_script("try{localStorage.setItem('mirsad_archive_password_v1','fixture-admin')}catch{}")
 ctx.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/(urlsplit(r.request.url).path.lstrip('/') or 'index.html'))))
 ctx.route('https://script.google.com/**',lambda r:r.fulfill(json={'ok':True,'role':'admin'} if r.request.post_data_json['action']=='adminLogin' else {'ok':True,'dates':['2026-11-02'],'authMode':'site-password'} if r.request.post_data_json['action']=='dates' else data))
 page=ctx.new_page();page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,11,2,3,40,5,tzinfo=timezone.utc));page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#todayTable tbody tr')
 assert page.locator('#lessonElapsed').inner_text()=='00:10:05';assert page.locator('#nextLessonCountdown').inner_text()=='00:35:55'
 page.clock.run_for(2000);assert page.locator('#lessonElapsed').inner_text()=='00:10:07'
 page.locator('[data-view=reports]').click();page.locator('#directorSignaturePanel summary').click();canvas=page.locator('#directorSignatureCanvas');canvas.scroll_into_view_if_needed();box=canvas.bounding_box()
 page.mouse.move(box['x']+30,box['y']+40);page.mouse.down();page.mouse.move(box['x']+120,box['y']+70,steps=6);page.mouse.move(box['x']+200,box['y']+20,steps=6);page.mouse.up();page.locator('#saveDirectorSignature').click();saved=page.evaluate('MirsadDirectorSignature.get()');assert saved.startswith('data:image/png;base64,')
 # Both bulk download paths must use the saved signature.
 for button,ext in [('downloadDailyReportsWord','.docx'),('downloadDailyReports','.pdf')]:
  page.wait_for_function('(id)=>!document.getElementById(id).disabled',arg=button)
  with page.expect_download() as event:page.locator('#'+button).click()
  payload=Path(event.value.path()).read_bytes()
  with zipfile.ZipFile(io.BytesIO(payload)) as bundle:
   names=bundle.namelist();assert len(names)==1 and names[0].endswith(ext);content=bundle.read(names[0])
  if ext=='.docx':
   with zipfile.ZipFile(io.BytesIO(content)) as doc:
    import base64
    assert doc.read('word/media/director-signature.png')==base64.b64decode(saved.split(',')[1])
    for n in ['word/document.xml','word/_rels/document.xml.rels','[Content_Types].xml']:ET.fromstring(doc.read(n))
    assert doc.read('word/document.xml').count(b'rIdMirsadDirectorSignature')==1
  else:
   Path('/tmp/mirsad-signed-report.pdf').write_bytes(content)
   info=subprocess.check_output(['pdfimages','-list','/tmp/mirsad-signed-report.pdf']).decode();assert re.search(r'\b1000\s+300\b',info),info
 page.reload();page.wait_for_selector('#todayTable tbody tr');page.locator('[data-view=reports]').click();page.locator('#directorSignaturePanel summary').click();page.wait_for_function('document.getElementById("directorSignatureCanvas").toDataURL()===MirsadDirectorSignature.get()')
 # A narrow mobile viewport retains saved ink; real touch input adds a new signature.
 page.set_viewport_size({'width':390,'height':844});page.locator('#clearDirectorSignature').click();assert page.evaluate('MirsadDirectorSignature.get()')==saved
 canvas.scroll_into_view_if_needed();box=canvas.bounding_box();cdp=ctx.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':box['x']+20,'y':box['y']+20}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':box['x']+90,'y':box['y']+55}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
 page.locator('#saveDirectorSignature').click();assert page.evaluate('MirsadDirectorSignature.get()')!=saved
 assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
 page.screenshot(path='/tmp/mirsad-signature-mobile.png')
 page.locator('#deleteDirectorSignature').click();assert page.evaluate('MirsadDirectorSignature.get()')==''
 assert not errors,errors
 b.close();print('PASS live timer seconds; mouse and touch signatures; saved ink survives reload/resize; scoped storage; signed Word/PDF bulk exports; clear versus delete; mobile width and no browser errors')
