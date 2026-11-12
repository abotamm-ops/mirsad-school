# Final-cycle timetable refresh

Personal 0.6.99 / Schools 2.6.16. Compatible with personal script 0.6.97 and school script 2.6.14.

After advancePeriod has scheduled the next lesson, persist an account/date/run/epoch-scoped final-gap marker, only for an actually completed configured last cycle. This covers one/two/three-cycle settings, excludes diagnostics and disabled/empty/skipped lessons, and does not create a fourth attendance cycle or alter alarms. No remaining lesson means no final refresh.

Collection uses the next lesson start as deadline, verifies directory health under the existing policy, and delta-merges upcoming rows from period+1. Continuous mode collects even when links are complete; missing mode checks only upcoming rows. Existing source cancellation and run/epoch checks stop stale collection on next scan, pause, account/mode change, or run change. Five-minute health refresh remains directory-only. Completed gap key prevents repeated success in the same window. Pending merges and existing source/API latency follow the existing attendance merge policy.

Tests exercise both editions: prior cycle gaps, one-minute health, source date, queued health refresh, final cycle collection, deduplication, next lesson cancellation. No live browser/Google verification.
