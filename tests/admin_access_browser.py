from playwright.sync_api import sync_playwright
from pathlib import Path
import json
root=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(headless=True,executable_path='/usr/bin/chromium',args=['--no-sandbox']);c=b.new_context();calls=[];state={"offline":False}
 def route(r):
  if 'script.google.com' in r.request.url:
   if state['offline']:r.abort();return
   data=r.request.post_data_json;calls.append(data);valid=data.get('key')=='correct'
   r.fulfill(content_type='application/json',body=json.dumps({'ok':valid,'role':'admin' if valid else None,'error':'كلمة المرور غير صحيحة'}));return
  path=r.request.url.split('test.local')[-1].split('?')[0]
  if path=='/':r.fulfill(content_type='text/html',body='<html dir="rtl"><head><meta charset="utf-8"><link rel="stylesheet" href="/admin-access.css"><script defer src="/admin-access.js"></script></head><body><main>SECRET</main></body></html>')
  else:r.fulfill(path=str(root/path.lstrip('/')))
 c.route('**/*',route);page=c.new_page();page.goto('https://test.local/');assert not page.locator('main').is_visible()
 page.locator('input').fill('wrong');page.locator('button').click();page.wait_for_function("document.querySelector('[role=status]').textContent.includes('غير صحيحة')");assert not page.locator('main').is_visible()
 page.locator('input').fill('correct');page.locator('button').click();page.wait_for_selector('html.mirsad-admin-ready');assert page.locator('main').is_visible()
 state['offline']=True;page.reload();page.wait_for_function("document.querySelector('[role=status]').textContent.includes('تعذر الاتصال')");assert not page.locator('input').is_visible();assert page.evaluate("localStorage.getItem('mirsad_archive_password_v1')")=='correct';assert page.locator('main').is_visible();assert not page.locator('#mirsad-admin-access').is_visible();state['offline']=False;page.wait_for_selector('.mirsad-admin-logout');page.reload();page.wait_for_selector('.mirsad-admin-logout');assert page.locator('#mirsad-admin-access').count()==0
 page.locator('.mirsad-admin-logout').click();page.wait_for_selector('#mirsad-admin-access');assert not page.locator('main').is_visible();b.close();print('PASS login, invalid password, persisted reload, logout')
