from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import datetime,timezone
from urllib.parse import urlsplit,parse_qs
import json
R=Path(__file__).resolve().parents[1]
naqar={'updatedAt':'2026-10-20T06:00:00Z','teachers':['معلم نقار'],'lessons':[{'teacher':'معلم نقار','cellIndex':2,'lesson':'أولى','title':'حصة','time':'06:30','teams':'https://teams.microsoft.com/l/meetup-join/naqar'}]}
madrasati={'source':'madrasati','scheduleDate':'2026-10-20','updatedAt':'2026-10-20T06:10:00Z','teachers':['معلم مدرستي','معلم بلا حصص'],'lessons':[{'teacher':'معلم مدرستي','cellIndex':2,'lesson':'أولى','title':'درس مدرستي','time':'06:30','teams':'https://teams.microsoft.com/l/meetup-join/madrasati'}]}
state={'mode':'naqar','payload':None};counts={'naqar':0}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.clock.install(time=datetime(2026,10,20,6,tzinfo=timezone.utc));page.add_init_script("localStorage.setItem('mirsad_archive_password_v1','fixture-password')")
 def route(r):
  url=r.request.url
  if url.startswith('https://mirsad-school.onrender.com/'):
   path=urlsplit(url).path
   if path=='/':r.fulfill(content_type='text/html',body='<html dir="rtl"><meta charset="utf-8"><main><span id="count"></span><input id="search"><a id="absence-banner"></a><table><tbody id="body"></tbody></table></main><script>window.MirsadAdminAccess={ready:Promise.resolve()}</script><script src="/shared.js"></script></html>')
   else:r.fulfill(path=str(R/path.lstrip('/')))
  elif r.request.method=='POST':r.fulfill(json={'ok':True,**state})
  else:
   counts['naqar']+=1;cb=parse_qs(urlsplit(url).query)['callback'][0];r.fulfill(content_type='application/javascript',body=cb+'('+json.dumps({'ok':True,'payload':naqar})+')')
 page.route('**/*',route);page.goto('https://mirsad-school.onrender.com/');page.wait_for_function("document.querySelector('#body').textContent.includes('معلم نقار')")
 state['mode']='madrasati';page.clock.run_for(15010);page.wait_for_function("document.documentElement.dataset.mirsadSource==='madrasati'");assert page.locator('#body tr').count()==0
 previous=counts['naqar'];state['payload']=madrasati;page.clock.run_for(15010);page.wait_for_function("document.querySelector('#body').textContent.includes('معلم مدرستي')");assert page.locator('#body tr').count()==2;assert page.locator('#body a.teams').count()==1;assert page.locator('#body a.teams').get_attribute('href').endswith('/madrasati');assert counts['naqar']==previous
 state['payload']={**madrasati,'scheduleDate':'2026-10-18','importedForDate':'2026-10-20'};page.clock.run_for(15010);page.wait_for_function("document.documentElement.dataset.mirsadSourceDate==='2026-10-18'");assert page.locator('#body tr').count()==2;assert '2026-10-20' in page.locator('#mirsad-shared-status').inner_text()
 state['payload']={**madrasati,'scheduleDate':'2026-10-19'};page.clock.run_for(15010);page.wait_for_function("document.querySelector('#body').children.length===0");assert page.locator('#body a.teams').count()==0
 state['mode']='naqar';state['payload']=None;page.clock.run_for(15010);page.wait_for_function("document.querySelector('#body').textContent.includes('معلم نقار')");assert page.locator('#body tr').count()==1;state.update({'ok':False,'error':'صلاحية القراءة لا تسمح بالرفع'});page.reload();page.wait_for_function("document.querySelector('#body').textContent.includes('معلم نقار')");b.close();print('PASS Naqar stays unchanged, selected Madrasati populates site, never mixes sources, preserves teachers without lessons, blocks stale days')
