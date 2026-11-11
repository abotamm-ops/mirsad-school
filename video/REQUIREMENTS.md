Video recording — agreed requirements, 11 November 2026

Teacher lesson cell bottom-left square. Selecting it opens checkboxes “record after cycle 1/2/3” for every configured cycle, including the final cycle until lesson end; select one or all eligible gaps. No clock-from/to picker. Duration 1–10 minutes is a maximum. One independent clip per selected gap; no pause/resume or stitching. At most one lesson may record at a time.

Requests come from authenticated website/phone, recording executes on the monitoring PC. Screen plus incoming Teams tab audio; no microphone capture. Initial explicit Chrome tab-capture preparation on the monitoring PC is necessary. Use a dedicated Teams tab, never borrow/close an attendance probe or Madrasati teacher directory.

Attendance has absolute priority. An actual waitingForCycle2 gap or a confirmed completed-cycle tail with no current scan is eligible. Hard stop deadline is the next cycle, lesson end, or earlier next-class boundary minus 30,000ms. Recalculate against the real current run, not the interval setting or requested video duration. Short/no remaining budget skips recording with a reason; no changes to attendance dates, timing, counters, results or alarms. At next scan, stop capture recording and leave the recording meeting; close only the dedicated tab if leaving cannot be confirmed. Do not wait on saving or upload to start attendance. Upload traffic must pause/abort during scans and resume later.

Selected cell icon is dark red. Cell and icon flash red only when actual recording has been acknowledged and the device status remains fresh. Show “recording”. Queued/joining/uploading are not recording. Respect prefers-reduced-motion. Duration/actual length and failures are visible.

Save a local WebM copy on the monitoring PC and upload to its linked Google Drive (school-owned for schools; private owner's Drive for personal). Resumable direct Drive upload is necessary; do not send video through the existing image JSON/base64 path. Keep OAuth tokens on server; issue only a job-scoped upload session to an authenticated writer. Verify uploaded file's job metadata, parent and size before publishing a Drive link. Keep attendance/capture evidence separate.

No second Teams account is available. Recording only in scan-free gaps and after the final cycle resolves the simultaneous-meeting concern. No simultaneous lessons. No unattended recording before capture permission/setup. No experimental Calendar feature included in stable builds.

- Final cycle is supported: capture stops 30 seconds before lesson end or any earlier next-class boundary. Duration remains an optional maximum; earliest boundary wins.
- Video square is 12 by 12 CSS pixels, with equal min/max dimensions to prevent stretching.

- One-button setup from the invoked monitoring dashboard captures that permitted tab before navigation, preserves dashboard access in a second tab, and repurposes the captured tab for Teams. It never repurposes Madrasati or a live probe. Capture failure keeps the original page untouched. No manual open-tab and prepare-tab sequence in popup.
