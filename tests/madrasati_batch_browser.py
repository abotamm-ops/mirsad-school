"""Verify concurrent inert detail fetches, exact URL/result pairing and safe missing-link handling."""
from pathlib import Path
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
A=Path('/workspace/attachments/5801f446-efd2-4b82-a33e-cc1615c0b1a4')
html=next(A.glob('*.html')).read_text() if A.exists() else '<h6 class="titlesection2">تكليفات الحصة</h6><a href="https://teams.microsoft.com/l/meetup-join/fixture">رابط التسجيل</a>'
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.route('**/*',lambda r:r.abort());page.set_content('<meta charset="utf-8">')
 page.evaluate('globalThis.chrome={runtime:{onMessage:{addListener(){}}}}');page.add_script_tag(path=str(R/'teams-probe/madrasati-reader.js'));page.evaluate('(html)=>globalThis.fixtureHtml=html',html)
 page.evaluate(r'''()=>{globalThis.active=0;globalThis.peak=0;globalThis.requests=[];globalThis.executed=false;globalThis.fetch=async(url,options)=>{requests.push({url,options:{method:options.method,credentials:options.credentials,redirect:options.redirect}});active++;peak=Math.max(peak,active);const id=new URL(url).searchParams.get('Data');await new Promise(r=>setTimeout(r,id==='0'?160:40));active--;if(id==='5')return {ok:false,status:403};if(id==='6')return {ok:true,url:'https://schools.madrasati.sa/Account/Login',text:async()=>'<h1>الدخول</h1>'};return {ok:true,url,text:async()=>id==='4'?'<h6 class="titlesection2">تكليفات الحصة</h6>':fixtureHtml.replace(/https:\/\/teams.microsoft.com\/l\/meetup-join\/[^" ]+/g,'https://teams.microsoft.com/l/meetup-join/fixture'+id)+'<script>globalThis.executed=true</script>'}}}''')
 urls=['https://schools.madrasati.sa/Teacher/Lessons/viewLectureDetails?Data='+str(i) for i in range(7)]
 results=page.evaluate('(urls)=>MirsadMadrasatiReader.meetingBatch(urls)',urls)
 assert page.evaluate('peak')==4
 assert [x['detailUrl'] for x in results]==urls
 assert all(x['ok'] and x['url'].endswith('fixture'+str(i)) for i,x in enumerate(results[:4]))
 assert results[4]['ok'] and results[4]['unprepared'] and not results[4]['url']
 assert not results[5]['ok'] and not results[6]['ok']
 assert page.evaluate('executed') is False
 assert all(r['options']=={'method':'GET','credentials':'same-origin','redirect':'error'} for r in page.evaluate('requests'))
 for bad in [['https://evil.example/details'],['https://schools.madrasati.sa/Home/Delete'],urls+urls[:1]]:
  try:page.evaluate('(urls)=>MirsadMadrasatiReader.meetingBatch(urls)',bad);raise AssertionError('invalid batch accepted')
  except Exception as e:assert 'invalid batch accepted' not in str(e)
 assert len(page.evaluate('requests'))==7
 print('PASS four parallel detail GETs; stable lesson mapping despite out-of-order replies; completed missing link; HTTP/session errors; no scripts execute; foreign/write routes rejected');b.close()
