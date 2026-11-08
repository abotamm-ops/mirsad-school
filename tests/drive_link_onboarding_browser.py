from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
SCRIPT=(ROOT/'schools/drive-link.js').read_text()
HTML='''<!doctype html><html lang="ar" dir="rtl"><body><main><section id="profilePanel" hidden><section id="schoolDriveLink"><p id="schoolDriveState"></p><div id="schoolDriveReminder" hidden></div><button id="connectSchoolDrive" disabled>ربط</button><a id="schoolDriveFolder" hidden></a></section></section></main></body></html>'''
def setup(browser,email='school@gmail.com',connected=False,monitor=False):
    page=browser.new_page(viewport={'width':390,'height':844})
    page.route('https://mirsad-test.invalid/**',lambda r:r.fulfill(status=200,body='<html><body><main></main></body></html>' if monitor else HTML,content_type='text/html'))
    page.goto('https://mirsad-test.invalid/schools/'+('automatic-monitoring.html' if monitor else 'school-settings.html'))
    page.evaluate('''({email,connected,monitor})=>{
      window.calls=[];window.opened=[];window.popupBlocked=false;
      window.drive={configured:true,connected,email:'drive-school@gmail.com',fromDate:'2026-11-08',folderUrl:connected?'https://drive.google.com/drive/folders/school-A':null};
      window.MirsadSchoolAccount={id:'school-A',email};
      window.MirsadCommercialConfig={sessionKey:'school-session',api:async action=>{
        calls.push(action);if(action==='commercialDriveStatus')return {drive:structuredClone(drive)};
        if(action==='adminLogin')return {school:MirsadSchoolAccount};
        if(action==='commercialDriveBegin')return {authorizationUrl:'https://accounts.google.com/o/oauth2/v2/auth?state=TEST_STATE&nonce=TEST_NONCE&code_challenge=TEST_PKCE&redirect_uri=https%3A%2F%2Fmirsad-test.invalid%2Fschools%2Fgoogle-drive-callback.html&prompt=consent+select_account'};
        throw Error('unexpected '+action);
      }};
      window.open=()=>popupBlocked?null:{closed:false,location:{replace:url=>opened.push(url)},close(){this.closed=true}};
      if(monitor){localStorage.setItem('school-session','admin-token');window.MirsadAdminAccess={ready:new Promise(r=>window.finishLogin=r)}}
    }''',{'email':email,'connected':connected,'monitor':monitor})
    page.add_script_tag(content=SCRIPT)
    return page
def login(page):
    page.evaluate("localStorage.setItem('school-session','admin-token');document.querySelector('#profilePanel').hidden=false")
    page.wait_for_function("document.querySelector('#schoolDriveLoginNotice')")
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    page=setup(browser)
    assert page.evaluate('calls.length')==0
    assert page.locator('#schoolDriveWelcome').count()==0
    login(page);page.wait_for_function("document.querySelector('#schoolDriveWelcome')?.open")
    assert 'school@gmail.com' in page.locator('[data-drive-account]').inner_text()
    assert page.locator('[data-drive-same]').is_visible()
    assert page.evaluate('opened.length')==0
    page.locator('[data-drive-same]').click();page.wait_for_function('opened.length===1')
    query=parse_qs(urlparse(page.evaluate('opened[0]')).query)
    assert query['login_hint']==['school@gmail.com'] and query['prompt']==['consent']
    assert query['state']==['TEST_STATE'] and query['code_challenge']==['TEST_PKCE'] and query['nonce']==['TEST_NONCE']
    assert not page.locator('#schoolDriveLoginNotice').inner_text().startswith('حساب Google مرتبط')
    page.evaluate("drive.connected=true;drive.folderUrl='https://drive.google.com/drive/folders/school-A';dispatchEvent(new MessageEvent('message',{origin:location.origin,data:{source:'mirsad-school-drive',type:'linked'}}))")
    page.wait_for_function("!document.querySelector('#schoolDriveWelcome').open")
    assert 'حساب Google مرتبط' in page.locator('#schoolDriveLoginNotice').inner_text()
    page.close();print('PASS Gmail choice appears only after school login, preserves OAuth state/PKCE, waits for verified connection')
    page=setup(browser);login(page);page.locator('[data-drive-other]').click();page.wait_for_function('opened.length===1')
    query=parse_qs(urlparse(page.evaluate('opened[0]')).query)
    assert 'login_hint' not in query and query['prompt']==['consent select_account']
    page.close();print('PASS Gmail can choose another Google account')
    page=setup(browser,'school@hotmail.com');login(page)
    assert not page.locator('[data-drive-same]').is_visible()
    assert page.locator('[data-drive-other]').is_visible()
    assert 'لم يُفعّل' in page.locator('#schoolDriveWelcome').inner_text()
    page.locator('[data-drive-later]').click();assert not page.locator('#schoolDriveWelcome').is_visible()
    assert page.locator('#schoolDriveLoginNotice').is_visible()
    page.close();print('PASS non-Gmail school sees strong truthful warning and persistent reminder when deferred')
    page=setup(browser,connected=True);login(page)
    assert page.locator('#schoolDriveWelcome').count()==0
    assert 'drive-school@gmail.com' in page.locator('#schoolDriveLoginNotice').inner_text()
    assert 'commercialDriveBegin' not in page.evaluate('calls')
    page.close();print('PASS connected schools get confirmation without another consent prompt')
    page=setup(browser);login(page);page.evaluate('popupBlocked=true');page.locator('[data-drive-same]').click()
    assert 'اسمح بفتح' in page.locator('[data-drive-error]').inner_text()
    assert 'commercialDriveBegin' not in page.evaluate('calls')
    page.close();print('PASS blocked popup reports actual failure without claiming a connection')
    page=setup(browser,monitor=True)
    assert page.evaluate('calls.length')==0
    page.evaluate("finishLogin();dispatchEvent(new Event('mirsad-admin-login'))")
    page.wait_for_function("document.querySelector('#schoolDriveWelcome')?.open")
    assert page.evaluate("calls.filter(a=>a==='commercialDriveStatus').length")==1
    page.close();print('PASS monitoring dashboard prompts after authenticated school login and coalesces duplicate events')
    browser.close()
