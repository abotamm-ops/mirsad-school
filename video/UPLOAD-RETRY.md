# Upload retry repair (Teams 0.6.96 / Schools 2.6.13)

Reproduced in controller fixture: even with capture unprepared and completed clips in IndexedDB, periodic polling ran reset cleanup asynchronously before processMedia. Its cleaning flag caused processMedia to return; another poll could repeat the same ordering indefinitely. Removed those eager cleanup launches. Poll now processes media then serializes reset cleanup; persisted tombstones still block selected clips before any transfer.

Cloud uploads run in a separate first pass so native disk work cannot delay them. Resumable status probes have a 20-second abort deadline, like data chunks. Upload errors are persisted per clip and sent to the existing video register. Attendance still aborts active upload and denies new transfer work during scanning. Existing scripts remain compatible; no script or native-host update for this repair.

Tests reproduce pending upload without preparation, a stalled native writer, timeout/retry, selective deletion, and scan priority. Live user clips and Windows/Drive were not accessed. Stored clips can retry only if the original extension ID/profile and IndexedDB data remain; do not uninstall or reset.
