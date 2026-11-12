# Upload retry repair (Teams 0.6.96 / Schools 2.6.13)

Reproduced in controller fixture: even with capture unprepared and completed clips in IndexedDB, periodic polling ran reset cleanup asynchronously before processMedia. Its cleaning flag caused processMedia to return; another poll could repeat the same ordering indefinitely. Removed those eager cleanup launches. Poll now processes media then serializes reset cleanup; persisted tombstones still block selected clips before any transfer.

Cloud uploads run in a separate first pass so native disk work cannot delay them. Resumable status probes have a 20-second abort deadline, like data chunks. Upload errors are persisted per clip and sent to the existing video register. Attendance still aborts active upload and denies new transfer work during scanning. Existing scripts remain compatible; no script or native-host update for this repair.

Tests reproduce pending upload without preparation, a stalled native writer, timeout/retry, selective deletion, and scan priority. Live user clips and Windows/Drive were not accessed. Stored clips can retry only if the original extension ID/profile and IndexedDB data remain; do not uninstall or reset.

## Rejected session recovery (Teams/private 0.6.97, Schools 2.6.14)

Screenshot field evidence: chunk upload HTTP 400 (original Google reason unavailable). Previously the backend returned its cached uploadSession indefinitely after rejection. New client renews once per attempt for 400/404/410; backend compares the rejected session against the current authenticated job before replacing it and retains fileId. Server-confirmed byte offset is authoritative; stale local fileId is not treated as completion. If a fresh session is rejected, the bounded Google error message appears in the register. Blob length must match stored size. Script update required for renewal. Tests simulate chunk rejection followed by fresh-session success, stale renewal requests, retained destination, existing reset and attendance boundaries. No live Google account test was performed.
