Late links during an active school day

Stable startup builds run.schedule from valid links only. The previous merge updated existing rows but never inserted lessons omitted at startup, so a filled website cell remained absent from all future scan cycles.

The fix inserts newly linked lessons into the master schedule, and appends eligible current-period lessons to the pending scan queue. It preserves an ongoing scan, completed results, cycle waits, pause state, and revision boundaries. No Calendar pilot features, backend script, or helper changes are included.

Build from repository root: node fixes/live-links/package.cjs; node --test fixes/live-links/merge.test.cjs; python3 fixes/live-links/package.py.
The build currently uses the existing Acorn installation at /tmp/mirsad-review-tools/node_modules/acorn.
Windows and live Madrasati/Teams end-to-end verification remain manual.
