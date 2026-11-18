# Schools 2.9.55 — start from the saved school timetable

When a current-school timetable is already saved, Schools54 still queries the website's viewer tab before using it. An empty or stale viewer can therefore reject startup even though collection succeeded. The generated55 worker uses the existing scoped timetable first and reads a website tab only as a fallback. The same runtime regression fails against the actual54 worker and passes against55, where the teacher check opens.

Daily startup previously returned success before its initial scheduler attempt completed. This masked downstream errors behind the readiness dialog.55 waits for that attempt when starting during the school day, verifies the engine's persisted running state, surfaces failures, and keeps startup progress visible. Before the lesson/day window it still arms the saved schedule without opening an early check. Stop/pause continue to win against delayed responses.

The controller releases only its preparation lock before the daily scheduler may collect today's table; user commands remain serialized while startup is pending. A failed attempt no longer leaves a five-minute collection throttle, and a stale startedDate cannot block a missing run. A successful server recorder-status check supplies the existing short-lived, writer-bound subscription verification cache, avoiding an unnecessary repeat verification request. Revoked or expired subscriptions remain blocked.

The popup no longer shows an armed scheduler as successful after a failed startup. The normal five-step flow remains, and update55 requires the existing school service2.9.53; no Apps Script or website deployment is needed. Customer instructions now describe the actual unlimited-device/single-session policy rather than old single-device wording.

Validation:
- 83 tests passed across controller, daily scheduler, real generated startup, native readiness, keep-awake, devices, school policy and school client.
- 54 additional video core/controller/meeting tests passed against the generated school files. The generated startup/native checks were also rerun after the final build.
- Popup browser regression passed, including truthful failed-start state, activation, school switching, pause/stop, cached reopening and780×600 geometry.
- The ZIP passed CRC verification. Compared with54, changed extension files are only background.js, manifest.json, popup.html, simple/controller.js, simple/daily.js and simple/popup.js. Attendance model, Teams scan content, video code, Drive adapter and school-isolation module are byte-identical.
- No real account state was changed. These tests do not establish the cause of the owner's particular Windows session or replace a real school test.

Update in place: stop monitoring, replace files in the same installed extension folder, then Reload in chrome://extensions. Do not uninstall or change its folder/identity. No changes to existing account, PIN, timetable, records or archives are performed by this update.

The owner confirmed that the existing pre-lesson label is already correct. The separate pending-label experiment was canceled, is not part of55, and was never deployed.
