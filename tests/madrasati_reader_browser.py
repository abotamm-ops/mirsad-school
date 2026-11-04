from pathlib import Path
from playwright.sync_api import sync_playwright
import re
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.route('**/*',lambda r:r.abort())
 def load(html):
  page.set_content('<meta charset="utf-8">'+html,wait_until='domcontentloaded');page.evaluate('globalThis.chrome={runtime:{onMessage:{addListener(f){globalThis.readerListener=f}}}};delete globalThis.__mirsadMadrasatiReader');page.add_script_tag(path=str(R/'teams-probe/schedule-core.js'));page.add_script_tag(path=str(R/'teams-probe/madrasati-reader.js'))
 load('<div class="card"><h5>معلم أول</h5><a href="https://schools.madrasati.sa/SchoolManagment/Lessons/TimeTable/'+ 'A'*32+'?Schoolid='+ 'B'*32+'">الجدول</a></div>')
 assert page.evaluate('MirsadMadrasatiReader.directory()[0].name')=='معلم أول'
 html='<span id="dategeo">18 أكتوبر 2026</span><li class="dayIcon" dayindex="0"><a class="active">الأحد</a></li><li class="dayIcon" dayindex="1"><a id="monday">الاثنين</a></li><table><tbody id="divDayLectures"><tr id="hessaNumber1"><td class="event-title"><h6>العلوم</h6><div class="text-black-2">من 06:30 ص إلى 07:15 ص</div><div class="fs-sm text-body">أولى أول</div><a href="https://schools.madrasati.sa/Teacher/Lessons/viewLectureDetails?Data=fixture">مشاهدة التفاصيل</a></td></tr></tbody></table>'
 load(html);assert page.evaluate('MirsadMadrasatiReader.timetable().date')=='2026-10-18';assert page.evaluate('MirsadMadrasatiReader.timetable().lessons[0].period')==1
 # Today exposes the join link in the timetable, even when details have no link.
 direct='https://teams.microsoft.com/l/meetup-join/today?context=%7B%22Tid%22%3A%22fixture%22%7D'
 load(html.replace('</td>','<a href="'+direct+'" onclick="window.clicked=true">حضور الدرس</a></td>'))
 lesson=page.evaluate('MirsadMadrasatiReader.timetable().lessons[0]');assert lesson['teams']==direct;assert not lesson['unprepared'];assert page.evaluate('!!window.clicked') is False
 # A direct link also works without a details action; duplicate identical links are safe.
 today=html.replace('https://schools.madrasati.sa/Teacher/Lessons/viewLectureDetails?Data=fixture',direct)
 load(today);lesson=page.evaluate('MirsadMadrasatiReader.timetable().lessons[0]');assert lesson['teams']==direct;assert not lesson['missingDetails'];assert not lesson['unprepared']
 load(today.replace('</td>','<a href="'+direct+'">حضور الدرس</a></td>'));assert page.evaluate('MirsadMadrasatiReader.timetable().lessons[0].teams')==direct
 load(today.replace('</td>','<a href="https://teams.microsoft.com/meet/different">حضور آخر</a></td>'));assert page.evaluate("(()=>{try{MirsadMadrasatiReader.timetable();return false}catch(e){return e.message.includes('أكثر من رابط')}})()")
 # Links remain scoped to each lesson, never copied from another period.
 second='<tr id="hessaNumber2"><td class="event-title"><h6>رياضيات</h6><div class="text-black-2">08:00</div><div class="fs-sm text-body">أول ب</div></td></tr>'
 load(today.replace('</tbody>',second+'</tbody>'));lessons=page.evaluate('MirsadMadrasatiReader.timetable().lessons');assert lessons[0]['teams']==direct;assert lessons[1]['teams']=='';assert lessons[1]['unprepared']
 load(html)
 # A weekday tab changes immediately but old rows remain until the asynchronous response.
 page.evaluate('''()=>{document.querySelector('#monday').onclick=()=>{document.querySelector('a.active').classList.remove('active');document.querySelector('#monday').classList.add('active');setTimeout(()=>document.querySelector('#divDayLectures h6').textContent='درس الاثنين',1000)}}''')
 # Handler enforces the real origin; expose selectDay through a local-only test transform.
 source=(R/'teams-probe/madrasati-reader.js').read_text().replace('directory,timetable,meeting,displayedDate','directory,timetable,meeting,displayedDate,selectDay')
 page.evaluate('delete globalThis.__mirsadMadrasatiReader');page.add_script_tag(content=source)
 result=page.evaluate("MirsadMadrasatiReader.selectDay('2026-10-19')");assert result['date']=='2026-10-19';assert result['lessons'][0]['title']=='درس الاثنين'
 page.evaluate("""()=>{globalThis.fixtureWeek=new Date('2026-10-18T12:00:00Z');const months=['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'];for(const [cls,shift] of [['prevCalendar',-7],['nextCalendar',7]]){const button=document.createElement('button');button.className=cls;button.onclick=()=>setTimeout(()=>{fixtureWeek.setUTCDate(fixtureWeek.getUTCDate()+shift);document.querySelector('#dategeo').textContent=fixtureWeek.getUTCDate()+' '+months[fixtureWeek.getUTCMonth()]+' '+fixtureWeek.getUTCFullYear();document.querySelector('#divDayLectures h6').textContent='الأسبوع '+fixtureWeek.toISOString().slice(0,10)},300);document.body.append(button)}}""")
 earlier=page.evaluate("MirsadMadrasatiReader.selectDay('2026-10-05')");assert earlier['date']=='2026-10-05';assert '2026-10-04' in earlier['lessons'][0]['title']
 later=page.evaluate("MirsadMadrasatiReader.selectDay('2026-11-02')");assert later['date']=='2026-11-02';assert '2026-11-01' in later['lessons'][0]['title']

 # Historical Thursday: complete scheduled lessons without detail actions stay in the import.
 no_details='<span id="dategeo">18 أكتوبر 2026</span><li class="dayIcon" dayindex="4"><a class="active">الخميس</a></li><table><tbody id="divDayLectures"><tr id="hessaNumber3"><td class="event-title"><h6>العلوم</h6><div class="text-black-2">08:02–08:47</div><div class="fs-sm text-body">أول أ</div></td></tr></tbody></table>'
 load(no_details);lesson=page.evaluate('MirsadMadrasatiReader.timetable()');assert lesson['date']=='2026-10-22';assert lesson['lessons'][0]['period']==3;assert lesson['lessons'][0]['unprepared'];assert lesson['lessons'][0]['missingDetails'];assert lesson['lessons'][0]['detailUrl']==''
 page.evaluate("document.querySelector('#divDayLectures').setAttribute('aria-busy','true')");assert page.evaluate("(()=>{try{MirsadMadrasatiReader.timetable();return false}catch(e){return e.retryable===true}})()")
 load(no_details.replace('</td>','<a href="https://outside.invalid/Teacher/Lessons/viewLectureDetails?Data=x">تفاصيل</a></td>'));assert page.evaluate("(()=>{try{MirsadMadrasatiReader.timetable();return false}catch(e){return !e.retryable}})()")
 load(no_details.replace('<div class="fs-sm text-body">أول أ</div>',''));assert page.evaluate("(()=>{try{MirsadMadrasatiReader.timetable();return false}catch(e){return e.message.includes('ناقصة')}})()")
 load('<a href="https://schools.madrasati.sa/Home/MicrosoftTeams">تيمز العام</a><a href="https://teams.microsoft.com/l/meetup-join/fixture">رابط تسجيل الدرس</a>');assert page.evaluate('MirsadMadrasatiReader.meeting()').endswith('/fixture')
 # Completed details with no link are valid unprepared lessons, not loading errors.
 load('<h6 class="titlesection2">تكليفات الحصة</h6>');assert page.evaluate('MirsadMadrasatiReader.meeting()')==''
 load('<h1>جار التحميل</h1>');assert page.evaluate('(()=>{try{MirsadMadrasatiReader.meeting();return false}catch(e){return e.retryable===true}})()')
 load('<h6 class="titlesection2">تكليفات الحصة</h6><a href="https://teams.microsoft.com/unsupported">رابط التسجيل</a>');assert page.evaluate('(()=>{try{MirsadMadrasatiReader.meeting();return false}catch(e){return !e.retryable}})()')
 # Read the actual user-provided pages if attached in this execution workspace; no network or saved scripts execute.
 files=[('directory','e52d9109-ccbb-4f44-b736-cf7e0082c40e'),('timetable','38bce45a-b9db-4309-889a-dc4248c3f8bc'),('meeting','e0f9d464-81af-43e9-8738-783936f93a14')]
 for kind,folder in files:
  paths=list((Path('/workspace/attachments')/folder).glob('*.html'))
  if not paths:continue
  text=re.sub(r'<script\b[^>]*>[\s\S]*?</script>','',paths[0].read_text(),flags=re.I);text=re.sub(r'<link\b[^>]*>','',text,flags=re.I);load(text);data=page.evaluate('(kind)=>MirsadMadrasatiReader[kind]()',kind)
  if kind=='directory':assert len(data)==20
  elif kind=='timetable':assert data['date']=='2026-10-18';assert len(data['lessons'])==4;assert all(l['detailUrl'] and l['time'] and l['lesson'] for l in data['lessons'])
  else:assert data.startswith('https://teams.microsoft.com/l/meetup-join/')
 print('PASS real directory, timetable and meeting link; weekday date validation; delayed content updates; excludes general Teams shortcut');b.close()
