from pathlib import Path
from datetime import datetime,timezone
from playwright.sync_api import sync_playwright
import zipfile,io
R=Path(__file__).resolve().parents[1]
data={'ok':True,'snapshot':{'date':'2026-10-20','roundCount':3,'teachers':[{'id':'a','name':'المعلم الأول'},{'id':'b','name':'المعلم الثاني'},{'id':'c','name':'المعلم الحاضر'}],'lessons':[{'teacherId':t,'teacherName':n,'period':p,'url':'https://teams.microsoft.com/test','subject':'العلوم','className':'أولى'} for t,n,p in [('a','المعلم الأول',1),('b','المعلم الثاني',7),('c','المعلم الحاضر',2)]]},'records':[{'scanId':t+str(i),'teacherId':t,'period':p,'cycle':i,'status':'present' if t=='c' else 'absent','scannedAt':1792470600000+i} for t,p in [('a',1),('b',7),('c',2)] for i in [1,2,3]]}
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page();page.clock.install(time=datetime(2026,10,20,3,35,tzinfo=timezone.utc));errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 def local(r):
  name=r.request.url.split('mirsad-school.onrender.com/')[1].split('?')[0]
  if name=='admin-access.js':r.fulfill(content_type='text/javascript',body="document.documentElement.classList.add('mirsad-admin-ready');")
  else:r.fulfill(path=str(R/name))
 page.route('https://mirsad-school.onrender.com/**',local)
 page.route('https://script.google.com/**',lambda r:r.fulfill(json={'ok':True,'dates':['2026-10-20'],'authMode':'public'} if r.request.post_data_json['action']=='dates' else data))
 page.goto('https://mirsad-school.onrender.com/automatic-monitoring.html');page.locator('[data-view=reports]').click();page.wait_for_selector('.teacher-report-card');assert page.locator('#dailyReportsReady').inner_text()=='قيد الرصد';assert page.locator('#downloadDailyReports').is_disabled()
 page.clock.set_system_time(datetime(2026,10,20,9,tzinfo=timezone.utc));page.locator('#loadTeacherReports').click();page.wait_for_function("document.getElementById('dailyReportsReady').textContent==='جاهز'")
 with page.expect_download() as dl:page.locator('#downloadDailyReports').click()
 raw=Path(dl.value.path()).read_bytes();archive=zipfile.ZipFile(io.BytesIO(raw));assert len(archive.namelist())==2,archive.namelist();assert all(n.endswith('.pdf') and '2026-10-20' in n for n in archive.namelist());assert all(archive.read(n).startswith(b'%PDF-') for n in archive.namelist());assert any('المعلم الأول' in n for n in archive.namelist());assert not errors,errors
 with page.expect_download() as dl_word:page.locator('#downloadDailyReportsWord').click()
 wordzip=zipfile.ZipFile(io.BytesIO(Path(dl_word.value.path()).read_bytes()));assert len(wordzip.namelist())==2;assert all(n.endswith('.docx') for n in wordzip.namelist());assert all('word/document.xml' in zipfile.ZipFile(io.BytesIO(wordzip.read(n))).namelist() for n in wordzip.namelist())
 assert not page.locator('#teacherReportDate').is_visible();assert page.locator('#teacherReportSchool').get_attribute('type')=='hidden'
 page.locator('#teacherReportScope').select_option('previous');page.wait_for_function("document.getElementById('teacherReportFeedback').textContent.includes('لا توجد تقارير')");assert page.locator('#teacherReportDate').is_visible();assert page.locator('.teacher-report-card').count()==0;assert page.locator('#downloadDailyReports').is_disabled();assert page.locator('#downloadDailyReportsWord').is_disabled()
 page.locator('#teacherReportScope').select_option('today');page.wait_for_selector('.teacher-report-card');assert page.locator('#teacherReportDate').input_value()=='2026-10-20';assert not page.locator('#teacherReportDate').is_visible()
 print('PASS today/history selection, PDF and Word bundles, reports pending before school end, green ready after last lesson, one ZIP with two independent Arabic PDF letters, present teacher excluded');b.close()
