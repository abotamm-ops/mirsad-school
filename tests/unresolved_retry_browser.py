"""The final cycle displays present and the retry note while retaining diagnostic history."""
from pathlib import Path
from urllib.parse import urlsplit
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
R=Path(__file__).resolve().parents[1]
note='تمت إعادة الفحص 2 مرة ضمن الدورة 1 لنفس المعلم والحصة بسبب نتيجة غير محسومة.'
data={'ok':True,'snapshot':{'date':'2026-10-20','roundCount':1,'teachers':[{'id':'a','name':'معلم الاختبار'}],'lessons':[{'teacherId':'a','teacherName':'معلم الاختبار','period':1,'url':'https://teams.microsoft.com/l/meetup-join/test','subject':'علوم','className':'أول أ'}]},'records':[{'scanId':'diagnostic','teacherId':'a','period':1,'cycle':1,'status':'unresolved','scannedAt':1792470600000,'detail':'فشل أولي'},{'scanId':'final','teacherId':'a','period':1,'cycle':1,'status':'present','scannedAt':1792470601000,'detail':note}]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.add_init_script("try{localStorage.setItem('mirsad_archive_password_v1','fixture-admin')}catch{}");page.clock.install(time=datetime(2026,10,20,13,tzinfo=timezone.utc))
 page.route('https://mirsad-school.onrender.com/**',lambda r:r.fulfill(path=str(R/urlsplit(r.request.url).path.lstrip('/'))))
 page.route('https://script.google.com/**',lambda r:r.fulfill(json={'ok':True,'role':'admin'} if r.request.post_data_json['action']=='adminLogin' else {'ok':True,'dates':['2026-10-20'],'authMode':'site-password'} if r.request.post_data_json['action']=='dates' else data))
 page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.wait_for_selector('#todayTable .lesson-state.present')
 assert page.locator('#todayTable .lesson-state.present').inner_text()=='حاضر'
 page.locator('#todayTable .round-info').click();page.wait_for_selector('#details[open]')
 assert page.locator('.round-result').count()==1 and 'حاضر' in page.locator('.round-result').inner_text()
 assert page.locator('.round-result.unresolved').count()==0
 assert note in page.locator('#detailBody').inner_text()
 b.close();print('PASS actual report UI: one present cycle, no unresolved cycle, retry note visible in lesson details')
