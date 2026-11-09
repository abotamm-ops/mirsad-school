"""Exercise the real table/detail renderers in both dashboards with browser DOM."""
from pathlib import Path
from datetime import datetime, timezone
from playwright.sync_api import sync_playwright
import re

ROOT = Path(__file__).resolve().parents[1]
PRIMARY = 'https://teams.microsoft.com/l/meetup-join/primary'
CALENDAR = 'https://teams.microsoft.com/l/meetup-join/calendar'
PROOF = 'https://drive.google.com/file/d/primary-proof/view'
DATE = '2026-11-09'
STAMP = int(datetime(2026, 11, 9, 3, 35, tzinfo=timezone.utc).timestamp() * 1000)
fixture = {'snapshot': {'date': DATE, 'sourceScheduleDate': DATE, 'sourceType': 'madrasati', 'scheduleRevision': 'fixture-rev', 'roundCount': 1,
    'teachers': [{'id': 't1', 'name': 'معلم الاختبار'}], 'lessons': [
        {'teacherId': 't1', 'teacherName': 'معلم الاختبار', 'period': 1, 'subject': 'علوم', 'className': 'أول أ', 'url': PRIMARY, 'calendarUrl': CALENDAR},
        {'teacherId': 't1', 'teacherName': 'معلم الاختبار', 'period': 2, 'subject': 'رياضيات', 'url': PRIMARY, 'calendarUrl': PRIMARY+'?context=calendar#join'},
        {'teacherId': 't1', 'teacherName': 'معلم الاختبار', 'period': 3, 'subject': 'لغة', 'url': '', 'calendarUrl': CALENDAR}]},
    'records': [{'scanId': 'summary', 'teacherId': 't1', 'teacherName': 'معلم الاختبار', 'period': 1, 'cycle': 1, 'status': 'present', 'scannedAt': STAMP,
        'linkResults': [
            {'scanId': 'primary-scan', 'source': 'madrasati', 'url': PRIMARY, 'status': 'absent', 'detail': 'المعلم غير موجود في قائمة المشاركين', 'scannedAt': STAMP-1000, 'evidenceUrl': PROOF},
            {'scanId': 'calendar-scan', 'source': 'calendar', 'url': CALENDAR, 'status': 'present', 'detail': 'تم رصد المعلم من التقويم <script>window.injected=true</script>', 'scannedAt': STAMP}]}]}

with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    for prefix in ['', 'schools/']:
        page = browser.new_page(viewport={'width': 1250, 'height': 900})
        page.clock.install(time=datetime(2026, 11, 9, 3, 35, tzinfo=timezone.utc))
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        page.set_content('<html lang="ar" dir="rtl"><div id="todaySummary"></div><div id="todayTable"></div><dialog id="details"><h2 id="detailTitle"></h2><div id="detailBody"></div></dialog></html>')
        page.add_style_tag(path=str(ROOT / prefix / 'monitoring.css'))
        page.add_style_tag(path=str(ROOT / prefix / 'monitoring-unified.css'))
        page.add_script_tag(path=str(ROOT / 'teams-probe/schedule-core.js'))
        page.add_script_tag(path=str(ROOT / prefix / 'monitor-model.js'))
        page.add_script_tag(path=str(ROOT / prefix / 'calendar-links-ui.js'))
        source = (ROOT / prefix / 'monitoring.js').read_text()
        functions = '\n'.join(re.search(r'function '+name+r'\(.*?^}', source, re.S | re.M).group(0) for name in ['detail', 'renderTable'])
        page.evaluate('''source => {
            window.model=MirsadMonitorModel;window.$=id=>document.getElementById(id);
            window.text=(tag,value)=>{const node=document.createElement(tag);node.textContent=value;return node};
            window.stateLabel={present:'حاضر',absent:'غائب',unresolved:'غير محسوم',pending:'بانتظار الحصة'};
            window.renderedDays=new Map();window.publicAccess=true;window.MirsadAdminAccess={};
            window.MirsadLessonClock={setDay(){}};window.summaryCards=()=>{};window.applyScanHighlight=()=>{};
            window.cellPresentation=cell=>model.presentation(cell);window.readableDetail=value=>value;
            window.safeDrive=value=>value;window.dateText=value=>new Date(value).toISOString();window.status=()=>{};
            window.m22901649_0x431955=()=>{throw Error('Unexpected undecoded lookup')};
            window.saveManualLink=async request=>{window.savedRequest=request;const lesson=fixture.snapshot.lessons.find(l=>l.period===request.period);lesson.url=request.url};
            window.reloadReport=async()=>renderTable('todayTable',fixture);
            (0,eval)(source);
        }''', functions)
        page.evaluate('value=>{window.fixture=value;renderTable("todayTable",fixture)}', fixture)
        cell = page.locator('#todayTable td[data-period="1"]')
        assert page.locator('#todayTable tbody tr').count() == 1
        assert cell.locator('.lesson-state.present').count() == 1
        assert cell.locator('a.teams-lesson-link').all_text_contents() == ['مدرستي', 'تقويم تيمز']
        assert cell.locator('a.lesson-link-calendar').get_attribute('href') == CALENDAR
        assert cell.locator('a[href="'+PROOF+'"]').count() == 1
        assert page.locator('#todayTable td[data-period="2"] .teams-lesson-link').count() == 1
        assert page.locator('#todayTable td[data-period="3"] .lesson-link-calendar').count() == 1
        assert 'missing-link-cell' not in (page.locator('#todayTable td[data-period="3"]').get_attribute('class') or '')
        cell.locator('.round-info').click()
        assert page.locator('.round-results > .round-result').count() == 1
        assert page.locator('.round-results .link-result').count() == 2
        assert page.locator('.round-results .link-result-madrasati .link-result-status').inner_text() == 'مدرستي — غائب'
        assert page.locator('.round-results .link-result-calendar .link-result-status').inner_text() == 'تقويم تيمز — حاضر'
        assert page.locator('.round-results .link-result time').count() == 2
        assert page.locator('.round-results .link-result-madrasati .link-result-evidence').get_attribute('href') == PROOF
        assert 'تم رصد المعلم من التقويم <script>' in page.locator('.round-results .link-result-calendar').inner_text()
        assert not page.evaluate('Boolean(window.injected)')
        assert page.locator('#detailBody > .link-results .link-result').count() == 2
        assert page.get_by_role('combobox', name='الحالة المعتمدة').locator('option').count() == 5
        primary_color = cell.locator('.lesson-link-madrasati').evaluate('el=>getComputedStyle(el).color')
        calendar_color = cell.locator('.lesson-link-calendar').evaluate('el=>getComputedStyle(el).color')
        assert primary_color != calendar_color
        # The existing editor updates only the primary link; source evidence is retained.
        field = page.get_by_role('textbox', name='رابط تيمز للحصة')
        field.fill('https://teams.microsoft.com/meet/manual-replacement')
        page.get_by_role('button', name='حفظ رابط تيمز', exact=True).click()
        page.wait_for_selector('#details', state='hidden')
        assert page.evaluate('savedRequest.expectedUrl') == PRIMARY
        assert cell.locator('.lesson-link-calendar').get_attribute('href') == CALENDAR
        assert cell.locator('a[href="'+PROOF+'"]').count() == 1
        cell.locator('.round-info').click()
        assert field.input_value() == 'https://teams.microsoft.com/meet/manual-replacement'
        page.locator('#details').evaluate('el=>el.close()')
        page.evaluate("detail(model.cells(fixture)[0],'2026-11-08')")
        assert page.locator('#detailBody > .lesson-links .teams-lesson-link').count() == 2
        assert page.get_by_role('button', name='حفظ رابط تيمز', exact=True).count() == 0
        page.locator('#details').evaluate('el=>el.close()')
        page.set_viewport_size({'width': 390, 'height': 844})
        assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
        assert not errors, errors
        page.close()
    browser.close()
print('PASS both dashboard renderers: distinct source links, canonical duplicate suppression, calendar-only lessons, per-link cycle/history evidence, safe text, retained primary editor, archive and mobile layout')
