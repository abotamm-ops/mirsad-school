from pathlib import Path
from playwright.sync_api import sync_playwright
from urllib.parse import urlsplit
R=Path(__file__).resolve().parents[1]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page()
 page.route('**/*',lambda r:r.fulfill(path=str(R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/'))) if (R/'teams-probe'/urlsplit(r.request.url).path.lstrip('/')).is_file() else r.abort())
 page.goto('http://popup.test/popup.html')
 assert page.locator('#deepLinksPrompt').count()==0
 assert page.locator('#deepLinksAccept').count()==0
 assert page.locator('#cancelDeepSearch').count()==0
 assert 'MIRSAD_SOURCE_DEEP_SEARCH' not in (R/'teams-probe/madrasati-source.js').read_text()
 b.close();print('PASS deep-search prompt, buttons and command removed; ordinary load remains')
