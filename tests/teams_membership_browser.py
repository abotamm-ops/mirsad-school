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
 assert audit['available'] and not audit['complete'] and audit['invitedNames']==['طالب غائب'],audit
 setup('<h3>من تمت دعوتهم (1)</h3>'+row('طالب غائب',organizer=False))
 assert not page.evaluate("async()=>readerTest.captureInvitedStudents({teacher:'معلم'},{teacher:'معلم',status:'present'})")['available']
 b.close();print('PASS organizer identity comes from its badge; invited wins even with misleading in-call row ID, Arabic/English labels and conflicting presence; invitee count mismatch does not block presence; identified organizer outside invitees means present')
