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

## Self-service registration and owner billing control 2.9.0

New email addresses receive an OTP without pre-creation by the owner. Only a correct OTP creates a school root and free account; no password reset or paid entitlement is fabricated. Free use continues until the owner disables the school. Owner list shows verified accounts automatically, actual unique usage dates and measured monitoring hours from existing heartbeat telemetry. Disabling preserves account, evidence and recorder identity, blocks writes server-side, displays owner payment instructions/bank details in the extension, and attempts an email notice. Owner confirms 100 SAR received before activating a calendar month from confirmation time. Expiration is checked on server writes. No trial or weekly plan is included.

Upgrade requires the complete new owner script 2.9.0 deployed to the existing Apps Script deployment, plus extension 2.9.0. Do not create a new deployment URL or reset registry/roots. Initial email OTP now checks service capability and reports an old script explicitly. MailApp authorization/daily quota still apply; live email delivery and Windows field tests were not performed. Tests cover fresh signup, OTP secrecy/one-use/expiry, disabled account read-only billing status, owner-only management, blocked heartbeat, payment confirmation, monthly expiry, and the payment gate UI. Historical release files stay intact.

## Onboarding responsiveness and derived session recovery 2.9.1

Extension-only fix; owner script remains 2.9.0. Login no longer holds the main action lock while Drive status refreshes. Google and local onboarding have separate visible busy states and remain actionable while status requests are pending. Manual success/error messages remain visible instead of immediately reverting to a stored status. An invalid derived site/control session clears only that cached token, verifies recorder binding, and retries once with a fresh derived session; a valid writer is not signed out because a website session expired. Definitive writer revocation retains the existing quarantine behavior. Browser regression holds Drive status unresolved and verifies both Google and local actions reach the background; controller regression verifies derived-token recovery without removing the account.

## Bounded Drive handoff 2.9.2

Extension-only fix, script remains 2.9.0. Google setup requests the consent URL before site handoff, so service configuration failures surface directly. Tab message acknowledgements have a 1.5-second deadline; an older page is reloaded once and retried instead of waiting indefinitely for a stale listener. Consent uses the exact session that created OAuth state, including a renewed derived session. Portal/Drive HTTP requests have a 25-second timeout. Onboarding shows the current stage and protects against account changes during handoff. Tests simulate a never-responding old page, configuration failure, normal site opening and successful consent launch using mocks. Live Google consent is not verified here.

## School site access correction 2.9.3 (website only)

The previous dashboard guard redirected an empty school profile to settings while simplified settings immediately redirected back to the dashboard. New verified extension users now authenticate and open the dashboard with an optional profile-completion reminder instead. School website guard shows loading, timeouts and retry/auth guidance in a visible overlay; it never deletes extension or website credentials because a page was closed. Existing non-simplified profile setup behavior and server authorization remain. Browser regression loads the real guard/view-only/callback scripts and covers a fresh empty profile, invalid website session, and OAuth callback returning to a visible dashboard without changing the saved session. Extension 2.9.2 and owner script 2.9.0 remain unchanged.

## Four-step main interface and persistent readiness 2.9.4

Main layout keeps loading on the right, lesson settings (2) above cycle settings (3) on the left, with monitoring (4) centered below. Cycle count and both editable gap fields move out of advanced settings; unsaved/new timing defaults both gaps to the recommended 10 minutes. Existing saved timing is preserved. Shared save validation remains unchanged.

Popup initially hides activation until local state is known, avoiding a signup flash. INFO returns local account/readiness immediately and verifies subscription asynchronously; explicit billing refresh still waits for verification. Confirmed Google status is cached by school and completed setup is persisted by school. Existing confirmed local-archive users are migrated out of repeated onboarding, while a fresh login explicitly starts its one-time setup flow. Background failures do not erase saved readiness, and real subscription revocation remains enforced. Tests cover a stalled verification request, school-specific setup caching, upgrade migration, editable 10-minute defaults, the four-card layout without overflow, and reopening directly to the main interface while Drive status remains pending. Owner script stays 2.9.0; helper unchanged.

## Explicit workflow colors 2.9.5

All four main cards, badges and primary actions start red and turn green from confirmed state: a matching loaded schedule, saved timing/cycle settings, or monitoring running/armed. Editing lesson settings marks only step 2 dirty, and cycle edits mark step 3 dirty; successful shared validation/save clears the dirty state. Pausing returns monitoring to red; stored completed settings stay green on reopening. Browser tests verify computed button colors and independent dirty states through save, start and pause. Extension-only update; script/helper unchanged.

## Independent page readiness and guidance 2.9.6

Top Madrasati/Rased buttons are red until independently verified and green when ready. Madrasati requires the teacher directory route and visible teacher results; Rased requires the matching authenticated website session and admin-ready page state. Closing, logging out of or losing access to either page affects only its readiness indicator on the next five-second check. Shared in-flight checks avoid rejecting a load because the popup is already checking. The teacher-page refresh/retry instruction stays visible beside schedule loading. Old website content scripts are reloaded on explicit site opening to support the new readiness protocol. Concurrent portal requests share one derived session so readiness polling does not interfere with Google consent. Controller/browser tests cover one-page-only cases, an unauthenticated site, independent button colors, and authenticated session matching. Extension-only update; script remains 2.9.0 and helper unchanged.

## Recover confirmed partial schedule startup 2.9.7

A previously confirmed schedule could remain visible while a later failed collection left mirsadLoadIntent in an unfinished/error state. Startup can now recover that marker only when no collector/decision is active, selected and requested source dates match, the last successful preparation matches today's local revision, and a fresh protected server day confirms the same source/revision. Account/intent changes during verification reject recovery. No attendance, links, saved timing, or archives are rewritten. The daily path shares the same recovery. Different dates, pending imports, and changed server revisions still block startup. The actual released school runtime is tested with 20 teachers and only one or two meeting links: it starts and retains all 20 lessons. Missing links are not treated as proof of observed absence; existing no-link evidence behavior is preserved. Owner script stays 2.9.0.

## Pinned source selection, explicit replacement and visible progress 2.9.8

The manual source date and daily/manual mode are saved immediately per school, separately from the previously loaded schedule. Reopening restores the selection; only daily mode advances to today's date. Selecting a different source never changes the active schedule or bypasses revision/date guards. A saved mode change must be applied with lesson settings before starting. Successful email activation opens the authenticated dashboard asynchronously.

The replacement dialog offers save-and-replace, discard-and-replace, or cancel. Discard requires a second in-dialog confirmation and forwards the existing backend keepPrevious:false transaction, retaining its revision guards and protection of older archived copies. The existing backend discard semantics apply; this is not a purge of other dates or independently stored native files.

Popup state refresh continues during long load actions, displaying completed teacher count/total and then the save phase. The school site shows its normal shell immediately for extension customers and validates the session in the background; failures appear inline, with no registration overlay or skipped server authorization. Tests cover pinned selection across reopen, progressive counts during an unresolved load, explicit discard/cancel, direct site opening and existing transaction rollback/archive behavior. Script remains 2.9.0; helper unchanged.

## Monitoring notice 2.9.9

After a successful start/arming response, an informational dialog asks the user to keep the recorder device/page open and follow results from mobile, with the requested daily-report explanation. Closing the notice does not pause or change monitoring. Browser regression verifies the text appears after start and can be dismissed before pausing normally. Extension-only update; owner script and helper unchanged.

## WhatsApp site sharing 2.9.11

A compact upper-right button next to settings opens a WhatsApp draft containing the public school dashboard URL and a short follow-up message. It contains no session key, password, or school-specific credentials and never sends a message automatically. Existing start notice retains the revised keep-device/page-open and WhatsApp follow-up text from 2.9.10. Controller/browser tests verify draft URL construction, button wiring and unchanged popup geometry. Script/helper unchanged.
