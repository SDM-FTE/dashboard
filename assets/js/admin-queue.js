(() => {
  'use strict';
  const endpoint = '/api/admin/queue';
  const ranks = [
    { code: 'AA', label: 'Asisten Ahli' }, { code: 'L', label: 'Lektor' },
    { code: 'LK', label: 'Lektor Kepala' }, { code: 'GB', label: 'Guru Besar' }
  ];
  const statuses = { queued: 'Dalam antrean', processing: 'Sedang diproses', completed: 'Selesai', cancelled: 'Dibatalkan' };
  const ids = ['queueLoadState', 'queueReload', 'queueMessage', 'queueLoginAgain', 'queuePendingCount', 'queuePendingEmpty', 'queuePendingList', 'queueAddForm', 'queueAddFields', 'queueLecturerSearch', 'queueLecturerCount', 'queueLecturerSelect', 'queueLecturerInfo', 'queueRankSelect', 'queueAddButton', 'queueApplicationsCount', 'queueApplicationsEmpty', 'queueApplicationsList'];
  const elements = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  if (Object.values(elements).some(element => !element)) return;
  const state = { roster: [], pending: [], applications: [], csrfToken: '', loaded: false, busy: false, authFailed: false, needsRefresh: false, restorePending: false, controls: [], statusDrafts: new Map() };

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  }
  function rank(value, allowEmpty) {
    const found = ranks.find(item => item.label === value || item.code === value);
    if (found) return found;
    if (allowEmpty && value === 'Belum memiliki JFA') return { code: '', label: value };
    throw new Error('Jabatan pada data antrean belum dapat dibaca. Hubungi pengelola.');
  }
  function validId(value) { return typeof value === 'string' && /^[A-Za-z0-9_-]{1,100}$/.test(value); }
  function text(value) { return typeof value === 'string' && value.trim() && value.length <= 300; }
  function validDate(value) { return typeof value === 'string' && value.length <= 40 && Number.isFinite(Date.parse(value)); }
  function identity(row) {
    if (!row || typeof row !== 'object' || !validId(String(row.id)) || !text(row.name) || !text(row.program)) throw new Error('Identitas dosen pada antrean tidak dapat dicocokkan. Hubungi pengelola.');
    return { id: String(row.id), name: row.name, program: row.program, currentRank: rank(row.currentRank, true).label };
  }
  function pendingRow(row) {
    const value = identity(row);
    if (!validDate(row.submittedAt) || ![undefined, 'pending', 'approving'].includes(row.status)) throw new Error('Data ajuan yang menunggu validasi belum dapat dibaca.');
    return { ...value, proposedRank: rank(row.proposedRank).label, submittedAt: row.submittedAt, status: row.status || 'pending' };
  }
  function applicationRow(row) {
    const value = identity(row);
    if (!Number.isSafeInteger(row.number) || row.number < 1 || !Object.hasOwn(statuses, row.status) || !validDate(row.submittedAt) || !validDate(row.approvedAt) || !/^[a-f0-9]{64}$/.test(row.baseVersion || '') || (row.position != null && (!Number.isSafeInteger(row.position) || row.position < 1))) throw new Error('Data ajuan bernomor belum dapat dibaca. Muat ulang sebelum memperbarui antrean.');
    return { ...value, number: row.number, proposedRank: rank(row.proposedRank).label, status: row.status, submittedAt: row.submittedAt, approvedAt: row.approvedAt, position: row.position == null ? null : row.position, baseVersion: row.baseVersion };
  }
  function snapshot(data) {
    if (!data || !/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken || '') || !Array.isArray(data.roster) || !data.roster.length || data.roster.length > 2000 || !Array.isArray(data.pending) || data.pending.length > 2000 || !Array.isArray(data.applications) || data.applications.length > 20000) throw new Error('Data antrean belum dapat dibaca. Silakan muat ulang.');
    const roster = data.roster.map(identity), pending = data.pending.map(pendingRow), applications = data.applications.map(applicationRow);
    for (const rows of [roster, pending, applications]) if (new Set(rows.map(row => row.id)).size !== rows.length) throw new Error('Identitas ajuan pada data terbaru tidak unik. Hubungi pengelola.');
    if (new Set(applications.map(row => row.number)).size !== applications.length) throw new Error('Nomor ajuan pada data terbaru tidak unik. Hubungi pengelola.');
    return { roster, pending, applications, csrfToken: data.csrfToken };
  }
  function showMessage(value, error) {
    elements.queueMessage.textContent = value;
    elements.queueMessage.className = 'queue-message' + (error ? ' queue-error' : '');
    elements.queueMessage.hidden = !value;
  }
  function accessFailure(status) {
    if (status === 401 || status === 403) { state.authFailed = true; elements.queueLoginAgain.hidden = false; }
  }
  function dateLabel(value) {
    return new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(new Date(value)) + ' WIB';
  }
  function selectedLecturer() { return state.roster.find(row => row.id === elements.queueLecturerSelect.value) || null; }
  function allowedRank(lecturer, code) {
    if (!lecturer) return false;
    const current = ranks.findIndex(item => item.label === lecturer.currentRank);
    return ranks.findIndex(item => item.code === code) > current;
  }
  function addReady() {
    const lecturer = selectedLecturer();
    return Boolean(lecturer && ranks.some(item => item.code === elements.queueRankSelect.value) && allowedRank(lecturer, elements.queueRankSelect.value));
  }
  function controls() {
    const enabled = state.loaded && !state.busy && !state.authFailed && !state.needsRefresh;
    elements.queueAddFields.disabled = !enabled;
    elements.queueAddButton.disabled = !enabled || !addReady();
    elements.queueAddButton.textContent = state.busy ? 'Mohon tunggu…' : 'Tambahkan ke antrean';
    elements.queueReload.disabled = state.busy;
    elements.queueReload.textContent = state.authFailed ? 'Periksa akses' : 'Muat ulang';
    state.controls.forEach(({ element, canUse }) => { element.disabled = !enabled || Boolean(canUse && !canUse()); });
  }
  function addControl(element, canUse) { state.controls.push({ element, canUse }); return element; }
  function renderLecturers() {
    const currentId = elements.queueLecturerSelect.value;
    const query = elements.queueLecturerSearch.value.trim().toLocaleLowerCase('id');
    const matches = state.roster.filter(row => (row.id + ' ' + row.name).toLocaleLowerCase('id').includes(query));
    const current = state.roster.find(row => row.id === currentId);
    const visible = current && !matches.includes(current) ? [current, ...matches] : matches;
    const options = [Object.assign(node('option', 'Pilih dosen…'), { value: '' }), ...visible.map(row => Object.assign(node('option', row.name + ' · ' + row.program + (query && !matches.includes(row) ? ' (dipilih)' : '')), { value: row.id }))];
    elements.queueLecturerSelect.replaceChildren(...options);
    elements.queueLecturerSelect.value = current ? current.id : '';
    elements.queueLecturerCount.textContent = query ? matches.length + ' dosen cocok dengan pencarian.' : state.roster.length + ' dosen tersedia.';
    renderRanks();
  }
  function renderRanks() {
    const previous = elements.queueRankSelect.value;
    const lecturer = selectedLecturer();
    const offered = lecturer ? ranks.filter(item => allowedRank(lecturer, item.code)) : [];
    const options = [Object.assign(node('option', 'Pilih jabatan tujuan…'), { value: '' }), ...offered.map(item => Object.assign(node('option', item.label), { value: item.code }))];
    if (previous && !offered.some(item => item.code === previous) && ranks.some(item => item.code === previous)) options.push(Object.assign(node('option', ranks.find(item => item.code === previous).label + ' (tidak tersedia)'), { value: previous }));
    elements.queueRankSelect.replaceChildren(...options);
    elements.queueRankSelect.value = previous;
    elements.queueLecturerInfo.textContent = lecturer ? lecturer.program + ' · Jabatan saat ini: ' + lecturer.currentRank + (lecturer.currentRank === 'Guru Besar' ? '. Tidak ada jabatan tujuan yang lebih tinggi.' : '.') : 'Prodi dan jabatan saat ini akan ditampilkan setelah dosen dipilih.';
    controls();
  }
  function renderPending() {
    elements.queuePendingCount.textContent = state.pending.length + ' ajuan';
    elements.queuePendingEmpty.hidden = state.pending.length > 0;
    const rows = state.pending.map(row => {
      const article = node('article', undefined, 'queue-pending-item');
      const details = node('div');
      if (row.status === 'approving') details.append(node('span', 'Persetujuan perlu diselesaikan', 'queue-pending-badge'));
      details.append(node('h3', row.name), node('p', row.program, 'queue-item-details'), node('p', row.currentRank + ' → ' + row.proposedRank, 'queue-item-rank'), node('p', 'Diajukan ' + dateLabel(row.submittedAt) + ' · Belum mendapat nomor', 'queue-item-date'));
      const actions = node('div', undefined, 'queue-item-actions');
      const approve = addControl(node('button', row.status === 'approving' ? 'Selesaikan persetujuan' : 'Setujui dan beri nomor', 'queue-primary'));
      approve.type = 'button'; approve.setAttribute('aria-label', (row.status === 'approving' ? 'Selesaikan persetujuan ' : 'Setujui ajuan ') + row.name);
      approve.addEventListener('click', () => mutate({ action: 'approve', id: row.id }, row));
      const reject = addControl(node('button', 'Tolak', 'queue-danger'), () => row.status !== 'approving');
      reject.type = 'button'; reject.setAttribute('aria-label', 'Tolak ajuan ' + row.name);
      reject.addEventListener('click', () => { if (!state.busy && row.status !== 'approving' && window.confirm('Tolak pengajuan ' + row.name + ' ke ' + row.proposedRank + '? Pengajuan ini tidak akan mendapat nomor antrean.')) return mutate({ action: 'reject', id: row.id }, row); });
      actions.append(approve, reject); article.append(details, actions); return article;
    });
    elements.queuePendingList.replaceChildren(...rows);
  }
  function renderApplications() {
    elements.queueApplicationsCount.textContent = state.applications.length + ' ajuan';
    elements.queueApplicationsEmpty.hidden = state.applications.length > 0;
    const rows = [...state.applications].sort((a, b) => a.number - b.number).map(row => {
      const article = node('article', undefined, 'queue-application');
      const ticket = node('div');
      ticket.append(node('span', 'No. ajuan', 'queue-ticket-label'), node('strong', String(row.number), 'queue-ticket-number'), node('span', row.position === null ? 'Tidak dalam antrean aktif' : 'Urutan aktif ' + row.position, 'queue-position'));
      const details = node('div'); details.append(node('h3', row.name), node('p', row.program, 'queue-item-details'), node('p', row.currentRank + ' → ' + row.proposedRank, 'queue-item-rank'), node('p', 'Disetujui ' + dateLabel(row.approvedAt), 'queue-item-date'));
      const actions = node('div', undefined, 'queue-status-controls');
      const draft = state.statusDrafts.get(row.id);
      const label = node('label', 'Status penanganan'); label.htmlFor = 'queue-status-' + row.id;
      const select = addControl(node('select')); select.id = 'queue-status-' + row.id;
      select.setAttribute('aria-label', 'Status ajuan nomor ' + row.number);
      select.replaceChildren(...Object.entries(statuses).map(([value, title]) => Object.assign(node('option', title), { value })));
      select.value = draft ? draft.value : row.status;
      const save = addControl(node('button', 'Simpan', 'queue-primary'), () => { const value = state.statusDrafts.get(row.id); return Boolean(value && !value.conflict && value.value !== row.status); });
      save.type = 'button'; save.setAttribute('aria-label', 'Simpan status ajuan nomor ' + row.number);
      select.addEventListener('change', () => {
        if (state.busy || !Object.hasOwn(statuses, select.value)) return;
        if (select.value === row.status) state.statusDrafts.delete(row.id);
        else state.statusDrafts.set(row.id, { value: select.value, baseVersion: draft ? draft.baseVersion : row.baseVersion, conflict: Boolean(draft && draft.conflict) });
        renderLists(); controls();
      });
      save.addEventListener('click', () => {
        const value = state.statusDrafts.get(row.id);
        if (value && !value.conflict) return mutate({ action: 'status', id: row.id, status: value.value, baseVersion: value.baseVersion }, row);
      });
      actions.append(label, select, save);
      if (draft) {
        actions.append(node('p', draft.conflict ? 'Status terbaru: ' + statuses[row.status] + '. Pilihan Anda belum disimpan.' : 'Perubahan belum disimpan.', 'queue-status-note' + (draft.conflict ? '' : ' queue-status-dirty')));
        if (draft.conflict) {
          const reset = addControl(node('button', 'Gunakan status terbaru', 'queue-text-button queue-status-reset'));
          reset.type = 'button';
          reset.addEventListener('click', () => { if (!state.busy && window.confirm('Ganti pilihan yang belum disimpan dengan status terbaru untuk ajuan ' + row.name + '?')) { state.statusDrafts.delete(row.id); renderLists(); controls(); } });
          actions.append(reset);
        }
      }
      article.append(ticket, details, actions); return article;
    });
    elements.queueApplicationsList.replaceChildren(...rows);
  }
  function renderLists() { state.controls = []; renderPending(); renderApplications(); }
  function accept(data) {
    const next = snapshot(data);
    for (const [id, draft] of state.statusDrafts) {
      const row = next.applications.find(item => item.id === id);
      if (!row || row.status === draft.value) state.statusDrafts.delete(id);
      else if (row.baseVersion !== draft.baseVersion) draft.conflict = true;
    }
    Object.assign(state, next, { loaded: true, authFailed: false, needsRefresh: false });
    elements.queueLoginAgain.hidden = true;
    renderLecturers(); renderLists(); controls();
  }
  async function request(method, payload) {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 30000);
    try {
      const headers = { Accept: 'application/json' };
      if (payload) { headers['Content-Type'] = 'application/json'; headers['X-CSRF-Token'] = state.csrfToken; }
      const response = await fetch(endpoint, { method, credentials: 'same-origin', cache: 'no-store', headers, signal: controller.signal, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      let data; try { data = await response.json(); } catch (_) { throw new Error('Layanan antrean belum dapat dibaca. Pilihan Anda tetap tersedia.'); }
      return { status: response.status, ok: response.ok, data };
    } finally { clearTimeout(timer); }
  }
  function errorText(error) { return error && error.name === 'AbortError' ? 'Permintaan terlalu lama. Muat data terbaru sebelum mencoba menyimpan kembali. Pilihan Anda tetap tersedia.' : error && error.message ? error.message : 'Pembaruan belum berhasil. Pilihan Anda tetap tersedia.'; }
  async function reload(options) {
    if (state.busy) { if (options && options.restored) state.restorePending = true; return; }
    state.busy = true; controls(); elements.queueLoadState.textContent = 'Memuat data terbaru…';
    try {
      const result = await request('GET');
      if (!result.ok) { accessFailure(result.status); throw new Error(result.data.message || 'Data antrean terbaru belum dapat dimuat.'); }
      accept(result.data); elements.queueLoadState.textContent = 'Data antrean terbaru sudah dimuat.';
      if (!options || !options.initial) showMessage('Daftar terbaru sudah dimuat. Pilihan yang belum disimpan tetap tersedia; tinjau kembali jika status ajuan telah berubah.', false);
    } catch (error) { elements.queueLoadState.textContent = 'Data terbaru belum dapat dimuat.'; showMessage(errorText(error), true); }
    finally { state.busy = false; controls(); if (state.restorePending) { state.restorePending = false; reload({ restored: true }); } }
  }
  async function verifyAccess() {
    if (!window.AdminAccess || typeof window.AdminAccess.ensure !== 'function') throw new Error('Verifikasi admin belum tersedia. Masuk kembali melalui halaman admin.');
    const session = await window.AdminAccess.ensure();
    if (!session || session.authenticated !== true || session.login !== 'SDM-FTE' || !/^[A-Za-z0-9_-]{43}$/.test(session.csrfToken || '')) throw new Error('Akses admin perlu diverifikasi kembali. Masuk kembali melalui halaman admin.');
    state.csrfToken = session.csrfToken;
  }
  function verifiedSuccess(data, payload, reviewedRow) {
    if (!data || typeof data !== 'object') throw new Error('Hasil pembaruan belum dapat dipastikan. Muat data terbaru sebelum mencoba kembali.');
    if (payload.action === 'reject') {
      if (data.saved !== true || data.rejected !== true || data.id !== payload.id) throw new Error('Hasil penolakan belum dapat dipastikan. Muat data terbaru.');
      return null;
    }
    const application = applicationRow(data.application);
    if ((payload.action !== 'add' && application.id !== payload.id) || application.name !== reviewedRow.name || application.program !== reviewedRow.program || (payload.action === 'status' && application.status !== payload.status) || (payload.action === 'add' && application.proposedRank !== rank(payload.proposedRank).label)) throw new Error('Hasil pembaruan berbeda dari pilihan Anda. Muat data terbaru untuk memeriksanya.');
    if (data.saved !== true && !(data.saved === false && data.unchanged === true)) throw new Error('Hasil pembaruan belum dapat dipastikan. Muat data terbaru sebelum mencoba kembali.');
    return application;
  }
  async function mutate(payload, reviewedRow) {
    if (state.busy || !state.loaded || state.authFailed || state.needsRefresh) return;
    if (payload.action === 'add') {
      if (!addReady() || !selectedLecturer() || selectedLecturer().id !== payload.lecturerId) return;
    } else if (!reviewedRow || (payload.action === 'status' ? !state.applications.some(row => row.id === payload.id) : !state.pending.some(row => row.id === payload.id))) return;
    state.busy = true; controls(); let posted = false; let confirmed = false; let confirmedMessage = '';
    try {
      await verifyAccess();
      showMessage('Menyimpan pembaruan antrean…', false);
      posted = true;
      const result = await request('POST', payload);
      if (!result.ok) {
        accessFailure(result.status);
        if (result.status === 409) state.needsRefresh = true;
        throw new Error((result.data.message || 'Pembaruan belum berhasil.') + ' Pilihan Anda tetap tersedia. Muat data terbaru sebelum mencoba kembali.');
      }
      const application = verifiedSuccess(result.data, payload, reviewedRow); confirmed = true;
      if (payload.action === 'status') state.statusDrafts.delete(payload.id);
      if (payload.action === 'add') { elements.queueLecturerSelect.value = ''; elements.queueRankSelect.value = ''; elements.queueLecturerSearch.value = ''; }
      const unchanged = result.data.saved === false && result.data.unchanged === true;
      const fallback = payload.action === 'reject' ? 'Pengajuan ' + reviewedRow.name + ' ditolak tanpa memberikan nomor antrean.' : payload.action === 'status' ? 'Status ajuan ' + application.name + (unchanged ? ' sudah sama dengan data tersimpan.' : ' berhasil disimpan.') : 'Pengajuan ' + application.name + (unchanged ? ' sudah memiliki nomor ajuan ' : ' disetujui dengan nomor ajuan ') + application.number + '.';
      const success = typeof result.data.message === 'string' && result.data.message.trim() && result.data.message.length <= 1000 ? result.data.message : fallback;
      confirmedMessage = success;
      const latest = await request('GET');
      if (!latest.ok) { accessFailure(latest.status); state.needsRefresh = true; showMessage(success + ' Daftar terbaru belum dapat dimuat. Pilih Muat ulang untuk memeriksa hasilnya.', true); return; }
      accept(latest.data); elements.queueLoadState.textContent = 'Data antrean terbaru sudah dimuat.'; showMessage(success, false);
    } catch (error) {
      if (posted) state.needsRefresh = true;
      if (!posted) { state.authFailed = true; elements.queueLoginAgain.hidden = false; }
      showMessage(confirmed ? confirmedMessage + ' Daftar terbaru belum dapat dibaca. Muat ulang untuk memeriksa hasilnya.' : errorText(error), true);
    } finally {
      state.busy = false; controls();
      if (state.restorePending) { state.restorePending = false; reload({ restored: true }); }
    }
  }
  elements.queueLecturerSearch.addEventListener('input', () => { if (!state.busy && state.loaded) renderLecturers(); });
  elements.queueLecturerSelect.addEventListener('change', () => { if (!state.busy && state.loaded) renderRanks(); });
  elements.queueRankSelect.addEventListener('change', controls);
  elements.queueAddForm.addEventListener('submit', event => { event.preventDefault(); const lecturer = selectedLecturer(); if (lecturer && addReady()) return mutate({ action: 'add', lecturerId: lecturer.id, proposedRank: rank(elements.queueRankSelect.value).label }, lecturer); });
  elements.queueReload.addEventListener('click', () => reload());
  document.addEventListener('admin-access-restored', () => reload({ restored: true }));
  window.addEventListener('beforeunload', event => { if (elements.queueLecturerSelect.value || elements.queueRankSelect.value || state.statusDrafts.size) { event.preventDefault(); event.returnValue = ''; } });
  reload({ initial: true });
})();
