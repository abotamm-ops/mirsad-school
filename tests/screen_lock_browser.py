from pathlib import Path
from playwright.sync_api import sync_playwright
from datetime import datetime,timezone
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.route('https://fixture.invalid/**',lambda r:r.fulfill(path=str(R/r.request.url.rsplit('/',1)[-1])) if r.request.url.endswith(('.js','.css')) else r.fulfill(body='<html lang="ar" dir="rtl"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="mirsad-modern.css"><main></main><script src="screen-lock-alert.js"></script></html>',content_type='text/html'))
 page.add_init_script("window.tones=0;window.AudioContext=class {state='running';currentTime=0;destination={};async resume(){}createOscillator(){return {type:'sine',frequency:{value:0},connect(){},start(){window.tones++},stop(){}}}createGain(){return {gain:{setValueAtTime(){},linearRampToValueAtTime(){}},connect(){}}}}")
 page.clock.install(time=datetime(2026,11,5,6,tzinfo=timezone.utc));page.goto('https://fixture.invalid/test')
 def report(s,running=True):page.evaluate("([s,running])=>{const at=Date.now();window.dispatchEvent(new CustomEvent('mirsad-remote-day',{detail:{serverTime:at,heartbeat:{at,running,device:{sessionState:s,at}}}}))}",[s,running])
 report('idle');assert page.locator('.screen-lock-monitor').get_attribute('data-state')=='unlocked';assert page.evaluate('window.tones')==0
 report('locked');assert page.locator('.screen-lock-monitor').get_attribute('data-state')=='locked';assert 'مقفلة' in page.locator('[role=alert]').inner_text();assert page.evaluate('window.tones')==0
 page.get_by_role('button',name='تفعيل صوت تحذير القفل').click();assert page.evaluate('window.tones')==4
 page.clock.fast_forward(11000);assert page.evaluate('window.tones')>=8
 page.get_by_role('button',name='كتم التحذير دقيقة').click();before=page.evaluate('window.tones');page.clock.fast_forward(30000);assert page.evaluate('window.tones')==before
 report('active');assert page.locator('.screen-lock-monitor').get_attribute('data-state')=='unlocked';page.clock.fast_forward(30000);assert page.evaluate('window.tones')==before
 report('locked');page.clock.fast_forward(76000);assert page.locator('.screen-lock-monitor').get_attribute('data-state')=='unknown';before=page.evaluate('window.tones');page.clock.fast_forward(11000);assert page.evaluate('window.tones')==before
 page.evaluate("window.dispatchEvent(new Event('mirsad-remote-disconnected'))");assert page.locator('.screen-lock-monitor').get_attribute('data-state')=='unknown'
 report('locked',False);assert page.locator('.screen-lock-monitor').get_attribute('data-state')=='inactive';assert page.evaluate('document.documentElement.scrollWidth<=innerWidth');assert not errors,errors
 print('PASS mobile lock alarm: confirmed lock banner, opt-in repeated audio, minute mute, unlock, stale/unknown and stopped handling without false lock inference');b.close()
