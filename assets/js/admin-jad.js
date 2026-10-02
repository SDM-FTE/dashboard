(() => {
  'use strict';

  const endpoint = '/api/admin/progress';
  const stages = ['Pengecekan ajuan', 'Pengesahan', 'Penugasan asesor', 'Penilaian', 'Verifikasi SK', 'Selesai'];
  const requirementLabels = { paperPdf: 'Paper terbit (PDF)', similarity: 'Hasil similarity', correspondence: 'Korespondensi syarat utama' };
  const keys = Object.keys(requirementLabels);
  const get = (id) => document.getElementById(id);
  const elements = Object.fromEntries([
    'pageMessage', 'loginAgain', 'lecturerSearch', 'searchCount', 'lecturerSelect', 'selectedLecturer', 'lecturerName', 'lecturerId',
    'lecturerPublicLink', 'baselineStatus', 'reloadProgress', 'jadForm', 'jadFields', 'stageSelect', 'paperPdfSelect', 'similaritySelect',
    'correspondenceSelect', 'draftBadge', 'conflictPanel', 'conflictDetails', 'loadConflict', 'saveHint', 'saveProgress'
  ].map((id) => [id, get(id)]));
  if (Object.values(elements).some((element) => !element)) return;

  const state = { lecturers: [], selectedId: '', csrfToken: '', busy: false, loaded: false, conflict: null, authFailed: false, recoveryPending: false };

  function checkedLecturer(value) {
    if (!value || typeof value !== 'object' || !/^[1-9]\d{0,7}$/.test(String(value.id)) || typeof value.name !== 'string' || !value.name.trim() || value.name.length > 300 || !/^[a-f0-9]{64}$/.test(value.baseVersion || '')) throw new Error('Data progres belum dapat dibaca. Muat ulang atau hubungi pengelola.');
    if (value.stage !== null && (!Number.isInteger(value.stage) || value.stage < 0 || value.stage >= stages.length)) throw new Error('Status ajuan pada data tersimpan tidak valid.');
    const requirements = value.requirements;
    if (!requirements || typeof requirements !== 'object' || keys.some((key) => requirements[key] !== null && typeof requirements[key] !== 'boolean')) throw new Error('Status syarat penelitian pada data tersimpan tidak valid.');
    return { id: String(value.id), name: value.name, stage: value.stage, requirements: Object.fromEntries(keys.map((key) => [key, requirements[key]])), baseVersion: value.baseVersion };
  }

  function selected() {
    return state.lecturers.find((lecturer) => lecturer.id === state.selectedId) || null;
  }

  function checkedSnapshot(data) {
    if (!data || !Array.isArray(data.lecturers) || !data.lecturers.length || data.lecturers.length > 500 || !/^[A-Za-z0-9_-]{43}$/.test(data.csrfToken || '') || !Array.isArray(data.stages) || data.stages.length !== stages.length || data.stages.some((label, index) => label !== stages[index])) throw new Error('Data progres belum dapat dibaca. Muat ulang atau hubungi pengelola.');
    const lecturers = data.lecturers.map(checkedLecturer);
    if (new Set(lecturers.map((lecturer) => lecturer.id)).size !== lecturers.length) throw new Error('Identitas dosen pada progres tidak dapat dicocokkan. Hubungi pengelola.');
    return { lecturers, csrfToken: data.csrfToken };
  }

  function draft() {
    const stageValue = elements.stageSelect.value;
    if (stageValue !== '' && !/^[0-5]$/.test(stageValue)) throw new Error('Pilih status ajuan yang tersedia.');
    const requirements = {};
    for (const key of keys) {
      const value = elements[key + 'Select'].value;
      if (!['', 'true', 'false'].includes(value)) throw new Error('Pilih status syarat penelitian yang tersedia.');
      requirements[key] = value === '' ? null : value === 'true';
    }
    return { stage: stageValue === '' ? null : Number(stageValue), requirements };
  }

  function dirty() {
    const lecturer = selected();
    if (!lecturer) return false;
    try {
      const value = draft();
      return value.stage !== lecturer.stage || keys.some((key) => value.requirements[key] !== lecturer.requirements[key]);
    } catch (_) {
      return true;
    }
  }

  function formValid() {
    try { draft(); return true; } catch (_) { return false; }
  }

  function message(text, error) {
    elements.pageMessage.textContent = text;
    elements.pageMessage.className = 'message' + (error ? ' error' : '');
    elements.pageMessage.hidden = !text;
  }

  function accessError(status) {
    if (status === 401 || status === 403) {
      state.authFailed = true;
      elements.loginAgain.hidden = false;
    }
  }

  function renderOptions() {
    const query = elements.lecturerSearch.value.trim().toLocaleLowerCase('id');
    const matches = state.lecturers.filter((lecturer) => (lecturer.id + ' ' + lecturer.name).toLocaleLowerCase('id').includes(query));
    const current = selected();
    const visible = current && !matches.some((lecturer) => lecturer.id === current.id) ? [current, ...matches] : matches;
    const options = visible.map((lecturer) => {
      const option = document.createElement('option');
      option.value = lecturer.id;
      option.textContent = lecturer.id + ' · ' + lecturer.name + (query && !matches.includes(lecturer) ? ' (dipilih)' : '');
      return option;
    });
    elements.lecturerSelect.replaceChildren(...options);
    elements.lecturerSelect.value = state.selectedId;
    elements.searchCount.textContent = query ? matches.length + ' dosen cocok dengan pencarian.' : state.lecturers.length + ' dosen tersedia.';
  }

  function fillForm(lecturer) {
    elements.stageSelect.value = lecturer.stage === null ? '' : String(lecturer.stage);
    keys.forEach((key) => { elements[key + 'Select'].value = lecturer.requirements[key] === null ? '' : String(lecturer.requirements[key]); });
    elements.lecturerName.textContent = lecturer.name;
    elements.lecturerId.textContent = 'ID ' + lecturer.id;
    elements.lecturerPublicLink.href = '/#jad-progress/' + lecturer.id;
    elements.selectedLecturer.hidden = false;
    state.conflict = null;
    elements.conflictPanel.hidden = true;
  }

  function updateControls() {
    const enabled = state.loaded && !state.busy && !state.authFailed && Boolean(selected());
    const hasChanges = dirty();
    elements.lecturerSearch.disabled = !enabled;
    elements.lecturerSelect.disabled = !enabled;
    elements.jadFields.disabled = !enabled;
    elements.reloadProgress.disabled = state.busy;
    elements.reloadProgress.textContent = state.authFailed ? 'Periksa akses' : 'Muat ulang';
    elements.loadConflict.disabled = state.busy || state.authFailed;
    elements.saveProgress.disabled = !enabled || !hasChanges || !formValid() || Boolean(state.conflict);
    elements.saveProgress.textContent = state.busy ? 'Mohon tunggu…' : 'Simpan perubahan';
    elements.draftBadge.className = 'badge' + (hasChanges && !state.conflict ? ' ready' : '');
    elements.draftBadge.textContent = state.busy ? 'Memproses' : state.conflict ? 'Perlu ditinjau ulang' : !state.loaded ? 'Belum dimuat' : hasChanges ? 'Belum disimpan' : 'Sesuai data tersimpan';
    elements.saveHint.textContent = state.conflict ? 'Muat data terbaru sebelum menyimpan lagi.' : hasChanges ? 'Perubahan hanya untuk ' + (selected() ? selected().name : 'dosen ini') + '.' : 'Belum ada perubahan.';
  }

  async function request(method, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25000);
    try {
      const headers = { Accept: 'application/json' };
      if (payload) {
        headers['Content-Type'] = 'application/json';
        headers['X-CSRF-Token'] = state.csrfToken;
      }
      const reply = await fetch(endpoint, { method, credentials: 'same-origin', cache: 'no-store', headers, signal: controller.signal, ...(payload ? { body: JSON.stringify(payload) } : {}) });
      let data;
      try { data = await reply.json(); } catch (_) { throw new Error('Layanan pembaruan belum dapat dibaca. Perubahan Anda tetap ada di form.'); }
      return { status: reply.status, ok: reply.ok, data };
    } finally {
      clearTimeout(timer);
    }
  }

  function errorText(error) {
    return error && error.name === 'AbortError' ? 'Permintaan terlalu lama. Perubahan Anda tetap ada di form; periksa koneksi lalu coba kembali.' : error && error.message ? error.message : 'Pembaruan belum berhasil. Perubahan Anda tetap ada di form.';
  }

  async function loadProgress(options) {
    if (state.busy || state.authFailed) return;
    if (dirty() && !window.confirm('Ada perubahan yang belum disimpan. Muat data terbaru dan ganti perubahan di form ini?')) return;
    state.busy = true;
    updateControls();
    elements.baselineStatus.textContent = 'Memuat progres terbaru…';
    try {
      const result = await request('GET');
      if (!result.ok) {
        accessError(result.status);
        throw new Error(result.data.message || 'Progres terbaru belum dapat dimuat. Silakan coba kembali.');
      }
      const data = checkedSnapshot(result.data);
      const lecturers = data.lecturers;
      let desiredId = state.selectedId;
      if (!desiredId && options && options.initial) desiredId = new URLSearchParams(window.location.search).get('dosen') || '';
      state.lecturers = lecturers;
      state.selectedId = lecturers.some((lecturer) => lecturer.id === desiredId) ? desiredId : lecturers[0].id;
      state.csrfToken = data.csrfToken;
      state.loaded = true;
      state.authFailed = false;
      elements.loginAgain.hidden = true;
      fillForm(selected());
      renderOptions();
      elements.baselineStatus.textContent = 'Progres terbaru sudah dimuat.';
      message(options && options.initial ? '' : 'Data terbaru sudah dimuat. Silakan periksa status sebelum mengubahnya.', false);
    } catch (error) {
      elements.baselineStatus.textContent = 'Data terbaru belum dapat dimuat.';
      message(errorText(error), true);
    } finally {
      state.busy = false;
      updateControls();
      if (state.recoveryPending) { state.recoveryPending = false; restoreAccess(); }
    }
  }

  function showConflict(lecturer) {
    state.conflict = lecturer;
    const values = [['Status ajuan', lecturer.stage === null ? 'Belum diperbarui' : stages[lecturer.stage]], ...keys.map((key) => [requirementLabels[key], lecturer.requirements[key] === null ? 'Belum diperiksa' : lecturer.requirements[key] ? 'Lengkap' : 'Belum lengkap'])];
    const nodes = values.flatMap(([label, value]) => {
      const term = document.createElement('dt');
      const detail = document.createElement('dd');
      term.textContent = label;
      detail.textContent = value;
      return [term, detail];
    });
    elements.conflictDetails.replaceChildren(...nodes);
    elements.conflictPanel.hidden = false;
  }

  async function restoreAccess() {
    if (state.busy) { state.recoveryPending = true; return; }
    if (!state.loaded) { state.authFailed = false; return loadProgress({ initial: true }); }
    const previous = selected();
    state.busy = true;
    updateControls();
    try {
      const result = await request('GET');
      if (!result.ok) { accessError(result.status); throw new Error(result.data.message || 'Akses belum dapat diperiksa. Perubahan Anda tetap ada di form.'); }
      const data = checkedSnapshot(result.data);
      const latest = data.lecturers.find((lecturer) => lecturer.id === state.selectedId);
      if (!latest || !previous) throw new Error('Identitas dosen ini tidak ditemukan pada data terbaru. Perubahan Anda tetap ada di form; hubungi pengelola.');
      state.lecturers = data.lecturers.map((lecturer) => lecturer.id === previous.id ? previous : lecturer);
      state.csrfToken = data.csrfToken;
      state.authFailed = false;
      elements.loginAgain.hidden = true;
      if (latest.baseVersion !== previous.baseVersion) {
        showConflict(latest);
        message('Akses admin sudah aktif kembali, tetapi data dosen ini telah berubah. Perubahan Anda tetap ada di form. Muat data terbaru untuk meninjau ulang.', true);
      } else {
        state.conflict = null;
        elements.conflictPanel.hidden = true;
        message('Akses admin sudah aktif kembali. Perubahan yang belum disimpan tetap ada di form.', false);
      }
      renderOptions();
      elements.baselineStatus.textContent = 'Akses admin dan data terbaru sudah diperiksa.';
    } catch (error) {
      message(errorText(error), true);
    } finally {
      state.busy = false;
      updateControls();
      if (state.recoveryPending) { state.recoveryPending = false; restoreAccess(); }
    }
  }

  async function saveProgress(event) {
    if (event) event.preventDefault();
    if (state.busy || state.authFailed || !state.loaded || !dirty() || !formValid() || state.conflict) return;
    const lecturer = selected();
    if (!lecturer) return;
    const values = draft();
    const payload = { id: lecturer.id, stage: values.stage, requirements: values.requirements, baseVersion: lecturer.baseVersion };
    state.busy = true;
    updateControls();
    message('Menyimpan progres ' + lecturer.name + '…', false);
    try {
      const result = await request('POST', payload);
      if (result.status === 409) {
        const latest = checkedLecturer(result.data.lecturer);
        if (latest.id !== lecturer.id) throw new Error('Identitas dosen pada tanggapan pembaruan tidak sesuai. Muat data terbaru.');
        showConflict(latest);
        message('Data dosen ini telah diperbarui sejak Anda membuka form. Perubahan Anda belum disimpan dan tetap ada di form. Muat data terbaru untuk meninjau ulang.', true);
        return;
      }
      if (!result.ok) {
        accessError(result.status);
        throw new Error((result.data.message || 'Pembaruan belum berhasil.') + ' Perubahan Anda tetap ada di form.');
      }
      if (result.data.saved !== true && !(result.data.saved === false && result.data.unchanged === true)) throw new Error('Hasil penyimpanan belum dapat dipastikan. Muat data terbaru sebelum mencoba kembali.');
      const updated = checkedLecturer(result.data.lecturer);
      if (updated.id !== lecturer.id || updated.stage !== payload.stage || keys.some((key) => updated.requirements[key] !== payload.requirements[key])) throw new Error('Hasil penyimpanan berbeda dari form. Muat data terbaru untuk memeriksanya.');
      state.lecturers = state.lecturers.map((row) => row.id === updated.id ? updated : row);
      fillForm(updated);
      renderOptions();
      elements.baselineStatus.textContent = 'Progres terbaru sudah tersimpan.';
      message(result.data.saved ? 'Progres ' + updated.name + ' berhasil disimpan. Tunggu penerbitan selesai, lalu periksa dashboard.' : 'Progres ' + updated.name + ' sudah sama dengan data tersimpan.', false);
    } catch (error) {
      message(errorText(error), true);
    } finally {
      state.busy = false;
      updateControls();
      if (state.recoveryPending) { state.recoveryPending = false; restoreAccess(); }
    }
  }

  elements.lecturerSearch.addEventListener('input', () => { if (!state.busy && state.loaded) renderOptions(); });
  elements.lecturerSelect.addEventListener('change', () => {
    if (state.busy || !state.loaded || state.authFailed) { elements.lecturerSelect.value = state.selectedId; return; }
    const id = elements.lecturerSelect.value;
    if (id === state.selectedId) return;
    if (!state.lecturers.some((lecturer) => lecturer.id === id) || (id !== state.selectedId && dirty() && !window.confirm('Ada perubahan yang belum disimpan. Pindah dosen dan batalkan perubahan ini?'))) { elements.lecturerSelect.value = state.selectedId; return; }
    state.selectedId = id;
    fillForm(selected());
    renderOptions();
    message('', false);
    updateControls();
  });
  [elements.stageSelect, ...keys.map((key) => elements[key + 'Select'])].forEach((element) => element.addEventListener('change', () => { if (!state.busy) { message('', false); updateControls(); } }));
  elements.reloadProgress.addEventListener('click', () => state.authFailed ? restoreAccess() : loadProgress());
  elements.loadConflict.addEventListener('click', () => loadProgress());
  elements.jadForm.addEventListener('submit', saveProgress);
  window.addEventListener('beforeunload', (event) => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  document.addEventListener('admin-access-restored', restoreAccess);
  loadProgress({ initial: true });
})();
