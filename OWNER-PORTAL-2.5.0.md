# School owner portal 2.5.0 and Guardian 3.4.6

The owner home is now navigation/summary only. Active/new and expired/deleted accounts have separate pages. Existing deleted account records and archived evidence remain intact. Expired accounts can be renewed through the existing paid-confirmation flow.

Owner bank settings accept up to ten accounts and are available to every authenticated school in school settings. Customer ratings (one current rating per school) and suggestion history are private to the school and the authenticated owner. All customer text is rendered as text, never HTML.

Usage reports include existing website/extension login and device counts, last connection, measured website/monitor device-hours, today's monitoring time, and accounts with recent active pulses. Website time only counts visible-page pulse intervals; monitoring time uses existing authenticated recorder heartbeats. Intervals over three minutes are not credited. Lifetime totals remain; daily detail retains ninety days. This is recorded connected device time, not fabricated historical hours or proof of human interaction. Multiple devices are summed. No extension change is required for the usage protocol.

## Activation

Website changes are backward compatible with the old school service: account lists continue to work and new owner controls show a script-update notice until the service advertises ownerPortal support. The owner must paste the private 2.5.0 script into the existing SCHOOL Apps Script project, save and update the current web-app deployment to a new version. Preserve the deployment URL and all script properties. Do not change the personal script.

The encrypted owner preview is owner-script-2.5.0.html; its decryption fragment is delivered to the owner separately and is not committed. Full script and generator source archive are kept in /workspace/downloads. Existing Google Drive cutover, reset-projection and remote link-control behavior are retained from the 2.4.1 service base.

## Guardian

Guardian 3.4.6 removes the hidden-startup-window flag while preserving a console-free child process, makes the panel explicit and taskbar-visible, waits for Start, and adds duplicate-instance reveal signaling. Start/Pause/Close and the saved session/dashboard recovery choice remain. Close the old helper with Ctrl+Shift+Q before replacing it. Test on Windows before customer distribution.

## Validation

Nine registry/service tests, six owner/customer DOM/API tests, two website activity tests, existing school-service compatibility and Drive-onboarding regressions; PowerShell panel, lifecycle, restore and preference tests; C# native compilation, Go launcher extraction tests, Windows cross-build and PE GUI/console flags. Browser/Google backend/Windows UI tests use mocks or static/native compilation, not a live authenticated deployment. Google Apps Script deployment and live Windows verification remain manual.
