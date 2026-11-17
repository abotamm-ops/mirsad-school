# Schools 2.9.58

The owner confirmed 2.9.57 starts monitoring successfully. This release reduces repeated preparation and shortens the popup.

- Quick Start compares persisted settings and source selection, preserving ready steps 1–4 and inactive cycle gaps. It skips redundant settings writes and automatic-link synchronization.
- Valid video preparation is reused only for the current scope and a live capture. Expired preparation still requires Chrome permission or explicit continuation without video.
- Directory content messages have a four-second response bound and the read loop is capped at 30 seconds. Tagged read failures may refresh the existing teacher directory and school dashboard and retry once, with writer/school/stop checks. Service writes and uncertain writes are never automatically replayed.
- Optional helper download is in the footer. Status feedback occupies normal layout space, keeping Stop accessible. Short labels replace long main-panel instructions; Help retains guidance.

Validation: 103 regression tests and 56 video tests passed. Browser regression checks popup geometry, controls, school switching, and helper/Stop separation including visible progress feedback. ZIP integrity verified. Owner field validation of 58 remains pending.

No Apps Script update is required: service 2.9.53 stays in use. Website, personal extension, school isolation, recording authorization, and attendance states including «بانتظار الحصة» are unchanged. Replace files in the existing extension folder and reload; do not uninstall or clear storage.
