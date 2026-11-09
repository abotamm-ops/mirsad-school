"""Bounded Teams Calendar DOM contract, using screenshot-derived semantic fixtures.

These fixtures are not captured Teams HTML and do not establish compatibility
with every Teams Calendar build. No login, token, private API, or meeting is used.
"""
from pathlib import Path
from html import escape
import json
from playwright.sync_api import sync_playwright

R = Path(__file__).resolve().parents[1]
DATE = '2026-11-09'
CALENDAR_URL = 'https://teams.microsoft.com/v2/#/calendarv2'
TEACHER = 'أحمد محمد'
OTHER_TEACHER = 'سامي الماجد'
BASE = 'https://teams.microsoft.com/l/meetup-join/'


def card(event_id, teacher, url=None, subject='عنوان مادة مختلف تمامًا', detail=False):
    link = '' if url is None else '<a href="' + escape(url, quote=True) + '" onclick="event.preventDefault();window.joinClicks++">Join</a>'
    return ('<div role="button" tabindex="0" data-tid="calendar-event" id="' + event_id + '"'
            + (' data-detail="true"' if detail else '')
            + ' style="display:inline-block;width:220px;min-height:48px;border:1px solid #777;margin:2px">'
            + '<div>' + escape(subject) + '</div><div>' + escape(teacher) + '</div>' + link + '</div>')


def calendar(rows=None, date=DATE, row_count=7):
    if rows is None:
        rows = {i: [card('event-' + str(i), TEACHER, BASE + 'period-' + str(i))] for i in range(1, 8)}
    # Deliberately mount later rows first. DOM insertion order does not identify
    # the first lesson; the full day's vertical ordering does.
    order = [7, 3, 1, 6, 2, 5, 4]
    grid = ''.join('<div role="row" aria-rowindex="' + str(i) + '" style="position:absolute;left:0;right:0;top:'
                   + str((i - 1) * 80) + 'px;height:80px">' + ''.join(rows[i]) + '</div>' for i in order if i in rows)
    selected = '' if date is None else '<time datetime="' + date + '">' + date + '</time>'
    return ('<meta charset="utf-8"><main aria-label="Calendar">' + selected
            + '<div role="grid" aria-label="Day calendar" aria-rowcount="' + str(row_count)
            + '" style="position:relative;height:560px;width:1100px">' + grid + '</div></main>')


def rejected(result):
    assert result.get('ok') is False and not result.get('events') and result.get('warnings'), result


with sync_playwright() as p:
    browser = p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox'])
    page = browser.new_page(viewport={'width': 1400, 'height': 1000})
    fixture = {'html': ''}
    requests = []

    def route(request):
        requests.append(request.request.url)
        if request.request.resource_type == 'document' and request.request.url.startswith('https://teams.microsoft.com/v2/'):
            request.fulfill(body=fixture['html'], content_type='text/html')
        else:
            request.abort()

    page.route('**/*', route)

    def load(html, url=CALENDAR_URL):
        fixture['html'] = html
        page.goto('about:blank')
        page.goto(url)
        page.evaluate('''() => {
          window.joinClicks=0;window.detailOpens=0;window.detailCloses=0;
          globalThis.chrome={runtime:{onMessage:{addListener(fn){window.calendarReaderListener=fn}}}};
          window.fetch=()=>{throw Error('Calendar reader must not call a private API')};
          XMLHttpRequest.prototype.open=()=>{throw Error('Calendar reader must not call a private API')};
          Storage.prototype.getItem=()=>{throw Error('Calendar reader must not collect stored credentials')};
        }''')
        page.add_script_tag(path=str(R / 'teams-probe/schedule-core.js'))
        page.add_script_tag(path=str(R / 'teams-probe/teams-calendar-reader.js'))

    def read(teachers=None, date=DATE):
        result = page.evaluate('''payload=>new Promise(resolve=>{
          const value=calendarReaderListener({type:'MIRSAD_TEAMS_CALENDAR_READ',...payload},{},resolve);
          if(value===false)resolve({unhandled:true});
        })''', {'date': date, 'teachers': teachers or [TEACHER]})
        assert page.evaluate('window.joinClicks') == 0, 'Join must never be clicked'
        return result

    # Full day, shuffled mounting order, multiple teachers in the same row.
    rows = {i: [card('event-' + str(i), TEACHER, BASE + 'period-' + str(i))] for i in range(1, 8)}
    rows[1].append(card('other-1', OTHER_TEACHER, BASE + 'other-period-1'))
    load(calendar(rows))
    probe = page.evaluate("new Promise(resolve=>calendarReaderListener({type:'MIRSAD_TEAMS_CALENDAR_PROBE'},{},resolve))")
    assert probe['ok'] and probe['isCalendar'] and probe.get('date') == DATE, probe
    assert page.evaluate('window.detailOpens') == 0
    result = read([TEACHER, OTHER_TEACHER])
    assert result['ok'] and result['date'] == DATE and len(result['events']) == 8, result
    assert {event['url']: event['period'] for event in result['events']} == {
        **{BASE + 'period-' + str(i): i for i in range(1, 8)}, BASE + 'other-period-1': 1
    }, result
    assert all(event.get('eventId') and event.get('teacherName') for event in result['events']), result
    assert all(event.get('title') == 'عنوان مادة مختلف تمامًا' for event in result['events']), result
    assert not result['warnings'], result

    # Names are canonicalized only for comparison; subject/class/time are not
    # conditions, and an unrelated teacher's card never supplies a requested URL.
    rows[1] = [card('vocalized-1', 'أَحمد محمد', BASE + 'vocalized')]
    rows[2] = [card('unrequested-2', 'معلم آخر', BASE + 'someone-else')]
    load(calendar(rows))
    result = read()
    assert result['ok'] and any(event['url'] == BASE + 'vocalized' and event['period'] == 1 for event in result['events']), result
    assert not any(event['url'] == BASE + 'someone-else' for event in result['events']), result

    # Two distinct meetings for the same requested teacher and row are ambiguous.
    # Repeated representations of the same meeting can be deduplicated.
    rows[1] = [card('ambiguous-1a', TEACHER, BASE + 'choice-a'), card('ambiguous-1b', TEACHER, BASE + 'choice-b')]
    load(calendar(rows))
    result = read()
    assert result['ok'] and not any(event['period'] == 1 for event in result['events']) and result['warnings'], result
    rows[1] = [card('duplicate-1a', TEACHER, BASE + 'same'), card('duplicate-1b', TEACHER, BASE + 'same')]
    load(calendar(rows))
    result = read()
    assert result['ok'] and len([event for event in result['events'] if event['period'] == 1]) == 1, result
    rows[1] = [card('ambiguous-owner', TEACHER + '\n' + OTHER_TEACHER, BASE + 'ambiguous-owner')]
    load(calendar(rows))
    result = read([TEACHER, OTHER_TEACHER])
    assert result['ok'] and not any(event['period'] == 1 for event in result['events']) and result['warnings'], result

    # Unknown date and incomplete virtualization cannot renumber lessons.
    load(calendar(date='2026-11-08'))
    rejected(read())
    load(calendar(date=None))
    rejected(read())
    partial = {i: [card('partial-' + str(i), TEACHER, BASE + str(i))] for i in [2, 3, 4, 5, 6, 7]}
    load(calendar(partial))
    rejected(read())
    load(calendar().replace('aria-rowcount="7"', 'aria-rowcount="-1"'))
    rejected(read())
    # A normal time-slot calendar grid is not a proven seven-lesson day.
    # Its diagnostic describes only bounded visible structure, with no links,
    # executable markup, credential values, or other hidden form contents.
    secret_value = 'FIXTURE_SECRET_TOKEN_NEVER_INCLUDE'
    script_secret = 'FIXTURE_SCRIPT_SECRET_NEVER_INCLUDE'
    diagnostic_html = calendar().replace('aria-rowcount="7"', 'aria-rowcount="48"')
    diagnostic_html += ('<input type="hidden" value="' + secret_value + '">'
                        + '<input type="password" value="' + secret_value + '">'
                        + '<script type="application/json">' + script_secret + '</script>')
    load(diagnostic_html)
    rejected(read())
    diagnostic = page.evaluate("new Promise(resolve=>calendarReaderListener({type:'MIRSAD_TEAMS_CALENDAR_DIAGNOSTIC'},{},resolve))")
    assert diagnostic['ok'] and diagnostic['isCalendar'] and diagnostic['supportedStructure'] is False, diagnostic
    assert diagnostic.get('warnings') and isinstance(diagnostic.get('nodes'), list), diagnostic
    assert len(diagnostic['nodes']) <= 100, diagnostic
    assert all(set(['tag', 'role', 'dataTid', 'testId', 'className', 'rect', 'text']).issubset(node) for node in diagnostic['nodes']), diagnostic
    encoded_diagnostic = json.dumps(diagnostic, ensure_ascii=False)
    assert secret_value not in encoded_diagnostic and script_secret not in encoded_diagnostic, diagnostic
    assert BASE not in encoded_diagnostic and '<script' not in encoded_diagnostic, diagnostic
    load(calendar().replace('aria-label="Day calendar"', 'aria-label="Week calendar"'))
    rejected(read())
    load(calendar(), 'https://teams.microsoft.com/v2/#/meeting')
    probe = page.evaluate("new Promise(resolve=>calendarReaderListener({type:'MIRSAD_TEAMS_CALENDAR_PROBE'},{},resolve))")
    assert probe.get('isCalendar') is False, probe
    rejected(read())

    # A visible but unattributed event is skipped; the reader must not assume
    # that the requested teacher owns whichever event happens to be nearby.
    rows[1] = [card('no-teacher', '', BASE + 'unknown-owner')]
    load(calendar(rows))
    result = read()
    assert result['ok'] and not any(event['period'] == 1 for event in result['events']), result
    rows[1] = [card('foreign-link', TEACHER, 'https://external.invalid/l/meetup-join/forged')]
    load(calendar(rows))
    result = read()
    assert result['ok'] and not any(event['period'] == 1 for event in result['events']) and result['warnings'], result

    # Open only a verified event card, read its owned details' Join anchor,
    # and close that dialog. No meeting action or endpoint is invoked.
    rows[1] = [card('details-1', TEACHER, detail=True)]
    load(calendar(rows))

    def install_details(teacher=TEACHER, url=BASE + 'details-only'):
        page.evaluate('''({teacher,url})=>{
      document.getElementById('details-1').onclick=()=>{
        window.detailOpens++;
        const dialog=document.createElement('div');dialog.setAttribute('role','dialog');
        dialog.setAttribute('aria-label','Event details');dialog.style.cssText='position:fixed;top:20px;right:20px;background:white;padding:12px;z-index:10';
        const title=document.createElement('h2');title.textContent='مادة مختلفة';
        const inviter=document.createElement('p');inviter.textContent='قام '+teacher+' بدعوتك';
        const join=document.createElement('a');if(url)join.href=url;join.textContent='Join';join.onclick=event=>{event.preventDefault();window.joinClicks++};
        const close=document.createElement('button');close.textContent='Close';close.setAttribute('aria-label','Close');
        close.onclick=()=>{window.detailCloses++;dialog.remove()};
        dialog.append(title,inviter,join,close);document.body.append(dialog);
      };
    }''', {'teacher': teacher, 'url': url})

    install_details()
    probe = page.evaluate("new Promise(resolve=>calendarReaderListener({type:'MIRSAD_TEAMS_CALENDAR_PROBE'},{},resolve))")
    assert probe['ok'] and page.evaluate('window.detailOpens') == 0, probe
    result = read()
    assert result['ok'] and any(event['period'] == 1 and event['url'] == BASE + 'details-only' for event in result['events']), result
    assert page.evaluate('window.detailOpens') == 1 and page.evaluate('window.detailCloses') == 1
    assert page.locator('[role="dialog"]').count() == 0

    # A stale/mismatched popover cannot override the verified card owner.
    load(calendar(rows))
    install_details(OTHER_TEACHER)
    result = read()
    assert result['ok'] and not any(event['period'] == 1 for event in result['events']) and result['warnings'], result
    assert page.evaluate('window.detailCloses') == 1

    # A user's already open dialog belongs to the user: leave it and its
    # controls untouched, even when that prevents opening the event details.
    load(calendar(rows))
    install_details()
    page.evaluate('''()=>{
      const dialog=document.createElement('div');dialog.id='user-dialog';dialog.setAttribute('role','dialog');
      dialog.style.cssText='position:fixed;top:20px;right:20px;background:white;padding:12px;z-index:10';
      dialog.innerHTML='<p>Existing user dialog</p><button aria-label="Close" onclick="window.detailCloses++;this.parentElement.remove()">Close</button>';
      document.body.append(dialog);
    }''')
    result = read()
    assert page.locator('#user-dialog').count() == 1 and page.evaluate('window.detailCloses') == 0, result
    assert page.evaluate('window.detailOpens') == 0, result

    # Expired work does not open details. Cancellation during a pending detail
    # read closes only the reader's own dialog and returns no candidate links.
    load(calendar(rows))
    install_details(url=None)
    result = page.evaluate('''payload=>new Promise(resolve=>calendarReaderListener(
      {type:'MIRSAD_TEAMS_CALENDAR_READ',...payload,requestId:'expired',deadlineAt:Date.now()-1},{},resolve))''',
      {'date': DATE, 'teachers': [TEACHER]})
    rejected(result)
    assert page.evaluate('window.detailOpens') == 0
    page.evaluate('''payload=>{
      window.pendingCalendarRead=new Promise(resolve=>calendarReaderListener(
        {type:'MIRSAD_TEAMS_CALENDAR_READ',...payload,requestId:'cancel-me',deadlineAt:Date.now()+5000},{},resolve));
    }''', {'date': DATE, 'teachers': [TEACHER]})
    page.wait_for_function('window.detailOpens===1')
    page.evaluate("calendarReaderListener({type:'MIRSAD_TEAMS_CALENDAR_CANCEL',requestId:'cancel-me'},{},()=>{})")
    result = page.evaluate("Promise.race([window.pendingCalendarRead,new Promise((_,reject)=>setTimeout(()=>reject(Error('Calendar cancellation timed out')),3000))])")
    rejected(result)
    assert page.evaluate('window.detailCloses') == 1 and page.locator('[role="dialog"]').count() == 0
    assert not any('/l/meetup-join/' in request for request in requests), requests

    print('PASS bounded screenshot-semantic Teams Calendar DOM reader: complete day order, exact teacher/date, ambiguity, unsupported views, and read-only owned details; actual Teams DOM compatibility remains unproven')
    browser.close()
