# Multi-school accounts — Schools 2.9.47 / service 2.9.44

One subscription email may use multiple Madrasati schools sequentially. A school ID selects an isolated archive; it does not lock the subscription to one school. Loading the directory automatically selects/creates its space. There is no old school-binding approval gate in the active client or service.

The server enforces one recorder device and a single school monitoring lease per email. The lease lasts 180 seconds and is renewed by the extension. Pause/release permits another school; logout permits another device. Old device tokens are revoked. Public viewing links, signatures, letter preferences, native folder UUIDs, video scope and queued records remain scoped to their school. Migration adopts legacy folders in place. Logout checkpoints local state by account and school; subsequent login clears active data before restoring the selected account's cache and server handover.

2.9.47 combines this model with the reviewed video fix from personal109/schools46. It waits for a nonempty fully processed cycle, no current scan/retry/reconnect or owned probe tabs. Completing the last check triggers an immediate poll. Recording uses existing safety limits and never requires everyone to attend. The next attendance scan invalidates the video window and confirms meeting leave (or closes the recording tab on failed leave) first. Successful leave preserves capture readiness.

## Deployment

This source and ZIP are prepared and tested locally. They do not update the owner's Google Apps Script deployment automatically. Pause monitoring before changing anything. Update the existing service deployment to 2.9.44, retain its URL and project properties, and install 2.9.47 on recorder devices before resuming. Old recorders cannot write under the new protocol. Do not distribute47 as a drop-in client for service40. Keep43/46 and service40 as the old coordinated rollback pair.

Personal109 only changes recording coordination and does not need a Google service update. Schools47 needs44 because it also enables multi-school accounts. An extension's version number alone does not prove its backend is deployed.

## Build and validation

Supply the private owner21 snapshot in `/tmp/mirsad-commercial/owner-2.9.21.gs`; run `python3 multisite/build.py`. Never commit plaintext full owner source or private opening keys.

Build client: `python3 commercial-simple/build.py --extensions-only`, then `python3 commercial-simple/package.py --extensions-only`.

Run `node --test multisite/service.test.cjs multisite/client.test.cjs commercial-simple/cycle-runtime.test.cjs`, the controller/daily/keep-awake tests, and video core/controller/UI tests. Set `MIRSAD_VIDEO_TEST_ROOT=/tmp/mirsad-commercial/extension/video` to test the generated school's video controller. Run `node commercial-simple/browser.test.cjs` and `node commerce/browser.test.cjs` for the real web UI with fixture services.

These are automated fixtures and browser tests, not a Windows/Teams field recording or live deployment confirmation. Test a real clip's sound, picture, save, and next cycle before general rollout.

## Schools 2.9.48 quick start

The compact popup adds a quick-start button with a visible instruction to open Madrasati's teacher directory first. It captures the complete visible timing values, enabled cycle gaps, source date and mode, validates and saves them, then calls the existing start path. Manual mode rejects an unloaded source date. Daily mode keeps the displayed date on today's Riyadh date and arms the normal daily planner; the planner collects the actual operating day's table. Duplicate clicks are rejected; stop/pause cancels a pending quick start. Daily arming remains enabled during the final start phase.

Every full `MirsadSimple.collect` first reloads the directory and dashboard tabs, waits for both reload completion events, and verifies their readiness again before selecting the school's space and collecting fresh teacher data. Page reload/authentication failures never fall back to a cached import. Loading is serialized with starting and mutation controls. Existing import-confirmation decisions remain explicit. The user opens the teacher directory; no automated navigation helper or cached SchoolId substitution is added. Backend44 is unchanged.

Schools49 refines quick-start semantics: daily mode normalizes the source date to Riyadh today even if the request carries an old date. Manual mode keeps the chosen date. A matching prepared table is reused; otherwise full collection refreshes both pages and imports that date before saving panel values and starting. Invalid timing is rejected before collection. Pending import decisions stop before monitoring and remain explicit. Quick-start failures include the processing stage and message, and a missing worker response prompts extension reload instead of a generic failure. This does not assert a field diagnosis of the owner's48 screenshot. Service44 is unchanged.

## Schools50 compatibility/load correction

A public version check on 2026-11-16 confirmed the live service is still40. Client50 negotiates backend capabilities and uses legacy single-school behavior on40, including queue flushing without the unsupported school lease. Only44 enables multi-school accounts. A modern nonlegacy context is refused on an older backend to avoid cross-root writes.

Only Madrasati's teacher directory is a load/start prerequisite. A closed or unauthenticated Rased website never blocks collection. Starting opens the scoped website in the background without bypassing website login. Healthy directory pages are read directly; a failed read gets one recovery refresh and readiness recheck. Neither directory nor website gets a forced reload on every load. This replaces48/49's mandatory two-page reload and website authentication gate. Personal109's package checksum was verified unchanged.

Schools51 adds the owner's full credit and a visible quick-start description. The generated protection reader retries only explicit `service-busy` reads twice (700/1400ms), preserving the original writer key and all protection checks. It never retries writes or authentication failures. Exhausted busy reads retain their actual cause rather than claiming an outdated0.6.35 script. Unit tests and an actual generated drive-sync reader test cover this path. Persistent server contention can still fail safely. Personal109 is unchanged.
