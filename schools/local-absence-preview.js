/* A display-only preview from the recorder tab. Server reports retain their own data. */
(() => {
  'use strict';
  let preview = null;
  const tuple = record => [record.teacherId, record.period, record.cycle, record.scannedAt].join('|');
  const scoped = value => {
    const root = document.documentElement;
    return !!value && root.classList.contains('mirsad-admin-ready') &&
      value.accountId === root.dataset.mirsadSchoolId &&
      value.siteId === (root.dataset.mirsadSiteId || '');
  };

  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin ||
        event.data?.source !== 'mirsad-monitor-extension' || event.data?.type !== 'localAttendance') return;
    const payload = event.data.payload;
    if (!scoped(payload)) return;
    preview = payload.snapshot ? { ...payload, receivedAt: Date.now() } : null;
    window.dispatchEvent(new Event('mirsad-local-attendance-changed'));
  });

  function live(model, confirmed, now = new Date()) {
    const local = preview;
    if (!scoped(local) || now.getTime() - local.receivedAt > 20000 ||
        local.snapshot?.date !== model.day(now)) return model.live(confirmed, { now });
    const previous = confirmed?.snapshot;
    if (previous && (previous.scheduleRevision !== local.snapshot.scheduleRevision ||
        previous.date !== local.snapshot.date || previous.siteId && previous.siteId !== local.siteId)) {
      return model.live(confirmed, { now });
    }
    const data = confirmed?.snapshot ? confirmed : { snapshot: local.snapshot, records: [] };
    const records = data.records || [];
    const confirmedIds = new Set(records.map(record => record.scanId));
    const confirmedScans = new Set(records.map(tuple));
    const pending = local.records.filter(record => !confirmedIds.has(record.scanId) && !confirmedScans.has(tuple(record)));
    if (!pending.length) return model.live(data, { now });
    const pendingKeys = new Set(pending.map(tuple));
    const display = model.live({ ...data, records: records.concat(pending) }, { now });
    return {
      ...display,
      alerts: display.alerts.map(alert => !alert.manual && pendingKeys.has(tuple(alert))
        ? { ...alert, pendingUpload: true } : alert)
    };
  }

  globalThis.MirsadLocalAbsencePreview = { live };
})();
