(() => {
  'use strict';
  let pending = null;
  let banner = null;
  function lock() {
    const editor = document.querySelector('main');
    if (editor) editor.inert = true;
    if (banner) return;
    banner = document.createElement('aside');
    banner.setAttribute('role', 'alert');
    banner.style.cssText = 'max-width:1100px;margin:20px auto;padding:20px;background:#fff6df;border:1px solid #edcf8e;border-radius:12px;color:#142b3b;font-family:Segoe UI,Arial,sans-serif';
    const note = document.createElement('p');
    note.textContent = 'Login admin perlu diverifikasi kembali. Draf Anda tetap tersedia di halaman ini.';
    const link = document.createElement('a');
    link.textContent = 'Masuk kembali'; link.href = '/admin/'; link.target = '_blank'; link.rel = 'noopener noreferrer';
    const retry = document.createElement('button');
    retry.type = 'button'; retry.textContent = 'Periksa login kembali'; retry.style.marginLeft = '20px';
    retry.addEventListener('click', () => ensure().catch(() => {}));
    banner.append(note, link, retry);
    if (editor) editor.before(banner); else document.body.prepend(banner);
  }
  function unlock() {
    const restored = Boolean(banner);
    const editor = document.querySelector('main');
    if (editor) editor.inert = false;
    banner?.remove(); banner = null;
    if (restored) document.dispatchEvent(new CustomEvent('admin-access-restored'));
  }
  async function ensure() {
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch('/api/admin/session', {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
          headers: {Accept: 'application/json'},
        });
        const session = response.ok ? await response.json() : null;
        if (!session || session.authenticated !== true || session.login !== 'SDM-FTE') {
          throw new Error('Akses admin perlu diverifikasi kembali.');
        }
        if (typeof session.csrfToken === 'string' && /^[A-Za-z0-9_-]{43}$/.test(session.csrfToken)) {
          document.querySelectorAll('input[name="csrf"]').forEach(input => { input.value = session.csrfToken; });
        }
        unlock(); return session;
      } catch (error) {
        lock();
        throw error;
      } finally {
        clearTimeout(timer);
        pending = null;
      }
    })();
    return pending;
  }
  window.AdminAccess = Object.freeze({ensure});
  const check = () => { ensure().catch(() => {}); };
  window.addEventListener('pageshow', check);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
  setInterval(() => { if (!document.hidden) check(); }, 60000);
})();
