# Rased / Mirsad project: start here

Read CURRENT_STATE.json, PROJECT_MAP.md and PENDING_REQUIREMENTS.md before editing. This snapshot contains both source and current release artifacts; it is an owner handoff, not a customer installer.

## Product and owner preferences
The owner communicates in Saudi Arabic, wants short concrete guidance, and values immediate UI feedback. Keep the school popup compact and wide (780x600), without document scrolling. Preserve current account, timetable and attendance on upgrade. Do not ask users to uninstall their extension. Avoid changes to live monitoring during working hours.

Treat personal and commercial school editions independently. In particular, SOURCE/teams-probe is an older calendar pilot; it is NOT the current personal runtime. The personal runtime is extracted under EXTENSIONS/personal-0.6.104. The school runtime under EXTENSIONS/schools-2.9.33 is generated from commercial-simple plus the stable school base archive.

## Stable design
Five school steps: open teacher directory and Rased; load timetable; lesson timing; cycle timing; start monitoring. Inactive cycle fields disabled. Green means ready; blue means utility or optional action. Duration gaps measured after previous cycle finishes. Stop/pause must not restart a run. Late results cannot recreate canceled work.

Organizer identity, attendance sections and invited participants are evidence to investigate. Do not implement proposed positional heuristics as confirmed rules without fixtures. Navigation failures must not silently become verified absence. The production logic and its tests remain the source of truth; owner conversations about stronger rules include future ideas.

Word/PDF letters: title "مدير المتوسطة", actual signature or signing space, then director name. No printed "التوقيع" label for the director; teacher reply signature label remains. PDF compact spacing was accepted; don't tighten it further. Personal and school letter templates differ in director identity source.

## Security boundaries
Owner authorization is server-side. School session scopes, recorder binding and read-only website sessions matter. Client-side code cannot be kept secret merely by Chrome packaging or obfuscation. Never publish BACKEND plaintext, keys, real pupil/teacher evidence, property exports or this unencrypted owner bundle. Public source trees have historically kept the full owner service encrypted.

Do not issue real mass account blocks, publish announcements, send mail, revoke access or submit store updates as a test. Use fixtures. The current owner's live service deployment has not been independently verified for 2.9.34. A built file or successful git push is not proof of a live Render/Apps Script deployment.

## Continuation
Read PENDING_REQUIREMENTS.md carefully: announcements, invoice-triggered activation, pricing/countdown and legal acceptance are not implemented. The owner deferred these until before starting payment enforcement, after schools understand and try Rased. Do not quietly turn on a trial deadline, payment demands or fake countdown.

For backend development use the private source snapshots in BACKEND and the patches in SOURCE/commercial-simple. Do not try to decrypt the owner's live credentials. Existing project properties must stay in the owner's Google account.
