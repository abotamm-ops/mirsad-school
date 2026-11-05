"""GetCal contract and validation, using a local mock rather than a school login."""
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
SCHOOL='A'*32;TEACHER='B'*32
URL='https://schools.madrasati.sa/SchoolManagment/Lessons/TimeTable/'+TEACHER+'?Schoolid='+SCHOOL
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page()
 html='<meta charset="utf-8"><span id="dategeo">1 نوفمبر 2026</span><li class="dayIcon" dayindex="1"><a class="active">الاثنين</a></li>'
 html+='<input id="_hndCurrentDate" value="11/1/2026 12:00:00 AM"><input id="_hndSchoolId" value="'+SCHOOL+'"><input id="_hndTeacherId" value="'+TEACHER+'"><input id="csrfid" value="fixture-csrf">'
 html+='<table><tbody id="divDayLectures">'+''.join('<tr id="hessaNumber'+str(i)+'"><td class="event-title"><h6>درس '+str(i)+'</h6><div class="text-black-2">08:00</div><div class="fs-sm text-body">أول أ</div><a href="https://schools.madrasati.sa/Teacher/Lessons/viewLectureDetails?Data='+str(i)+'">التفاصيل</a>'+('<a href="https://teams.microsoft.com/l/meetup-join/period2">حضور الدرس</a>' if i==2 else '')+'</td></tr>' for i in range(1,8))+'</tbody></table>'
 page.route('**/*',lambda r:r.fulfill(body=html,content_type='text/html') if r.request.url==URL else r.abort())
 page.goto(URL);page.evaluate('globalThis.chrome={runtime:{onMessage:{addListener(f){window.readerListener=f}}}}');page.add_script_tag(path=str(R/'teams-probe/schedule-core.js'));page.add_script_tag(path=str(R/'teams-probe/madrasati-reader.js'))
 page.evaluate('''()=>{window.calls=[];window.api={CurrentSelectedDateString:'02 نوفمبر 2026',TimeTable:Array.from({length:7},(_,i)=>({SlotNumber:i+1,SubjectName:'درس '+(i+1),ClassRoomName:'أول أ',PresenterUrl:'https://teams.microsoft.com/l/meetup-join/period'+(i+1)}))};window.base=structuredClone(api);window.fetch=async(url,options)=>{calls.push({url,...options});return {ok:true,status:200,url,json:async()=>structuredClone(api)}}}''')
 result=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())')
 assert len(result['lessons'])==7 and all(l['teams'].endswith('period'+str(l['period'])) and not l['unprepared'] for l in result['lessons'])
 call=page.evaluate('calls[0]');from urllib.parse import parse_qs
 assert parse_qs(call['body'])=={'Date':['11/1/2026 12:00:00 AM'],'index':['1'],'SchoolId':[SCHOOL],'TechearId':[TEACHER]}
 assert call['method']=='POST' and call['credentials']=='same-origin' and call['redirect']=='error'
 assert call['headers']['requestverificationtoken']=='fixture-csrf' and len(page.evaluate('calls'))==1
 # Launcher + different subject label must still resolve the seventh future
 # lesson from GetCal, without waiting for lesson details to gain a link.
 page.evaluate("api.TimeTable[6].SubjectName='اسم المادة';api.TimeTable[6].PresenterUrl='https://teams.microsoft.com/dl/launcher/launcher.html?url='+encodeURIComponent('/_#/l/meetup-join/period7?anon=true');api.TimeTable[1].PresenterUrl='https://teams.microsoft.com/dl/launcher/launcher.html?url='+encodeURIComponent('/_#/l/meetup-join/period2?anon=true')")
 launcher_result=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())')
 assert launcher_result['lessons'][6]['teams']=='https://teams.microsoft.com/l/meetup-join/period7?anon=true'
 assert launcher_result['lessons'][1]['teams']=='https://teams.microsoft.com/l/meetup-join/period2'
 # Fifth-period links are collected before its start using the same verified
 # teacher/date/slot/class contract, including copied Teams launcher links.
 page.evaluate("api.TimeTable[4].SubjectName='علوم';api.TimeTable[4].PresenterUrl='https://teams.microsoft.com/dl/launcher/launcher.html?url='+encodeURIComponent('/_#/l/meetup-join/naif-fifth?anon=true')")
 fifth=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())')
 assert fifth['lessons'][4]['period']==5 and fifth['lessons'][4]['teams']=='https://teams.microsoft.com/l/meetup-join/naif-fifth?anon=true'
 # JSON order must not swap first and seventh: slot number is authoritative.
 page.evaluate('api=structuredClone(base);api.TimeTable.reverse()')
 unordered=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())')
 assert all(l['teams'].endswith('period'+str(l['period'])) for l in unordered['lessons'])
 def rejected(edit,expected):
  page.evaluate('api=structuredClone(base)');page.evaluate(edit)
  try:page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');raise AssertionError('invalid response accepted')
  except Exception as e:assert expected in str(e),(expected,str(e))
 rejected("api.CurrentSelectedDateString='2026-11-01'",'تاريخ')
 rejected("api.TimeTable[2].PresenterUrl='https://evil.example/meeting'",'غير صالح')
 rejected("api.TimeTable[2].ClassRoomName='ثاني ب'",'فصل')
 # Subject labels and topic titles differ. Date/teacher/period/class identify
 # the lesson; a matching class allows GetCal before attendance becomes active.
 page.evaluate("api=structuredClone(base);api.TimeTable[2].SubjectName='مادة مختلفة'")
 result=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())')
 assert result['lessons'][2]['teams'].endswith('period3') and result['lessons'][2]['title']=='درس 3'
 assert all(l['teams'].endswith('period'+str(l['period'])) for l in result['lessons'])
 # Without a JSON classroom identity, require the independent row route.
 page.evaluate("delete api.TimeTable[2].ClassRoomName")
 result=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())')
 assert result['lessons'][2]['teams']=='' and result['lessons'][2]['detailUrl'].endswith('Data=3')
 # Without an independently identified row route, fail closed.
 try:
  page.evaluate("(()=>{const t=MirsadMadrasatiReader.timetable();t.lessons[2].detailUrl='';return MirsadMadrasatiReader.calendarTimetable(t)})()")
  raise AssertionError('unverifiable subject mismatch accepted')
 except Exception as e:assert 'مادة' in str(e)
 rejected("api.TimeTable.push(api.TimeTable[0])",'أكثر من درس')
 rejected("api.TimeTable.splice(2,1)",'غير موجودة')
 rejected("api.TimeTable[1].PresenterUrl='https://teams.microsoft.com/meet/conflict'",'يختلف')
 rejected("api.TimeTable=null",'تاريخ')
 # Missing JSON link retains the existing details route, including historical dates.
 page.evaluate("api=structuredClone(base);api.TimeTable[2].PresenterUrl=null")
 result=page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');assert result['lessons'][2]['teams']=='' and result['lessons'][2]['detailUrl'].endswith('Data=3')
 # The real extension message path invokes GetCal, not just the test helper.
 page.evaluate('api=structuredClone(base)')
 result=page.evaluate("new Promise(resolve=>readerListener({type:'MIRSAD_MADRASATI_READ',kind:'timetable',date:'2026-11-02'},{},resolve))")
 assert result['ok'] and all(l['teams'] for l in result['lessons'])
 # Historical day reads retain the requested date and weekday index.
 page.evaluate("document.querySelector('.dayIcon').setAttribute('dayindex','0');api.CurrentSelectedDateString='2026-11-01'")
 result=page.evaluate("new Promise(resolve=>readerListener({type:'MIRSAD_MADRASATI_READ',kind:'timetable',date:'2026-11-01'},{},resolve))")
 assert result['ok'] and result['date']=='2026-11-01' and parse_qs(page.evaluate('calls.at(-1).body'))['index']==['0']
 page.evaluate("api.TimeTable[2].SubjectName='اسم المادة';api.TimeTable[1].SubjectName='اسم آخر'")
 result=page.evaluate("new Promise(resolve=>readerListener({type:'MIRSAD_MADRASATI_READ',kind:'timetable',date:'2026-11-01'},{},resolve))")
 assert result['ok'] and result['date']=='2026-11-01'
 assert result['lessons'][2]['teams'].endswith('period3')
 assert result['lessons'][1]['teams'].endswith('period2')

 page.evaluate("document.querySelector('.dayIcon').setAttribute('dayindex','1');api=structuredClone(base);document.querySelector('#_hndTeacherId').value='C'.repeat(32);calls=[]")
 try:page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');raise AssertionError('different teacher accepted')
 except Exception as e:assert 'هوية' in str(e)
 assert page.evaluate('calls.length')==0
 page.evaluate("document.querySelector('#_hndTeacherId').value='B'.repeat(32);document.querySelector('#_hndSchoolId').value='C'.repeat(32)")
 try:page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');raise AssertionError('different school accepted')
 except Exception as e:assert 'هوية' in str(e)
 assert page.evaluate('calls.length')==0
 page.evaluate("document.querySelector('#_hndSchoolId').value='A'.repeat(32)")
 # Session and prerequisite failures never become linkless successful imports.
 page.evaluate("document.querySelector('#csrfid').value='';calls=[]")
 try:page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');raise AssertionError('missing CSRF accepted')
 except Exception as e:assert 'لم تكتمل' in str(e)
 assert page.evaluate('calls.length')==0
 page.evaluate("document.querySelector('#csrfid').value='fixture-csrf';fetch=async()=>({ok:false,status:403})")
 try:page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');raise AssertionError('HTTP failure accepted')
 except Exception as e:assert '403' in str(e)
 page.evaluate("fetch=async()=>({ok:true,url:'https://schools.madrasati.sa/Account/Login'})")
 try:page.evaluate('MirsadMadrasatiReader.calendarTimetable(MirsadMadrasatiReader.timetable())');raise AssertionError('login accepted')
 except Exception as e:assert 'انتهت جلسة' in str(e)
 # Resolve the mismatched historical row through its own details URL.
 page.evaluate("fetch=async(url)=>({ok:true,url,text:async()=>'<a href=\"https://teams.microsoft.com/l/meetup-join/detail-period3\">حضور</a>'})")
 details=page.evaluate("MirsadMadrasatiReader.meetingBatch(['https://schools.madrasati.sa/Teacher/Lessons/viewLectureDetails?Data=3'])")
 assert details[0]['ok'] and details[0]['url'].endswith('detail-period3')
 b.close();print('PASS GetCal fills all seven period links; exact request contract; date, school/teacher context, CSRF, duplicate/missing periods, class/subject, invalid/conflicting links and session failures guarded; details fallback retained')
