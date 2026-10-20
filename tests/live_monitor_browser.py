from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlparse,parse_qs
import json
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
def stamp(time):return int(datetime.fromisoformat('2026-10-20T'+time+'+03:00').timestamp()*1000)
def scan(status,cycle,time,period=1):return {'teacherId':'a','status':status,'cycle':cycle,'scannedAt':stamp(time),'period':period}
data={'ok':True,'snapshot':{'date':'2026-10-20','roundCount':2,'teachers':[{'id':'a','name':'المعلم الأول'}],'lessons':[{'teacherId':'a','teacherName':'المعلم الأول','period':p,'subject':'المادة','className':'أولى أ','url':'https://teams.microsoft.com/test'} for p in [1,2]]},'records':[scan('absent',1,'06:33:00')]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1440,'height':1000});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.add_init_script('''window.__tones=0;window.AudioContext=class{constructor(){this.state='suspended';this.currentTime=0;this.destination={}}async resume(){this.state='running'}createOscillator(){return {type:'',frequency:{value:0},connect(){},start(){window.__tones++},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}''')
 page.clock.install(time=datetime(2026,10,20,3,35,tzinfo=timezone.utc))
 page.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str((R/(r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0] or 'index.html')) / 'index.html') if r.request.url.split('?')[0].endswith('/absence/') else str(R/(r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0] or 'index.html'))))
 def api(r):
  if r.request.method=='GET':
   callback=parse_qs(urlparse(r.request.url).query).get('callback',[''])[0];r.fulfill(content_type='application/javascript',body=callback+'({ok:false});');return
  action=r.request.post_data_json['action'];r.fulfill(json={'ok':True,'dates':['2026-10-20'],'authMode':'public'} if action=='dates' else data)
 page.route('https://script.google.com/**',api)
 page.goto('https://mirsad-school.onrender.com/index.html');page.wait_for_selector('.live-absence-card');assert 'الدورة الأولى' in page.locator('.live-absence-card').inner_text();assert 'بداية الحصة: 5 دقيقة' in page.locator('.live-absence-card').inner_text();assert page.evaluate('window.__tones')==0;assert page.locator('.live-badge').inner_text().strip()=='LIVE';assert page.locator('.live-badge').evaluate('(e)=>getComputedStyle(e).animationName')=='liveBadgePulse'
 page.locator('#liveMonitoringSound').click();page.wait_for_function('window.__tones===2');assert page.locator('#liveMonitoringSound').get_attribute('aria-pressed')=='true'
 box=page.locator('#liveMonitoring').bounding_box();title=page.locator('#liveMonitoring h2').bounding_box();assert abs(box['x']+box['width']/2-720)<1;assert abs(title['x']+title['width']/2-720)<1;assert box['height']<300;assert box['width']<=1040
 page.screenshot(path='/tmp/mirsad-live-first-round.png')
 data['records'].append(scan('absent',2,'06:40:00'));page.clock.fast_forward(301000);page.wait_for_function('window.__tones===4');assert 'الدورة الثانية' in page.locator('.live-absence-card').inner_text();assert 'الدورة الأولى: غائب' in page.locator('.live-absence-card').inner_text()
 page.clock.fast_forward(15000);page.wait_for_timeout(100);assert page.evaluate('window.__tones')==4
 data['records'].append(scan('present',2,'06:40:20'));page.clock.fast_forward(15000);page.wait_for_selector('.live-absence-card',state='hidden')
 data['records'].append(scan('absent',2,'06:41:00'));page.clock.fast_forward(45000);page.wait_for_selector('.live-absence-card');page.wait_for_function('window.__tones===6')
 page.clock.fast_forward(35*60000);page.wait_for_selector('.live-absence-card',state='hidden');assert page.evaluate('window.__tones')==6
 data['records'].append(scan('absent',1,'07:17:00',2));page.clock.fast_forward(60000);page.wait_for_selector('.live-absence-card');assert 'الحصة الثانية' in page.locator('#liveMonitoringContext').inner_text();assert 'الحصة 2' not in page.locator('.live-absence-card').inner_text()
 page.locator('#liveMonitoringSound').click();assert page.locator('#liveMonitoringSound').get_attribute('aria-pressed')=='false'
 page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#liveMonitoring .live-absence-card');assert 'رصد مباشر' in page.locator('#liveMonitoring h2').inner_text()
 for path in ['/absence/','/absence.html']:
  page.goto('https://mirsad-school.onrender.com'+path);page.wait_for_selector('#liveMonitoring .live-absence-card');assert page.locator('#liveMonitoring .live-monitor-link').count()==0
 assert not errors,errors;b.close();print('PASS homepage and dashboard live banner; first/second rounds; class elapsed time; new-result sound without repeats; arrival removes alert; finished classes clear; sound can be muted')
