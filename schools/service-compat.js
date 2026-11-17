/* The schools account protocol accepts compatible 2.x service updates. */
(() => {
  'use strict';
  function supports(value) {
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value?.version || ''));
    const singleMonitor=value?.singleMonitoringSession===true&&value?.unlimitedRecorderDevices===true&&value?.multiSchoolAccounts===true;
    return !!version && Number(version[1]) === 2 && Number(version[2]) >= 1 &&
      value.accounts === true && (value.singleExtensionSession === true || singleMonitor);
  }
  globalThis.MirsadSchoolsServiceCompat = {supports};
})();
