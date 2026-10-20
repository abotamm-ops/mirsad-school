from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
    page=browser.new_page()
    page.route('https://mirsad-test.invalid/**',lambda route:route.fulfill(status=200,body='<html><body>Configuration test</body></html>',content_type='text/html'))
    page.goto('https://mirsad-test.invalid/')
    page.evaluate('''()=>{const data={};window.chrome={storage:{local:{async get(){return data},async set(v){Object.assign(data,v)}}},alarms:{create(){},onAlarm:{addListener(){}}}}}''')
    page.add_script_tag(path=str(ROOT/'teams-probe/monitor-model.js'))
    page.add_script_tag(path=str(ROOT/'teams-probe/drive-sync.js'))
    result=page.evaluate("async()=>{await CloudMonitoring.configure('https://script.google.com/macros/s/test/exec','fixture'.repeat(8));await CloudMonitoring.flush();return CloudMonitoring.info()}")
    assert result['configured'] and 'بداية اليوم' in result['status']['text'] and 'تمت مزامنة' not in result['status']['text']
    print('PASS real IndexedDB empty queue: saved binding shown; no false upload-complete message')
    browser.close()
