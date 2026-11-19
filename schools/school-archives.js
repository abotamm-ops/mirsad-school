(() => {
  'use strict';
  const config = window.MirsadCommercialConfig;
  const status = document.getElementById('archiveStatus');
  const folders = document.getElementById('schoolFolders');

  function element(tag, text) {
    const node = document.createElement(tag);
    node.textContent = text;
    return node;
  }

  function schoolFolder(archive) {
    const card = element('details', '');
    const archivedAt = new Date(archive.archivedAt).toLocaleDateString('ar-SA', {
      timeZone: 'Asia/Riyadh'
    });
    card.append(element('summary', (archive.profile?.school || 'مدرسة') + ' — ' + archivedAt));
    const dates = element('div', '');
    if (/^https:\/\/drive\.google\.com\/drive\/folders\/[\w-]+$/.test(archive.driveUrl)) {
      const link = element('a', 'فتح مجلد المدرسة في Google Drive');
      link.href = archive.driveUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      card.append(link);
    }
    card.append(dates);

    let loading = false;
    let loaded = false;
    card.addEventListener('toggle', async () => {
      if (!card.open || loading || loaded) return;
      loading = true;
      dates.textContent = 'جارٍ تحميل الأيام…';
      try {
        const response = await config.api('dates', {siteId: archive.id});
        const list = element('ul', '');
        for (const date of response.dates || []) {
          const query = new URLSearchParams({siteId: archive.id, date});
          const link = element('a', date);
          link.href = 'schedule-history.html?' + query;
          const item = element('li', '');
          item.append(link);
          list.append(item);
        }
        dates.replaceChildren(list.childElementCount ? list : element('p', 'لا توجد أيام محفوظة.'));
        loaded = true;
      } catch (error) {
        dates.textContent = error.message + ' — أغلق المجلد وافتحه للمحاولة مرة أخرى.';
      } finally {
        loading = false;
      }
    });
    return card;
  }

  async function load() {
    if (!config?.session()) {
      status.textContent = 'سجّل دخول المدرسة في لوحة الرصد، ثم ارجع للأرشيف.';
      return;
    }
    status.textContent = 'جارٍ تحميل المدارس المؤرشفة…';
    try {
      const {archives} = await config.api('commercialSchoolArchives');
      folders.replaceChildren(...archives.map(schoolFolder));
      status.textContent = archives.length ? '' : 'لا توجد مدارس مؤرشفة.';
    } catch (error) {
      status.textContent = error.message;
    }
  }

  void load();
})();
