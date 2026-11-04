from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
name='سعد مبارك الدوسري'
source=(R/'teams-probe/content.js').read_text();needle='  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {';assert needle in source
source=source.replace(needle,"  globalThis.readerTest={findSections,scanOrganizerAcrossPage,participantRows,rosterHeadingsInOrder,captureInvitedStudents};return;\n"+needle,1)
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page()
 def setup(html):
  page.goto('about:blank');page.set_content('<style>body{font:16px Arial}h3{height:30px} [data-cid]{padding:8px;min-height:35px}</style>'+html);page.add_script_tag(content=(R/'teams-probe/schedule-core.js').read_text());page.add_script_tag(content=source)
 def row(n,prefix='participantsFromMeeting-',organizer=True):return '<div data-cid="roster-participant" data-tid="'+prefix+n+'"><span title="'+n+'">'+n+'</span>'+('<span data-tid="ts-roster-organizer-status">المنظّم</span>' if organizer else '')+'</div>'
 def decide():return page.evaluate("""async()=>{const o=await readerTest.scanOrganizerAcrossPage('اسم من الجدول مختلف',readerTest.findSections());const d=o.inInvitees?{status:'absent'}:MirsadScheduleCore.classifyOrganizerMembership(o.name,o.invitedText,o.inviteesReadable,o.fullyScanned,o.presentText);return {name:o.name,status:d.status,invited:o.inInvitees,present:o.presentText}}""")
 for label in ['تمت دعوة الآخرين (2)','من تمت دعوتهم (٢)','من تم دعوتهم (2)','Invited participants (2)']:
  setup('<h3>الحضور (1)</h3>'+row('طالب أول',organizer=False)+'<h3>'+label+'</h3>'+row(name,'participantsInCall-')+row('طالب ثان',organizer=False))
  r=decide();assert r['name']==name and r['status']=='absent' and r['invited'],(label,r)
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (1)</h3>'+row('طالب آخر',organizer=False));assert decide()['status']=='present'
 setup('<h3>منظمو الاجتماع</h3>'+row(name)+'<h3>من تمت دعوتهم (1)</h3>'+row('طالب آخر',organizer=False));assert decide()['status']=='present'
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (1)</h3>'+row(name));assert decide()['status']=='absent'
 for label in ['من تمت دعوتهم (2)','من تمت دعوتهم ٢']:
  setup('<h3>منظمو الاجتماع</h3>'+row(name)+'<h3>'+label+'</h3>'+row('طالب آخر',organizer=False));assert decide()['status']=='present'
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (0)</h3>');assert decide()['status']=='present'
 setup('<h3>الحضور (1)</h3>'+row('طالب أول',organizer=False)+'<h3>من تمت دعوتهم (1)</h3>'+row('طالب آخر',organizer=False));assert decide()['status']=='unresolved'
 setup('<h3>الحضور (2)</h3>'+row(name,'participantsInCall-')+row('طالب حاضر',organizer=False)+'<h3>من تمت دعوتهم (3)</h3>'+row('طالب غائب',organizer=False)+row('طالب حاضر',organizer=False)+row(name))
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'absent'})",name)
 assert audit['available'] and audit['invitedNames']==['طالب غائب'],audit
 assert 'presentText' not in audit
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (4)</h3>'+row('طالب غائب',organizer=False))
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present'})",name)
 assert not audit['available'] and 'invitedNames' not in audit,audit
 setup('<h3>من تمت دعوتهم (1)</h3>'+row('طالب غائب',organizer=False))
 assert not page.evaluate("async()=>readerTest.captureInvitedStudents({teacher:'معلم'},{teacher:'معلم',status:'present'})")['available']
 # A previously verified organizer may be unmounted from the virtual roster.
 setup('<h3>من تمت دعوتهم (3)</h3>'+row('طالب معروف',organizer=False)+'<div data-cid="roster-participant">صف لم يكتمل تحميله</div>')
 audit=page.evaluate("async()=>readerTest.captureInvitedStudents({teacher:'معلم موثق'},{teacher:'معلم موثق',status:'present',organizerVerified:true})")
 assert not audit['available'] and 'invitedNames' not in audit,audit
 setup('<h3>من تمت دعوتهم (1)</h3>'+row('طالب معروف',organizer=False))
 audit=page.evaluate("async()=>readerTest.captureInvitedStudents({teacher:'معلم موثق'},{teacher:'معلم موثق',status:'present',organizerVerified:true})")
 assert audit['available'] and audit['complete'] and audit['invitedNames']==['طالب معروف'],audit
 # Without prior organizer proof, the same page still cannot supply an audit.
 assert not page.evaluate("async()=>readerTest.captureInvitedStudents({teacher:'معلم موثق'},{teacher:'معلم موثق',status:'present'})")['available']
 # Fluent uses treeitem for GROUP HEADERS too, not just participant rows.
 setup('<div role="treeitem"><span>الحضور (1)</span></div>'+row(name,'participantsInCall-')+'<div role="treeitem"><span>من تمت دعوتهم (2)</span></div>'+row('طالب أول',organizer=False)+row('طالب ثان',organizer=False))
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present',organizerVerified:true})",name)
 assert audit['available'] and audit['complete'] and set(audit['invitedNames'])=={'طالب اول','طالب ثان'},audit
 # Modern Teams student rows may only expose Fluent treeitem/persona fields,
 # while the organizer and one row still use the legacy participant attributes.
 modern=lambda n:'<div role="treeitem" style="height:48px"><div class="fui-TreeItemPersonaLayout__main"><span title="'+n+'">'+n+'</span></div></div>'
 students=['طالب غائب '+str(i) for i in range(1,9)]
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (8)</h3>'+row(students[0],organizer=False)+''.join(modern(n) for n in students[1:]))
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present'})",name)
 assert audit['available'] and set(audit['invitedNames'])==set(students) and audit['complete'],audit
 # A per-person RSVP status is not a new roster section boundary.
 supplied=['فهد سالم البركه','تركي بن غازي بن علي الشهري','سعود علي خبراني','طلال عبدالرحمن السريهيد','عبدالله محمد آل شايب','نايف سلطان العتيبي','نواف مبارك القحطاني','مبارك سعود الشمري']
 setup('<h3>الحضور (1)</h3>'+row('اسامة اليحيى','participantsInCall-')+'<h3>من تمت دعوتهم (8)</h3>'+''.join(modern(n).replace('</span>','</span><span>لا توجد استجابة</span>') for n in supplied))
 audit=page.evaluate("async()=>readerTest.captureInvitedStudents({teacher:'اسامة اليحيى'},{teacher:'اسامة اليحيى',status:'present'})")
 assert audit['available'] and audit['complete'] and set(audit['invitedNames'])=={n.replace('آ','ا') for n in supplied},audit
 # Only the invited roster's "more" button is expanded, not unrelated UI.
 setup('<button id="outsideMore" onclick="window.wrongClick=true">المزيد</button><section><div role="treeitem"><span>الحضور (1)</span></div>'+row(name,'participantsInCall-')+'<div role="treeitem"><span>من تمت دعوتهم (8)</span></div><div id="moreNames">'+modern(students[0])+'</div><button id="rosterMore">المزيد</button></section>')
 page.evaluate("""(names)=>document.querySelector('#rosterMore').onclick=()=>{document.querySelector('#moreNames').innerHTML=names.map(n=>'<div role="treeitem"><div class="fui-TreeItemPersonaLayout__main"><span title="'+n+'">'+n+'</span></div><span>لا توجد استجابة</span></div>').join('');document.querySelector('#rosterMore').remove()}""",students)
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present'})",name)
 assert audit['complete'] and set(audit['invitedNames'])==set(students),audit
 assert not page.evaluate('Boolean(window.wrongClick)')
 setup('<section><h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (1)</h3>'+row('طالب وحيد',organizer=False)+'<button>المزيد</button></section>')
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present',organizerVerified:true})",name)
 assert not audit['available'] and 'invitedNames' not in audit,audit
 # A virtualized list replaces its rows while the viewport scrolls.
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+modern('طالب حاضر')+'<h3>من تمت دعوتهم (40)</h3><div id="studentViewport" style="height:120px;overflow-y:auto;position:relative"><div style="height:2000px"><div id="studentWindow" style="position:absolute;top:0"></div></div></div>')
 page.evaluate("""()=>{const el=document.querySelector('#studentViewport'),win=document.querySelector('#studentWindow');const draw=()=>{const start=Math.min(37,Math.floor(el.scrollTop/50));win.style.top=el.scrollTop+'px';win.innerHTML=Array.from({length:3},(_,i)=>'<div role="treeitem" style="height:40px"><div class="fui-TreeItemPersonaLayout__main"><span title="غائب '+(start+i)+'">غائب '+(start+i)+'</span></div></div>').join('')};el.addEventListener('scroll',draw);draw()}""")
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present'})",name)
 assert audit['available'] and audit['complete'] and len(audit['invitedNames'])==40,audit
 assert 'طالب حاضر' not in audit['invitedNames'] and page.locator('#studentViewport').evaluate('(el)=>el.scrollTop')==0
 # Nested overflow: an inner scrollable row must not hide the real roster
 # viewport. Teams can also append another page after reaching the old bottom.
 setup('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (30)</h3><div id="outerRoster" style="height:120px;overflow-y:hidden;position:relative"><div id="rosterSpace" style="height:750px"><div id="rosterWindow" style="position:absolute;top:0"></div></div></div>')
 page.evaluate("""()=>{const el=document.querySelector('#outerRoster'),win=document.querySelector('#rosterWindow');let loaded=false;const draw=()=>{const count=loaded?30:15,start=Math.min(count-3,Math.floor(el.scrollTop/50));win.style.top=el.scrollTop+'px';win.innerHTML=Array.from({length:3},(_,i)=>'<div role="treeitem" style="height:40px"><div class="fui-TreeItemPersonaLayout__main"><span title="مدعو '+(start+i)+'">مدعو '+(start+i)+'</span></div>'+(i===0?'<div style="height:10px;overflow:auto"><div style="height:35px">رمز</div></div>':'')+'</div>').join('');if(!loaded&&el.scrollTop>=el.scrollHeight-el.clientHeight-2)setTimeout(()=>{loaded=true;document.querySelector('#rosterSpace').style.height='1500px';draw()},320)};el.addEventListener('scroll',draw);draw()}""")
 audit=page.evaluate("async(name)=>readerTest.captureInvitedStudents({teacher:name},{teacher:name,status:'present'})",name)
 assert audit['available'] and audit['complete'] and len(audit['invitedNames'])==30,audit
 assert 'مدعو 29' in audit['invitedNames']
 # Exercise the direct scan message as well as the automatic-run handshake.
 page.goto('about:blank');page.set_content('<h3>الحضور (1)</h3>'+row(name,'participantsInCall-')+'<h3>من تمت دعوتهم (2)</h3>'+row('طالب أول',organizer=False)+row('طالب ثان',organizer=False))
 page.evaluate("()=>{window.__mirsadAutoPageHandshake=true;window.chrome={runtime:{onMessage:{addListener:fn=>window.scanListener=fn}}}}")
 page.add_script_tag(content=(R/'teams-probe/schedule-core.js').read_text());page.add_script_tag(content=(R/'teams-probe/content.js').read_text())
 direct=page.evaluate("(name)=>new Promise(resolve=>scanListener({type:'MIRSAD_AUTO_SCAN',teacher:name},{},resolve))",name)
 assert direct['status']=='present' and direct['organizerVerified'] and set(direct['studentAttendance']['invitedNames'])=={'طالب اول','طالب ثان'},direct
 b.close();print('PASS all 40 virtualized invitees, per-student RSVP statuses, modern persona rows and organizer identity comes from its badge; invited wins even with misleading in-call row ID, Arabic/English labels and conflicting presence; invitee count mismatch does not block presence; identified organizer outside invitees means present')
