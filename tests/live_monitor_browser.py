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
 page.add_init_script('''window.__tones=0;window.AudioContext=class{constructor(){this.state='suspended';this.currentTime=0;this.destination={}}async resume(){if(localStorage.getItem('fixture-audio-gesture')==='yes'&&!navigator.userActivation.isActive)return new Promise(()=>{});this.state='running'}createOscillator(){return {type:'',frequency:{value:0},connect(){},start(){window.__tones++},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){}},connect(){}}}}''')
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
 data['records'].append(scan('absent',2,'06:40:00'));page.clock.fast_forward(301000);page.wait_for_function('window.__tones===4');assert 'الدورة الثانية' in page.locator('.live-absence-card').inner_text();assert 'الدورة الأولى' in page.locator('#liveMonitoringCycles').inner_text()
 page.clock.fast_forward(15000);page.wait_for_timeout(100);assert page.evaluate('window.__tones')==4
 data['records'].append(scan('present',2,'06:40:20'));page.clock.fast_forward(15000);page.wait_for_selector('.live-absence-card',state='hidden')
 data['records'].append(scan('absent',2,'06:41:00'));page.clock.fast_forward(45000);page.wait_for_selector('.live-absence-card');page.wait_for_function('window.__tones===6')
 page.clock.fast_forward(35*60000);page.wait_for_selector('.live-absence-card',state='hidden');assert page.evaluate('window.__tones')==6
 data['records'].append(scan('absent',1,'07:17:00',2));page.clock.fast_forward(60000);page.wait_for_selector('.live-absence-card');assert 'الحصة الثانية' in page.locator('#liveMonitoringContext').inner_text();assert 'الحصة 2' not in page.locator('.live-absence-card').inner_text()
 page.locator('#liveMonitoringSound').click();assert page.locator('#liveMonitoringSound').get_attribute('aria-pressed')=='false'
 page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#liveMonitoring .live-absence-card');assert 'رصد مباشر' in page.locator('#liveMonitoring h2').inner_text()
 for path in ['/absence/','/absence.html']:
  page.goto('https://mirsad-school.onrender.com'+path);page.wait_for_selector('#liveMonitoring .live-absence-card');assert page.locator('#liveMonitoring .live-monitor-link').count()==0
 data['snapshot']['scheduleSettings']={'manualStart':'18:30','periodDuration':45,'manualGapMinutes':1};data['snapshot']['lessons'][0]['period']=4;data['snapshot']['lessons'][1]['period']=5;data['records']=[scan('absent',1,'20:52:00',4)]
 page.clock.fast_forward(stamp('20:54:00')-page.evaluate('Date.now()'));page.wait_for_selector('.live-absence-card');assert 'الحصة الرابعة' in page.locator('#liveMonitoringContext').inner_text();assert 'الدورة الأولى' in page.locator('.live-absence-card').inner_text()
 page.screenshot(path='/tmp/mirsad-live-evening-fixed.png')
 data['records'].append(scan('absent',2,'21:00:00',4));page.clock.fast_forward(stamp('21:00:01')-page.evaluate('Date.now()'));page.wait_for_function("document.querySelector('.live-absence-card').textContent.includes('الدورة الثانية')")
 page.clock.fast_forward(stamp('21:33:00')-page.evaluate('Date.now()'));page.wait_for_selector('.live-absence-card',state='hidden')
 data['records'].append(scan('absent',1,'21:35:00',5));page.clock.fast_forward(stamp('21:35:01')-page.evaluate('Date.now()'));page.wait_for_selector('.live-absence-card');assert 'الحصة الخامسة' in page.locator('#liveMonitoringContext').inner_text()

 page.route('https://drive.google.com/**',lambda r:r.fulfill(content_type='text/html',body='<p>صورة التوثيق</p>'))
 data['snapshot']['teachers']=[];data['snapshot']['lessons']=[];data['records']=[]
 for i in range(13):
  tid='t'+str(i);data['snapshot']['teachers'].append({'id':tid,'name':'المعلم '+str(i)});data['snapshot']['lessons'].append({'teacherId':tid,'teacherName':'المعلم '+str(i),'period':5,'url':'https://teams.microsoft.com/test'});data['records'].append({**scan('absent',1,'21:35:00',5),'teacherId':tid,'evidenceUrl':'https://drive.google.com/file/d/proof_'+str(i)+'/view?resourcekey=test'})
 page.clock.fast_forward(6000);page.wait_for_function("document.querySelectorAll('.live-absence-card').length===13")
 page.locator('[data-teacher-id="t12"] .live-absence-name').click();dialog=page.locator('.live-photo-dialog');assert dialog.is_visible();assert dialog.locator('h2').inner_text()=='المعلم 12';assert dialog.locator('iframe').get_attribute('src')=='https://drive.google.com/file/d/proof_12/preview?resourcekey=test';assert dialog.locator('a').get_attribute('href')=='https://drive.google.com/file/d/proof_12/view?resourcekey=test';dialog.locator('button').click()
 data['records'][0]['evidenceUrl']='javascript:alert(1)';page.clock.fast_forward(6000);page.locator('[data-teacher-id="t0"] .live-absence-name').click();assert dialog.locator('iframe').count()==0;assert 'لم تصل صورة' in dialog.inner_text();page.keyboard.press('Escape');assert not dialog.is_visible()

 page.locator('#liveMonitoringSound').click();assert page.evaluate("localStorage.getItem('mirsad-live-sound-enabled')")=='true'
 page.reload();page.wait_for_selector('.live-absence-card');assert page.locator('#liveMonitoringSound').get_attribute('aria-pressed')=='true';assert page.locator('#liveMonitoringSound').get_attribute('data-audio-state')=='ready';page.wait_for_function('window.__tones===2')
 page.evaluate("localStorage.setItem('fixture-audio-gesture','yes')");page.reload();page.wait_for_selector('.live-absence-card');assert page.locator('#liveMonitoringSound').get_attribute('aria-pressed')=='true';assert page.locator('#liveMonitoringSound').get_attribute('data-audio-state')=='waiting';assert page.evaluate('window.__tones')==0
 page.locator('#liveMonitoring h2').click();page.wait_for_function("document.getElementById('liveMonitoringSound').dataset.audioState==='ready'");page.wait_for_function('window.__tones===2')
 page.locator('#liveMonitoringSound').click();assert page.evaluate("localStorage.getItem('mirsad-live-sound-enabled')")=='false';page.reload();page.wait_for_selector('.live-absence-card');assert page.locator('#liveMonitoringSound').get_attribute('aria-pressed')=='false';assert page.evaluate('window.__tones')==0
 assert not errors,errors;b.close();print('PASS homepage and dashboard live banner; first/second rounds; class elapsed time; new-result sound without repeats; arrival removes alert; finished classes clear; sound can be muted')
