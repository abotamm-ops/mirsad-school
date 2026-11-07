/* Schools only. Coalesce day reads without holding up evidence or other writes. */
(() => {
  'use strict';
  const inFlight = new Map(), recent = new Map(), generations = new Map();
  const timeoutMs = 35000, reuseMs = 1200;
  const otherReads = new Set(['dates', 'teacherLink', 'getTimetableSource', 'resetState', 'scheduleVersions', 'adminLogin', 'commercialWebsiteActivity', 'commercialEvidence']);
  const stable = value => JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))));
  function invalidate(url) {
    generations.set(url, (generations.get(url) || 0) + 1);
    for (const [key, entry] of recent) if (entry.url === url) recent.delete(key);
  }
  function waitFor(promise, signal) {
    if (!signal) return promise;
    if (signal.aborted) return Promise.reject(signal.reason || new DOMException('Aborted', 'AbortError'));
    return new Promise((resolve, reject) => {
      const aborted = () => reject(signal.reason || new DOMException('Aborted', 'AbortError'));
      signal.addEventListener('abort', aborted, {once: true});
      promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', aborted));
    });
  }
  async function request(url, init = {}) {
    let body;
    try { body = JSON.parse(init.body); } catch { return fetch(url, init); }
    if (body.action !== 'day') {
      if (otherReads.has(body.action)) return fetch(url, init);
      invalidate(url);
      try { return await fetch(url, init); } finally { invalidate(url); }
    }
    const generation = generations.get(url) || 0;
    const key = url + '|' + generation + '|' + stable(body);
    for (const [id, item] of recent) if (Date.now() - item.at >= reuseMs) recent.delete(id);
    const cached = recent.get(key);
    if (cached) return cached.response.clone();
    let promise = inFlight.get(key);
    if (!promise) {
      promise = (async () => {
        const response = await fetch(url, {...init, signal: AbortSignal.timeout(timeoutMs)});
        const bytes = await response.arrayBuffer();
        if ((generations.get(url) || 0) !== generation) throw new Error('تغيرت بيانات الرصد أثناء القراءة؛ جارٍ إعادة التحديث');
        const complete = new Response(bytes, {status: response.status, statusText: response.statusText, headers: response.headers});
        if (complete.ok) {
          const value = await complete.clone().json();
          if (value.ok && (generations.get(url) || 0) === generation) recent.set(key, {url, at: Date.now(), response: complete});
        }
        return complete;
      })();
      inFlight.set(key, promise);
      promise.finally(() => { if (inFlight.get(key) === promise) inFlight.delete(key); }).catch(() => {});
    }
    return (await waitFor(promise, init.signal)).clone();
  }
  window.addEventListener('storage', () => recent.clear());
  globalThis.MirsadSchoolRead = {fetch: request, invalidate};
})();
