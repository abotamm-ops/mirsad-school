# Schools 2.9.53: explicit school transitions and independent devices

Prepared implementation, not deployed to the user's Apps Script account. The last observed live service was 2.9.40. Do not describe the new policy as active until commercialServiceVersion reports 2.9.53 with unlimitedRecorderDevices and singleMonitoringSession.

One email may register unlimited independent recorder devices. Each writer token remains bound to its installation secret. Caller logout revokes only that installation; owner resets revoke all. Monitoring uses a locked server lease across the entire email, not one lease per school/device. Pause/stop release; a lost connection expires after 180 seconds.

SchoolId identifies the Madrasati directory, not the subscription. Workspace localId identifies a visit. On a different school, the user chooses Archive / Delete / Cancel. Explicit server consent carries the intended new SchoolId and previous workspace ID. Delete needs an additional true confirmation. New visits get independent Drive folders and local IDs, timing, timetable, evidence, video settings, and signature scope. Returning to a previous SchoolId starts clean. Archive metadata retains the old root and profile; authenticated archive reads address archive IDs and reject writes. Existing 2.9.40 data migrates in place without deleting account/PIN/subscription/Drive links.

Deletion targets only the immediately previous current school, not older archived schools. Files go to Drive trash, not permanent API deletion. Legacy account roots contain child workspaces: preserve these and trash only the legacy files/date folders. Downloaded files and native helper folders are outside this service deletion; the consent explains this. Failed deletion remains recorded in archive metadata for recovery; do not claim successful cleanup if the service returns an error.

Main website shows one active school and an archive link. school-archives.html lists school folders and dates; archive pages do not activate an old school for monitoring. Linked Drive folders expose the retained images and videos.

## Build / verify

- python multisite/build.py (private source /tmp/mirsad-commercial/owner-2.9.21.gs required)
- node multisite/devices.test.cjs
- node multisite/policy.test.cjs
- node multisite/client.test.cjs
- node commercial-simple/controller.test.cjs
- python commercial-simple/build.py --extensions-only
- node commercial-simple/browser.test.cjs
- python commercial-simple/package.py
- python multisite/package.py (encrypted owner viewer; key remains private)

multisite/service.test.cjs tests the preserved 2.9.44 baseline; policy.test.cjs is authoritative for the new policy. Personal 0.6.109 is unchanged. Real Windows/Madrasati/Teams field verification remains necessary.

## Deploy

1. Update the existing Apps Script deployment using the full generated owner-2.9.53.gs, preserving deployment URL and Script Properties. Do not run setup to create a replacement database.
2. Check commercialServiceVersion. New extension 2.9.53 requires the new capability; it never silently reverts to the canceled old licensing rules.
3. Update school extensions to 2.9.53 and test two devices with one email, Archive / Delete / Cancel, and an existing account. Old 2.9.52 writers do not carry workspace generations and must be upgraded alongside the service.
4. Publish static website files and release ZIP. No deployment into Google was performed by the build scripts.
