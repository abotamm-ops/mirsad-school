from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox'])
 for width in [390,1280]:
  page=b.new_page(viewport={'width':width,'height':844});errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  def route(r):
   path=urlsplit(r.request.url).path
   if path=='/':r.fulfill(content_type='text/html',body='<html dir="rtl"><meta charset="utf-8"><link rel="stylesheet" href="live-heartbeat.css"><main></main><script src="live-heartbeat.js"></script></html>')
   else:r.fulfill(path=str(R/path.lstrip('/')))
  page.route('http://pulse.test/**',route);page.goto('http://pulse.test/');page.evaluate("window.pulse=MirsadLiveHeartbeat.attach(document.querySelector('main'));pulse.update({at:Date.now(),running:true,phase:'scanning',period:3,cycle:2},Date.now())")
  assert page.locator('.mirsad-heartbeat').get_attribute('data-mode')=='alive';assert page.locator('.heartbeat-dot').evaluate("e=>getComputedStyle(e).animationName")=='mirsadBeat';assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');page.screenshot(path=str(R/f'tests/live-pulse-{width}.png'))
  page.evaluate("pulse.update({at:Date.now()-76000,running:true},Date.now())");assert page.locator('.mirsad-heartbeat').get_attribute('data-mode')=='error';assert page.locator('.heartbeat-dot').evaluate("e=>getComputedStyle(e).animationName")=='none';assert 'توقف نبض' in page.locator('.mirsad-heartbeat strong').inner_text()
  page.evaluate("pulse.update({at:Date.now(),running:false,phase:'paused'},Date.now())");assert page.locator('.mirsad-heartbeat').get_attribute('data-mode')=='stopped';assert not errors,errors;page.close()
 b.close();print('PASS visible desktop/mobile pulse, no overflow, stale writer stops animation, explicit pause shown separately')
