from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import datetime,timezone
import subprocess,json
R=Path(__file__).resolve().parents[1];date='2026-10-31';source='2026-10-18';school='4EDC7DC431263D06B86860D2ECC65ECF'
payload={'source':'madrasati','scheduleDate':source,'importedForDate':date,'schoolId':school,'sourceUrl':'https://schools.madrasati.sa/SchoolManagment/Teachers?SchoolId='+school,'totalTeachers':3,'teachers':['المعلم المستورد','المعلم بلا رابط','المعلم بلا حصص'],'totalLessons':5,'lessons':[{'teacher':'المعلم المستورد','cellIndex':n+1,'title':'درس '+str(n),'lesson':'أولى أول','time':'من 06:30 ص إلى 07:15 ص','teams':'https://teams.microsoft.com/l/meetup-join/lesson-'+str(n),'linkState':'linked'} for n in [1,2,3,4]]+[{'teacher':'المعلم بلا رابط','cellIndex':3,'title':'حصة','lesson':'ثالث أول','time':'07:16–08:01','teams':'','linkState':'unprepared'}]}
script="""const b=require('./tests/backend-fixture.cjs')();b.props.MONITOR_SITE_PASSWORD='fixture-password';b.setDate('2026-10-31');b.setTime('2026-10-31T09:00:00Z');require('node:readline').createInterface({input:process.stdin}).on('line',l=>console.log(JSON.stringify(b.api(JSON.parse(l)))));"""
server=subprocess.Popen(['node','-e',script],cwd=R,stdin=subprocess.PIPE,stdout=subprocess.PIPE,text=True)
def api(p):server.stdin.write(json.dumps(p)+'\n');server.stdin.flush();return json.loads(server.stdout.readline())
assert api({'action':'setTimetableSource','key':'w'*40,'mode':'madrasati'})['saved'];assert api({'action':'publishMadrasatiTimetable','key':'w'*40,'payload':payload})['saved']
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.clock.install(time=datetime(2026,10,31,9,tzinfo=timezone.utc));page.add_init_script("localStorage.setItem('mirsad_archive_password_v1','fixture-password')")
 def route(r):
  if r.request.url.startswith('https://mirsad-school.onrender.com/'):
   path=r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0] or 'index.html'
   if path=='admin-access.js':r.fulfill(content_type='text/javascript',body="window.MirsadAdminAccess={ready:Promise.resolve()};document.documentElement.classList.add('mirsad-admin-ready')")
   else:r.fulfill(path=str(R/path))
  elif 'script.google.com' in r.request.url:r.fulfill(json=api(r.request.post_data_json))
  else:r.abort()
 page.route('**/*',route);page.goto('https://mirsad-school.onrender.com/index.html');page.wait_for_function("document.querySelectorAll('#body a.teams').length===4");assert page.locator('#body tr').count()==3
 page.evaluate('window.chrome={runtime:{onMessage:{addListener:f=>window.scheduleListener=f}}}');page.add_script_tag(path=str(R/'teams-probe/schedule-core.js'));page.add_script_tag(path=str(R/'teams-probe/schedule.js'));data=page.evaluate("new Promise(resolve=>scheduleListener({type:'MIRSAD_GET_SCHEDULE'},{},resolve))")
 assert data['ok'] and len(data['items'])==5,data;linked=[x for x in data['items'] if x['url']];assert len(linked)==4;assert [x['period'] for x in linked]==[1,2,3,4];assert all(x['subject'] and x['className'] and x['hasLesson'] for x in data['items']);assert data['sourceDate']==source and data['sourceImportDate']==date;assert not any(x['teacher']=='المعلم بلا حصص' for x in data['items'])
 result=api({'action':'startDay','key':'w'*40,'date':date,'teachers':data['teachers'],'items':data['items'],'roundCount':3,'sourceType':data['sourceType'],'sourceScheduleDate':data['sourceDate'],'sourceImportDate':data['sourceImportDate']});assert result['ok'];assert len(result['snapshot']['lessons'])==5;assert result['snapshot']['sourceScheduleDate']==source;assert result['snapshot']['date']==date;dates=api({'action':'dates','key':'r'*40})['dates'];assert date in dates and source not in dates;b.close()
server.terminate();server.wait();print('PASS full Mirsad index cells -> extension schedule reader -> day snapshot: four Teams links, exact periods, linkless lesson retained, empty cells excluded, source date preserved')
