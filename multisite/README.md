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
