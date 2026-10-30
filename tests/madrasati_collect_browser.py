"""Collect real saved page structures through mocked Chrome tabs and a real backend fixture."""
from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import datetime,timezone
import subprocess,json
R=Path(__file__).resolve().parents[1];A=Path('/workspace/attachments')
if not (A/'e52d9109-ccbb-4f44-b736-cf7e0082c40e').exists():raise SystemExit('SKIP: user-provided Madrasati files are not available in this workspace')
inputs={'directory':next((A/'e52d9109-ccbb-4f44-b736-cf7e0082c40e').glob('*.html')).read_text(),'timetable':next((A/'38bce45a-b9db-4309-889a-dc4248c3f8bc').glob('*.html')).read_text(),'meeting':next((A/'e0f9d464-81af-43e9-8738-783936f93a14').glob('*.html')).read_text()}
script="""const b=require('./tests/backend-fixture.cjs')();b.setDate('2026-10-30');b.setTime('2026-10-30T09:00:00Z');require('node:readline').createInterface({input:process.stdin}).on('line',line=>{console.log(JSON.stringify(b.api(JSON.parse(line))))});"""
server=subprocess.Popen(['node','-e',script],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.clock.install(time=datetime(2026,10,30,9,tzinfo=timezone.utc));calls=[]
 def api(r):
  calls.append(r.request.post_data_json);server.stdin.write(json.dumps(r.request.post_data_json)+'\n');server.stdin.flush();r.fulfill(json=json.loads(server.stdout.readline()))
 page.route('https://script.google.com/**',api);page.evaluate('(html)=>globalThis.inputs=html',inputs)
 page.evaluate('''()=>{globalThis.state={mirsadDriveConfig:{url:'https://script.google.com/macros/s/fixture/exec',key:'w'.repeat(40)}};globalThis.navigation=[];globalThis.fail=false;globalThis.waited=false;globalThis.chrome={storage:{local:{get:async keys=>Object.fromEntries((typeof keys==='string'?[keys]:keys).map(k=>[k,state[k]])),set:async v=>Object.assign(state,v)}},runtime:{onMessage:{addListener(){}}},webRequest:{onBeforeRequest:{addListener:f=>globalThis.beforeRequest=f},onCompleted:{addListener:f=>globalThis.afterRequest=f},onErrorOccurred:{addListener(){}}},tabs:{query:async()=>[{id:1,active:true,url:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId=4EDC7DC431263D06B86860D2ECC65ECF'}],create:async({url})=>{navigation.push(url);globalThis.workerUrl=url;return {id:2}},update:async(id,{url})=>{navigation.push(url);globalThis.workerUrl=url},get:async(id)=>({url:id===1?'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId=4EDC7DC431263D06B86860D2ECC65ECF':workerUrl,status:'complete'}),remove:async()=>{},sendMessage:async(id,m)=>{const kind=m.kind;if(kind==='timetable'&&!waited){waited=true;beforeRequest({requestId:'slow',type:'xmlhttprequest',tabId:id,url:'https://schools.madrasati.sa/SchoolManagment/Lessons/GetData'});setTimeout(()=>afterRequest({requestId:'slow',tabId:id}),700);return {ok:true,date:'2026-10-18',lessons:[]}}if(fail&&kind==='timetable')return {ok:false,error:'انتهت الجلسة'};const doc=new DOMParser().parseFromString(inputs[kind],'text/html');if(kind==='directory')return {ok:true,teachers:MirsadMadrasatiReader.directory(doc),sourceUrl:'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId=4EDC7DC431263D06B86860D2ECC65ECF'};if(kind==='timetable')return {ok:true,...MirsadMadrasatiReader.timetable(doc)};return {ok:true,url:MirsadMadrasatiReader.meeting(doc)}}}};globalThis.getRun=async()=>({running:false});}''')
 for filename in ['monitor-model.js','madrasati-reader.js','madrasati-source.js']:page.add_script_tag(path=str(R/'teams-probe'/filename))
 assert page.evaluate("MadrasatiSource.select('madrasati')")['ok'];r=page.evaluate("MadrasatiSource.collect('2026-10-18')");assert r['saved'] and r['teachers']==20 and r['lessons']==80,r
 uploads=[x for x in calls if x['action']=='publishMadrasatiTimetable'];assert len(uploads)==1;payload=uploads[0]['payload'];assert payload['scheduleDate']=='2026-10-18';assert payload['importedForDate']=='2026-10-30';assert all(l['teams'].startswith('https://teams.microsoft.com/l/meetup-join/') for l in payload['lessons']);assert all(u.startswith('https://schools.madrasati.sa/') for u in page.evaluate('navigation'))
 page.evaluate('globalThis.fail=true')
 try:page.evaluate("MadrasatiSource.collect('2026-10-18')");raise AssertionError('failed read should abort')
 except Exception as e:assert 'انتهت الجلسة' in str(e)
 assert len([x for x in calls if x['action']=='publishMadrasatiTimetable'])==1
 assert page.evaluate('state.mirsadMadrasatiCollection.error') is True
 assert page.evaluate("MadrasatiSource.select('naqar')")['ok'];b.close()
server.terminate();server.wait();print('PASS real saved page adapter -> sequential tab collection -> authenticated backend; 20 teachers, 80 fixture lessons; no Teams opened; failure does not replace source')
