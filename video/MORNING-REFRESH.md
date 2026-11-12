# Before-first-lesson timetable refresh

Personal extension 0.6.102 / Schools 2.6.19. No script/native/guardian update from 0.6.97 / 2.6.14 required.

An armed running (not paused/diagnostic/current scan) monitoring session, matching today’s prepared Madrasati snapshot/revision, and incomplete nonexcluded lesson links are required. A separate one-shot alarm downloads the timetable at five-minute slots relative to first configured lesson start minus thirty minutes. Joining late runs the current slot once, without replaying missed slots. Completed links cancel remaining morning loads even when daytime mode is continuous. At first lesson start morning loads end; ordinary gap refresh stays controlled by existing settings.

The existing directory is health checked, then collectOnly reads the selected source date. Delta fill requires the same revision/account/run epoch and a current morning window, protects attendance/images and merges verified links into subsequent scan queues. No automatic login, new tab sweep, schedule reset or changed attendance timers. Cloud/source latency follows existing request guards; sleeping/offline/closed browsers cannot execute alarms at exact wall-clock times. A busy collector may skip a morning slot, retrying the next slot.

The guardian source already calls SetThreadExecutionState(ES_CONTINUOUS|ES_SYSTEM_REQUIRED|ES_DISPLAY_REQUIRED) when enabled and releases it on pause/exit. No guardian changes.

Tests: both editions, all six slots, deduplication, complete-link stop, early scheduling, paused/stopped/diagnostic/wrong date rejection, next-lesson interruption, account isolation; existing final gap, late links and video tests retained.

Date guard: the user-selected source date and prepared snapshot source date must both equal today before morning work. Collection requests that exact source date, never substitutes a date or modifies selection, and rejects payloads whose scheduleDate or importedForDate differ. This refinement applies only to morning refresh; ordinary daytime gap loading retains the existing selected-source-date policy.

Standby correction: a matching, authenticated step-three prepared workflow can refresh before the first lesson without running attendance. It uses an ephemeral prepared-session identity and never writes/starts a monitoring run. Paused or diagnostic sessions remain blocked. A minute scheduler watchdog re-evaluates readiness and recovers missed one-shot planning; actual loads remain deduplicated by five-minute slot. Persisted, deduplicated notes state planned time or blocking reason.

Source-date correction (personal 0.6.104 / Schools 2.6.21): the prior restriction requiring sourceScheduleDate to equal today is removed. The prepared attendance snapshot and importedForDate must still be today, while selected source date can be past, today, or future and must match the prepared snapshot source. Both returned dates are verified independently. In-flight source selection changes cancel the merge. No migration or replacement of existing attendance data. Scripts remain personal 0.6.103 / Schools 2.6.20.
