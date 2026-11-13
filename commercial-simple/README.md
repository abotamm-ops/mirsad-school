# Schools simplified setup 2.7.0

Commercial-only pilot, built from released Schools 2.6.21 (fixed identity preserved). Personal extension, personal script, pre-video backups and Guardian 3.4.6 are unchanged.

## Customer flow

One ZIP contains the extension, existing Windows guardian and existing local backup host. A hidden-window VBScript registers the native file writer and opens the guardian. Chromium unpacked-extension installation still requires manual developer mode until official store publication. VBScript-disabled organisations can use the existing native installer CMD; no new recorder app is introduced.

Activation from the extension sends an eight-digit, ten-minute one-use code to the subscribed school's email. It does not disclose/reset the stored password. Email codes are hashed, rate limited and attempt limited; paid/enabled state and one-recorder binding/device-secret proof stay server controlled. No real email is sent by the tests. Owner deploys new script to the existing Apps Script deployment; Google OAuth owner credentials/URL remain unchanged.

First-login Google/local storage card moves into Advanced after confirmed native readiness and either Google connection or explicit local-only choice. One Google button is moved (never duplicated) above the table when unlinked; it is red with a warning and supports four-hour snooze. Connected state is confirmed by the backend and appears green in Advanced. Local archive is a folder, not a partition. Cloud metadata continues through the existing school service; linking Google places the school-owned archive in its own Drive under the existing date boundary policy.

Three visible steps: load (date or every morning), save lesson timing, start. No prepare-day button, experiments, diagnostic scan or destructive replacement option. Preflight requires a logged-in teacher directory and authenticated Mirsad tab. Load is green only after confirmed active snapshot. Missing links, saved current-day versions, pause/restart controls and advanced per-cycle video scheduling remain available. Replacements offer keep-and-apply or cancel. Current-day saved snapshots can restore active attendance; older days stay read-only in the site archive, as in the existing protected restore implementation.

## Daily operation

The user's Start arms the daily scheduler. The school week and next lesson time are computed in Riyadh timezone, independent of source-date experiments. At minus thirty minutes, missing today's timetable is downloaded; current-day results are not silently overwritten. If an import decision is required, the scheduler pauses for that decision. Existing morning refresh fills missing links every five minutes and stops when complete; day-gap loading follows the preference. Before each start, account state, directory readiness and prepared today date are checked. Pauses/disarm win. Browser restart resumes an armed schedule; sleeping/closed/offline machines cannot execute exact wall-clock tasks. Teams must already be signed in; the existing meeting scanner handles per-meeting session failures. No unsupported guarantee of permanent Microsoft login.

## Website sessions

The bound recorder mints a short-lived server session for view-only access and a separate extension-only control session. Derived sessions become invalid after recorder revocation/logout. Website keys are delivered by an extension-only runtime message to a fixed origin/path; no token goes in the URL. The server rejects state-changing requests from view-only sessions. Google OAuth status/begin/complete remain permitted for the extension-owned consent flow. Customer page hides scheduling, overrides and video selection; playback/reports/history remain. Owner pages are untouched. New simplified accounts cannot use website password-login after first activation.

## Build and validation

Place the previous full owner script privately at `/tmp/mirsad-commercial/owner-base.gs` (2.6.20). Run `python3 commercial-simple/build.py`, then tests, then `python3 commercial-simple/package.py`. Never commit full owner output or encryption key. The package script retains the opening key in `/tmp/mirsad-commercial/OWNER-2.7.0-LINK.txt`; preserve it privately. Build/tests need acorn/escodegen at `/tmp/mirsad-review-tools/node_modules` and Playwright for the browser UI test.

Tests cover actual service dispatch, OTP secrecy/replay/expiry/rate limits, device binding, read-only enforcement, preflight rejection, source-date safety, overnight start, pause safety and existing late-link queue regression. Chromium UI test uses mocks and does not access Google/Microsoft. This is a pilot: live Gmail delivery, Google consent, native Windows installation and a real school-day run require field validation before general sale. A larger archive/history transfer feature or public browser-store submission is not included.

## Compact interface 2.7.1

Extension-only update, owner script stays 2.7.0. Popup is 780px wide with three RTL columns, smaller typography/actions, and a top-right gear opening a modal settings panel. Static help paragraphs become focusable exclamation icons with hover/focus/click tooltips. Dynamic readiness and errors remain visible. Google onboarding still moves into the settings panel after setup, with one red reminder above the steps when unlinked. Browser test checks horizontal geometry, tooltip content, settings modal, onboarding movement and reminder snooze/reappearance.

## Fixed canvas 2.7.2

Extension-only UI correction: 780 by 560 action-popup canvas with no vertical document scrolling. Main steps stay in RTL columns, lesson timing fields remain visible, onboarding uses a separate first-entry state, and notes open separately. Settings are grouped into tabs inside the gear dialog instead of a long list. Static help stays behind exclamation icons. Browser geometry checks verify no clipped controls or vertical overflow in the main cards and each settings tab at the target popup size.

## Popup measurement fix 2.7.3

Extension-only correction; owner script remains 2.7.0. Root and body use an absolute 780px width and minimum width, avoiding a circular dependency on Chrome's initial action-popup viewport. Browser regression starts at 24px and verifies both roots remain 780px, alongside the existing layout and interaction checks. Actual action-popup integration test is skipped in this managed environment because Chromium policy blocks sideloaded extensions; it can run on an unrestricted development browser.

## Centered monitoring 2.7.4

Extension-only layout: schedule loading on the right, lesson settings on the left, and monitoring controls centered in a full-width row beneath both. Existing handlers and script 2.7.0 are unchanged. Browser geometry regression verifies the two upper columns, lower monitoring row, and no clipped controls.

## Account interface correction 2.7.7

Logout uses an inline confirmation, closes settings on success, clears login inputs, and exposes operation errors inside the modal. Existing server revocation and pending-evidence safeguards are retained. Owner deletion normalizes confirmation email whitespace/case and reports a mismatch instead of silently cancelling. No account data is deleted by these tests; actual reported server rejection requires its error message.

Definitive invalid-session/device-revoked/device-proof responses now disarm monitoring, quarantine pending evidence, and clear cached account identity and derived portal sessions. INFO validates binding at most every 30 seconds while the popup is open; temporary service errors preserve authentication. Tests cover deleted identity cleanup and temporary-error retention. Native archives are retained.

## Rased school branding 2.8.0

School-facing extension and current school website use راصد. Positioning: remote education monitoring for school directors and deputies during school suspension. Existing protocol IDs, manifest key, account and disk identities, endpoint URLs and private/personal releases remain stable. Guardian binary remains the existing version; wrapper folder/launcher labels use the new name. Owner script and outgoing server email branding are unchanged in this extension-only release.

## Persistent activation 2.8.2

Background stores email and request stage before requesting delivery, and persists response/error without depending on the action popup lifetime. Reopening restores code-only entry, resend and email-change controls; the OTP itself is never stored. A stale sending stage unlocks after 70 seconds. Delivery eligibility remains server-side: only an existing enabled unexpired subscription receives mail. No live email delivery was verified in this environment. Owner script remains 2.7.0.
