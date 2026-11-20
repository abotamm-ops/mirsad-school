(() => {
  'use strict';
  const config = window.MirsadCommercialConfig;
  const header = document.getElementById('mirsadLiveHeader');
  const root = document.documentElement;
  if (!config || !header) return;

  const label = header.querySelector('strong');
  let confirmed = null;
  let request = null;
  let unsupportedSession = '';
  let previousScope = '';
  let nextPollAt = 0;

  function scope() {
    if (!root.classList.contains('mirsad-admin-ready')) return null;
    const key = config.session?.();
    const siteId = new URLSearchParams(location.search).get('siteId') || root.dataset.mirsadSiteId;
    if (!key || siteId?.startsWith('archive-')) return null;
    return {key, siteId};
  }

  function render() {
    const current = scope();
    const fingerprint = current ? current.key + '|' + (current.siteId || '') : '';
    if (previousScope !== fingerprint) {
      previousScope = fingerprint;
      confirmed = null;
      nextPollAt = 0;
    }
    header.hidden = !current;
    if (!current) return;

    const age = confirmed ? Date.now() - confirmed.receivedAt + confirmed.age : Infinity;
    const heartbeat = confirmed?.heartbeat;
    const live = navigator.onLine && heartbeat?.running === true && age >= 0 && age <= 60000;
    header.dataset.live = String(live);
    label.textContent = live ? 'LIVE · نبض مباشر' :
      !navigator.onLine ? 'الاتصال منقطع' :
      heartbeat && age <= 60000 && heartbeat.running === false ?
        (heartbeat.phase === 'paused' ? 'الرصد متوقف مؤقتًا' : 'الرصد متوقف') :
        'بانتظار نبض الرصد';
  }

  function accept(data) {
    const current = scope();
    if (!current || current.siteId && data.siteId !== current.siteId) return;
    render();
    const heartbeat = data.heartbeat;
    const at = Number(heartbeat?.at);
    const serverTime = Number(data.serverTime);
    if (!Number.isFinite(at) || !Number.isFinite(serverTime) || at > serverTime + 10000) return;
    if (confirmed?.heartbeat.at > at) return;
    confirmed = {heartbeat, receivedAt: Date.now(), age: Math.max(0, serverTime - at)};
    render();
  }

  async function refresh() {
    render();
    const current = scope();
    const now = Date.now();
    if (document.hidden || !current || request || unsupportedSession === current.key || now < nextPollAt) return;
    request = current;
    nextPollAt = now + 2900;
    try {
      const data = await config.api('commercialLiveStatus', current.siteId ? {siteId: current.siteId} : {});
      const latest = scope();
      if (latest?.key === current.key && latest.siteId === current.siteId) accept(data);
    } catch (error) {
      if (/طلب غير مدعوم|الموقع للعرض فقط/.test(error.message||'')) unsupportedSession = current.key;
    } finally {
      request = null;
    }
  }

  window.addEventListener('mirsad-remote-day', event => accept(event.detail || {}));
  window.addEventListener('mirsad-admin-login', () => void refresh());
  window.addEventListener('online', () => void refresh());
  window.addEventListener('offline', render);
  document.addEventListener('visibilitychange', () => void refresh());
  new MutationObserver(() => void refresh()).observe(root, {
    attributes: true, attributeFilter: ['class', 'data-mirsad-site-id']
  });
  setInterval(() => void refresh(), 1000);
  void refresh();
})();
