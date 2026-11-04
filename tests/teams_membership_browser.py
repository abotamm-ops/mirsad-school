from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
name='سعد مبارك الدوسري'
source=(R/'teams-probe/content.js').read_text();needle='  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {';assert needle in source
source=source.replace(needle,"  globalThis.readerTest={findSections,scanOrganizerAcrossPage,participantRows,rosterHeadingsInOrder};return;\n"+needle,1)
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
 # Organizer search must rewind a deeply nested viewport opened at its bottom.
 for overflow in ['auto','hidden']:
  setup('<h3>الحضور (1)</h3><div id="organizerViewport" style="height:120px;overflow-y:'+overflow+';position:relative"><div style="height:1440px">'+'<div>'*12+'<div id="organizerWindow" style="position:absolute;top:0"></div>'+'</div>'*12+'</div></div><h3>من تمت دعوتهم (0)</h3>')
  page.evaluate("""name=>{const el=document.querySelector('#organizerViewport'),win=document.querySelector('#organizerWindow');window.rewoundOrganizer=false;const draw=()=>{win.style.top=el.scrollTop+'px';if(el.scrollTop<5){window.rewoundOrganizer=true;win.innerHTML='<div data-cid="roster-participant" data-tid="participantsInCall-'+name+'"><span title="'+name+'">'+name+'</span><span data-tid="ts-roster-organizer-status">المنظّم</span></div>'}else win.innerHTML='<div data-cid="roster-participant" data-tid="participantsInCall-اسم ظاهر"><span>اسم ظاهر</span></div>'};el.addEventListener('scroll',draw);el.scrollTop=1320;draw()}""",name)
  r=decide();assert r['name']==name and r['status']=='present' and page.evaluate('window.rewoundOrganizer'),(overflow,r)
 # Organizer can be below the first viewport, inside the invited group.
 setup('<h3>الحضور (0)</h3><h3>من تمت دعوتهم (30)</h3><div id="belowViewport" style="height:120px;overflow:auto;position:relative"><div style="height:1440px"><div id="belowWindow" style="position:absolute;top:0"></div></div></div>')
 page.evaluate("""name=>{const el=document.querySelector('#belowViewport'),win=document.querySelector('#belowWindow');const draw=()=>{win.style.top=el.scrollTop+'px';const found=el.scrollTop>=1250;win.innerHTML='<div data-cid="roster-participant" data-tid="participantsFromMeeting-'+(found?name:'اسم ظاهر')+'"><span>'+(found?name:'اسم ظاهر')+'</span>'+(found?'<span data-tid="ts-roster-organizer-status">المنظّم</span>':'')+'</div>'};el.addEventListener('scroll',draw);draw()}""",name)
 r=decide();assert r['name']==name and r['status']=='absent' and r['invited'],r
 # If the invited organizer is already visible at the bottom, retain that
 # view for the screenshot instead of rewinding away from the evidence.
 page.evaluate("()=>{const el=document.querySelector('#belowViewport');el.scrollTop=1320;el.dispatchEvent(new Event('scroll'))}")
 r=decide();assert r['status']=='absent' and page.locator('#belowViewport').evaluate('(el)=>el.scrollTop')>=1250,r
 # The pane can become scrollable only after Teams finishes rendering it.
 setup('<h3>الحضور (1)</h3><div id="delayedOrganizer" style="height:120px;overflow:auto;position:relative"><div id="delayedSpace" style="height:48px"><div id="delayedWindow" style="position:absolute;top:0"><div data-cid="roster-participant" data-tid="participantsInCall-اسم ظاهر"><span>اسم ظاهر</span></div></div></div></div><h3>من تمت دعوتهم (0)</h3>')
 page.evaluate("""name=>{const el=document.querySelector('#delayedOrganizer'),win=document.querySelector('#delayedWindow');window.delayedRewound=false;const draw=()=>{win.style.top=el.scrollTop+'px';if(el.scrollTop<5){window.delayedRewound=true;win.innerHTML='<div data-cid="roster-participant" data-tid="participantsInCall-'+name+'"><span>'+name+'</span><span data-tid="ts-roster-organizer-status">المنظّم</span></div>'}else win.innerHTML='<div data-cid="roster-participant" data-tid="participantsInCall-اسم ظاهر"><span>اسم ظاهر</span></div>'};el.addEventListener('scroll',draw);setTimeout(()=>{document.querySelector('#delayedSpace').style.height='1440px';el.scrollTop=1320;draw()},350)}""",name)
 r=decide();assert r['name']==name and r['status']=='present' and page.evaluate('window.delayedRewound'),r
 b.close();print('PASS organizer identity comes from its badge; invited wins even with misleading in-call row ID, Arabic/English labels and conflicting presence; invitee count mismatch does not block presence; identified organizer outside invitees means present')
