from pathlib import Path
from datetime import datetime,timezone
import json,subprocess,time,urllib.request
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1];PORT=8792
source="""const http=require('node:http'),backend=require('./backend-fixture.cjs')();backend.setTime('2026-10-20T06:35:00+03:00');const date='2026-10-20',items=['حاضر','غائب','غير محسوم'].map((s,i)=>({teacher:'المعلم '+i,period:1,url:'https://teams.microsoft.com/test'}));items.push({teacher:'المعلم 0',period:2,url:'https://teams.microsoft.com/test'});backend.write('startDay',{date,items,teachers:items.map(x=>x.teacher),roundCount:3});for(let i=0;i<3;i++)for(let cycle=1;cycle<=3;cycle++)backend.write('record',{date,record:{scheduledTeacher:'المعلم '+i,scanId:i+'-'+cycle,period:1,cycle,status:['present','absent','unresolved'][i],scannedAt:new Date('2026-10-20T06:34:00+03:00').getTime()+cycle,detail:'PRIVATE DIAGNOSTIC'}});backend.ctx.secureMonitoringEvidence();const server=http.createServer((req,res)=>{let body='';req.on('data',x=>body+=x);req.on('end',()=>{try{const p=JSON.parse(body);if(p.fixtureTime){backend.setTime(p.fixtureTime);res.end('{}');return}res.setHeader('Content-Type','application/json');res.end(JSON.stringify(backend.api(p)))}catch(e){res.end(JSON.stringify({ok:false,error:e.message}))}})});server.listen(PORT,'127.0.0.1');""".replace('PORT',str(PORT))
proc=subprocess.Popen(['node','-e',source],cwd=R/'tests',stdout=subprocess.DEVNULL)
def post(data):return json.loads(urllib.request.urlopen(urllib.request.Request(f'http://127.0.0.1:{PORT}',data=json.dumps(data).encode(),headers={'Content-Type':'application/json'})).read())
try:
 for _ in range(80):
  try:post({'action':'teachersLive'});break
  except Exception:time.sleep(.05)
 with sync_playwright() as p:
  browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=browser.new_page(viewport={'width':390,'height':844});errors=[];calls=[];state={'offline':False};page.on('pageerror',lambda e:errors.append(str(e)));page.clock.install(time=datetime(2026,10,20,3,35,tzinfo=timezone.utc))
  page.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0])))
  def api(r):
   calls.append(r.request.post_data_json)
   if state.get('unprepared'):r.fulfill(json={'ok':False,'error':'طلب غير مدعوم'})
   elif state['offline']:r.abort('internetdisconnected')
   else:r.fulfill(json=post(r.request.post_data_json))
  page.route('https://script.google.com/**',api);page.goto('https://mirsad-school.onrender.com/teachers-live.html');page.wait_for_selector('.teacher-card');assert page.locator('.teacher-card').count()==3;assert 'الحصة الحالية 1' in page.locator('#currentPeriod').inner_text();assert page.locator('.state.present').count()==1;assert page.locator('.state.absent').count()==1;assert page.locator('.state.unresolved').count()==1;assert page.locator('button,dialog,img,input[type=password],input[type=date]').count()==0;assert page.locator('a[href*="drive.google"],a[href*="automatic-monitoring"]').count()==0;assert page.evaluate('document.documentElement.scrollWidth')<=390
  page.screenshot(path='/tmp/mirsad-teachers-live-mobile.png',full_page=True);page.locator('#scope').select_option('today');assert page.locator('.teacher-card').count()==4;assert 'الحصة 2' in page.locator('#results').inner_text();page.locator('#scope').select_option('current');last=page.locator('#lastSuccess').inner_text();state['offline']=True;page.clock.fast_forward(6000);page.wait_for_function("document.body.classList.contains('is-offline')");assert 'متوقف' in page.locator('#connectionState').inner_text();assert page.locator('#lastSuccess').inner_text()==last
  for cycle in [1,2,3]:assert post({'action':'record','date':'2026-10-20','key':'w'*40,'record':{'scanId':'new-'+str(cycle),'scheduledTeacher':'المعلم 1','period':1,'cycle':cycle,'status':'present','scannedAt':int(datetime(2026,10,20,3,35,10,tzinfo=timezone.utc).timestamp()*1000)+cycle}})['ok']
  post({'fixtureTime':'2026-10-20T06:35:12+03:00'});state['offline']=False;page.clock.fast_forward(6000);page.wait_for_function("document.querySelectorAll('.state.present').length===2");assert not page.locator('body').evaluate('(e)=>e.classList.contains("is-offline")');assert page.locator('#lastSuccess').inner_text()!=last
  assert not post({'action':'override','audience':'teachers','date':'2026-10-20','adminPin':'111395','requestId':'teacher-test'})['ok'];assert not post({'action':'record','key':'w'*40,'date':'2026-10-20','mode':'trial','record':{}})['ok'];assert not post({'action':'day','date':'2026-10-19'})['ok']
  post({'fixtureTime':'2026-10-20T07:15:00+03:00'});page.clock.fast_forward(39*60000+48000);page.wait_for_function("document.querySelectorAll('.teacher-card').length===0");assert 'لا توجد حصة' in page.locator('#currentPeriod').inner_text()
  post({'fixtureTime':'2026-10-20T07:16:00+03:00'});page.clock.fast_forward(60000);page.wait_for_selector('.teacher-card');assert page.locator('.teacher-card').count()==1;assert 'الحصة 2' in page.locator('.teacher-card').inner_text();assert 'الحصة الحالية 2' in page.locator('#currentPeriod').inner_text()
  page.set_viewport_size({'width':1440,'height':900});assert page.evaluate('document.documentElement.scrollWidth')<=1440
  state['unprepared']=True;page.reload();page.wait_for_function("document.getElementById('connectionState').textContent.includes('تفعيل')");assert page.locator('.teacher-card').count()==0
  assert all(c.get('action')=='teachersLive' and c.get('audience')=='teachers' and 'key' not in c for c in calls);assert not errors,errors;browser.close();print('PASS mobile official LIVE, private payload, automatic new results, period transitions, offline warning, denied writes and trial isolation')
finally:proc.terminate();proc.wait(timeout=5)
