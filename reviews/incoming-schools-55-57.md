# Incoming Schools 55–57 review — 2026-11-17

Owner supplied three complete Setup ZIPs. Extracted safely under /tmp/review-incoming and compared to repository release54; no incoming runtime code has been merged or released by this review.

- 55 checks the already loaded daily snapshot before trying to read the site schedule tab. Daily start now waits for the first tick, surfaces errors and checks whether the engine actually became running. Additional startup progress and concurrency guards were added.
- 56 introduces simple/loaded-timetable.js and reuses a previously confirmed import matching the writer/account/current school context/day/source date/revision instead of repeated remote preparation reads. This is a local cache check, not a fresh server assertion; it does not prove the remote timetable has not changed. Server lease and write validation still need field verification.
- 57 captures the current run-control epoch at startup and invalidates pending starts when Stop happens without a saved run. This addresses an old epoch preventing a newly created run from being saved. Syntax checks alone are not execution/Windows/Teams verification.

The screenshot is an independent owner WEBSITE failure. schools/service-compat.js required singleExtensionSession=true. The service53 deliberately reports false plus unlimitedRecorderDevices=true and singleMonitoringSession=true. Rejecting that response prevents owner portal loading before any owner account list request. Fix accepts either the original protocol or the complete new accounts+multiSchoolAccounts+unlimitedRecorderDevices+singleMonitoringSession protocol, keeping rejection of partial/unknown protocol responses. Owner HTML cache tags are bumped. No service script, data reset, customer extension update, or PIN change is needed for this website fix.

Current repository extension remains54; incoming55–57 are review inputs. Personal109 untouched. Never claim a new release or successful real monitoring from this static comparison.
