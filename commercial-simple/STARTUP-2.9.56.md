# Schools2.9.56 — use the already confirmed school timetable

The owner’s55 error is an unsuccessful protectedDayState fetch, not a missing local timetable. The startup path called beginDay and ensureDay, both of which fetched the same immutable day snapshot again. The runtime tests now exercise the real MirsadSimple.start → daily scheduler (where selected) → CloudMonitoring → worker path. With a failing protected read and an already verified imported table,55 fails;56 reaches teacher processing without that redundant read.

loaded-timetable.js reuses only a successfully prepared Madrasati import: writer/account match, current school/site and visit context, current operating date, selected source date, source type, revision, success marker and completed load intent must agree. A pending import or unresolved reset prevents reuse. State is rechecked after looking up the context to prevent a school-switch race. If those checks fail, the original protected server read remains mandatory. No authorization, lease or write permissions are granted by this helper.

The ordinary subscription validation and global school-monitoring lease remain. Server record/image writes still validate workspace and timetable revision, with previous-version handling on the server. School switching clears/replaces scoped data using the existing policy. No remote table is created, reset or replaced by the fast read. This does not provide offline account activation or bypass Google service failures on required writes/leases.

Validation:
- 93 tests passed for startup/controller/daily/native/keep-awake, loaded timetable eligibility and race, protection retries, device registrations, school policy and client isolation.
- Startup runs exercised20 teachers with no links,82 teachers at13:12,150 teachers starting during period3, and45 teachers during period7 with a previous selected source date. Durations, gaps, cycle counts and manual/daily operation vary. No production teacher names or fixed timing are coded into the helper.
- 54 additional video core/controller/meeting tests against the generated school files passed.
- Existing real-popup browser regression passed, including failed-start feedback and780×600 geometry.
- These are automated tests. The actual owner Windows/Madrasati/Teams session has not been independently reproduced or verified as repaired.

Service2.9.53 and website are unchanged. Install56 over the same extension folder and Reload without uninstalling. The personal edition, attendance labels/model, Teams capture rules, local evidence and existing archives are unchanged. The canceled pre-lesson-label experiment is not part of this branch or release.
