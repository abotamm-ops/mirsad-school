Late links during an active school day

Stable startup builds run.schedule from valid links only. The previous merge updated existing rows but never inserted lessons omitted at startup, so a filled website cell remained absent from all future scan cycles.

The fix inserts newly linked lessons into the master schedule, and appends eligible current-period lessons to the pending scan queue. It preserves an ongoing scan, completed results, cycle waits, pause state, and revision boundaries. No Calendar pilot features, backend script, or helper changes are included.

Build from repository root: python3 fixes/live-links/prepare.py; node fixes/live-links/package.cjs; node --test fixes/live-links/merge.test.cjs; python3 fixes/live-links/package.py.
The build currently uses the existing Acorn installation at /tmp/mirsad-review-tools/node_modules/acorn.
Windows and live Madrasati/Teams end-to-end verification remain manual.

Resume regression: a paused run now admits newly linked lessons into the unfinished current-cycle queue as well as the master schedule. A gap wait still remains unchanged.

Stale scan-save protection (0.6.81.4 / 2.3.3.4): retain the latest successfully merged snapshot in the service worker. Every subsequent saveRun reapplies its matching-revision link delta while preserving scan progress and results. This prevents a scan that began before a manual timetable reload from writing its older link queue over the newly downloaded one. An active scan retains its original URL; later scans/cycles use the saved URL.

Verified: 16 merge/state regressions, 2 full extension runtime navigation tests (private and schools), 6 manual reader/backend integration tests, and 12 cycle-gap regressions. Runtime tests mock Chrome and backend transport; they are not a live Windows/Teams browser test.

Individual link edit regression (0.6.81.5 / 2.3.3.5): syncRunLinks adopts the newly saved snapshot before saveRun reconciliation, so the previous loaded URL cannot replace an explicitly saved manual edit. Full runtime tests cover manualLessonLink -> resumeMonitoring -> navigateCurrent in both extensions. School resume also had an out-of-scope variable passed to beforeCycle; this now uses the committed resumed run.

Consumed no-link entries (0.6.81.6 / 2.3.3.6): a same-cycle no-link result or an already consumed empty-URL placeholder no longer blocks a newly supplied valid link from entering the remaining queue. Successfully attempted/completed checks are not duplicated. An appended retry is deduplicated by the unconsumed queue. Two additional full-runtime regressions verify the public manual reload API followed by actual navigation after the ongoing scan, with the linkless teacher previously consumed by the cursor.
This reproduces a possible skipped-teacher path; the specific field report (Osama, period 2) has no exported runtime state, so its exact cause is not confirmed.
