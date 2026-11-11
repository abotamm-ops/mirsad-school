"""Exercise the actual schools popup, including its existing bundled handlers."""
from pathlib import Path
from urllib.parse import urlsplit
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
fixture = (ROOT / 'tests/popup_single_page_browser.py').read_text().split("page.add_init_script('''", 1)[1].split("''')", 1)[0]
with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width':440,'height':650})
    errors = []
    page.on('pageerror', lambda error: errors.append(error.stack))
    def route(request):
        file = ROOT / 'schools/extension' / urlsplit(request.request.url).path.lstrip('/')
        if file.is_file(): request.fulfill(path=str(file))
        else: request.abort()
    page.route('**/*', route)
    page.add_init_script(fixture + '''
      chrome.storage.onChanged={addListener:()=>{}};
      chrome.windows={update:async()=>({})};
      chrome.runtime.getManifest=()=>({name:'مرصاد المدارس',version:'2.4.0'});
      const originalSend=chrome.runtime.sendMessage;
      chrome.runtime.sendMessage=async m=>{
        if(m.type==='MIRSAD_SCHOOL_LOGIN'){
          messages.push(m);
          if(m.password==='wrong')return {ok:false,error:'كلمة المرور غير صحيحة'};
          Object.assign(state,{mirsadDriveConfig:{key:'fixture-session'},mirsadCommercialSchool:{id:'fixture-school',email:m.email}});
          return {ok:true};
        }
        if(m.type==='MIRSAD_SCHOOL_LOGOUT'){messages.push(m);delete state.mirsadDriveConfig;delete state.mirsadCommercialSchool;return {ok:true}}
        return originalSend(m);
      };
    ''')
    page.goto('https://popup.test/popup.html')
    page.wait_for_selector('#school-login')
    assert page.locator('#school-email').is_visible()
    assert page.locator('#start').is_hidden()
    page.locator('#school-email').fill('school@example.test')
    page.locator('#school-password').fill('wrong')
    page.locator('#school-login button').click()
    page.wait_for_function("document.querySelector('#school-login-feedback').textContent.includes('غير صحيحة')")
    assert page.locator('#school-login').is_visible()
    page.locator('#school-password').fill('fixture-password')
    page.locator('#school-login button').click()
    page.wait_for_selector('#start')
    assert page.locator('#school-password').input_value() == ''
    assert page.locator('#school-login').is_hidden()
    assert not errors, errors
    assert page.locator('#start').inner_text() == 'رصد'
    assert page.locator('#begin-day').is_hidden()
    assert page.locator('#startPeriod').is_hidden()
    assert page.locator('#start-now').is_hidden()
    assert page.locator('#calendarPilot').is_hidden()
    assert page.locator('#collectMadrasati').is_visible()
    assert page.locator('#open-teachers').is_visible()
    page.locator('.school-timing summary').click()
    page.locator('#periodDuration').fill('40')
    page.locator('#save-time').click()
    page.wait_for_function("messages.some(m=>m.type==='MIRSAD_SAVE_SCHEDULE_SETTINGS'&&m.settings.periodDuration===40)")
    page.locator('#advanced-settings > summary').click()
    assert page.locator('#startPeriod').is_visible()
    assert page.locator('#show-links').is_visible()
    assert page.locator('#calendarPilot').is_visible()
    page.locator('#startPeriod').select_option('7')
    page.locator('#endPeriod').select_option('7')
    page.locator('#save-time').click()
    page.wait_for_function("messages.some(m=>m.type==='MIRSAD_SAVE_SCHEDULE_SETTINGS'&&m.settings.startPeriod===7&&m.settings.endPeriod===7)")
    page.locator('#advanced-settings > summary').click()
    page.locator('#start').click()
    page.wait_for_function("messages.some(m=>m.type==='MIRSAD_START')")
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
    page.screenshot(path='/tmp/schools-simple-popup.png', full_page=True)
    page.locator('#advanced-settings > summary').click()
    page.locator('#school-logout').click()
    page.wait_for_selector('#school-login')
    assert page.locator('#start').is_hidden()
    assert not errors, errors
    browser.close()
print('PASS schools login/failure/logout, advanced controls, timing/range save, start command and popup width')
