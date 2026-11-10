School extension 2.3.3.7: robust service JSON reads

The field screenshot shows a raw Unexpected end of JSON input error during timetable collection. Both the school collector's service request and its Drive/protected-day request used unguarded response.json(). The new transport reads the response explicitly, identifies empty/truncated JSON and HTML deployment/sign-in pages, and reports a localized operation-specific error without printing request bodies, service keys, or response contents.

Only the idempotent getTimetableSource, protectedDayState and day reads retry (maximum three attempts, 400ms/800ms backoff). Writes are never replayed by this transport, even if their response is empty. Authentication/application errors retain the existing school handling. An aborted outer signal stops retries. Failure preserves the existing timetable and records.

This handles transient empty service replies; it does not repair the remote deployment, expired credentials, quotas or persistent server failures. The precise remote reason for the screenshot response is not known without a real authenticated request.

Build: python3 fixes/service-json/prepare.py; node fixes/service-json/patch.cjs; python3 fixes/service-json/package.py. Acorn is loaded from the existing /tmp/mirsad-review-tools installation.
Validation: node fixes/service-json/transport.test.cjs; node fixes/service-json/collector.test.cjs; MIRSAD_SCHOOLS_FIX_DIR=/tmp/mirsad-schools-service-fix node fixes/live-links/runtime.test.cjs.
Tests cover transient/persistent empty replies, truncated responses, non-JSON deployment pages, no mutation replay, first-day collection, live reload, preservation on failure, and all existing updated-link attendance paths. Browser/service transport is mocked; the real school account still needs field verification.
