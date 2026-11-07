/* The schools account protocol accepts compatible 2.x service updates. */
(() => {
  'use strict';
  function supports(value) {
    const version = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(value?.version || ''));
    return !!version && Number(version[1]) === 2 && Number(version[2]) >= 1 &&
      value.accounts === true && value.singleExtensionSession === true;
  }
  globalThis.MirsadSchoolsServiceCompat = {supports};
})();
