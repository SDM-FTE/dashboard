(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const endpoint = '/api/jad-applications';
  const labels = {pending: 'Menunggu validasi', rejected: 'Belum disetujui admin', queued: 'Dalam antrean', processing: 'Diproses', completed: 'Selesai', cancelled: 'Dibatalkan'};
  const ranks = ['Asisten Ahli', 'Lektor', 'Lektor Kepala', 'Guru Besar'];
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  let applications = [], roster = [], formToken = '', loading = false, submitting = false, tracking = false, ready = false;
  const normal = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const make = (tag, value, className) => {
    const element = document.createElement(tag);
    if (value != null) element.textContent = value;
    if (className) element.className = className;
    return element;
  };
  const message = (value, error = false) => {
    $('queuePageMessage').textContent = value;
    $('queuePageMessage').className = 'queue-message' + (error ? ' error' : '');
    $('queuePageMessage').hidden = !value;
  };
  async function request(url, options = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(url, {...options, credentials: 'same-origin', cache: 'no-store', signal: controller.signal});
      let body;
      try { body = await response.json(); } catch { throw new Error('Layanan belum dapat dibaca. Coba muat ulang beberapa saat lagi.'); }
      if (!response.ok) {
        const error = new Error(typeof body.message === 'string' ? body.message : 'Permintaan belum berhasil. Silakan coba lagi.');
        error.status = response.status;
        throw error;
      }
      return body;
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Koneksi membutuhkan waktu terlalu lama. Isian Anda tetap tersedia; silakan coba lagi.');
      if (error instanceof TypeError) throw new Error('Belum terhubung ke layanan. Periksa koneksi Anda dan coba lagi.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function validateData(data) {
    if (!data || !Array.isArray(data.applications) || !Array.isArray(data.roster) || typeof data.formToken !== 'string' || !data.formToken) throw new Error('Data antrean belum siap. Coba muat ulang.');
    if (!data.roster.every(row => row && (typeof row.id === 'string' || Number.isInteger(row.id)) && typeof row.name === 'string' && typeof row.program === 'string' && typeof row.currentRank === 'string')) throw new Error('Daftar dosen belum dapat dibaca. Coba lagi.');
    if (!data.applications.every(row => row && typeof row.id === 'string' && Number.isInteger(row.number) && row.number > 0 && typeof row.name === 'string' && typeof row.program === 'string' && typeof row.proposedRank === 'string' && ['queued', 'processing', 'completed', 'cancelled'].includes(row.status) && (row.position == null || Number.isInteger(row.position) && row.position > 0))) throw new Error('Data antrean belum dapat dibaca. Coba lagi.');
  }
  function renderQueue() {
    const term = normal($('queueSearch').value);
    const status = $('queueStatusFilter').value;
    const rows = applications.filter(row => (!status || row.status === status) && (!term || normal(row.name + ' ' + row.number + ' ' + row.program).includes(term))).sort((a, b) => a.number - b.number);
    $('queueTableBody').replaceChildren();
    for (const row of rows) {
      const tr = make('tr');
      const position = make('td');
      position.append(make('strong', row.position == null ? '—' : String(row.position), 'queue-position'));
      const person = make('td', null, 'queue-person');
      person.append(make('strong', row.name), make('small', row.program), make('small', 'Nomor ajuan #' + row.number));
      const rank = make('td', row.proposedRank);
      const state = make('td');
      state.append(make('span', labels[row.status], 'queue-status ' + row.status));
      tr.append(position, person, rank, state);
      $('queueTableBody').append(tr);
    }
    $('queueEmpty').hidden = rows.length !== 0;
    $('queueEmpty').textContent = applications.length ? 'Tidak ada ajuan yang sesuai pencarian ini.' : 'Belum ada ajuan yang disetujui admin. Anda dapat mengirim ajuan melalui form di halaman ini.';
    $('queueResultCount').textContent = rows.length + ' ajuan ditampilkan' + (applications.length !== rows.length ? ' dari ' + applications.length : '');
  }
  function renderRoster() {
    const selected = $('queueLecturer').value;
    const term = normal($('queueNameSearch').value);
    const rows = roster.filter(row => !term || normal(row.name).includes(term)).sort((a, b) => a.name.localeCompare(b.name, 'id'));
    $('queueLecturer').replaceChildren(make('option', rows.length ? 'Pilih nama dosen…' : 'Nama tidak ditemukan'));
    $('queueLecturer').firstElementChild.value = '';
    for (const row of rows) {
      const option = make('option', row.name + (row.program ? ' · ' + row.program : ''));
      option.value = String(row.id);
      $('queueLecturer').append(option);
    }
    if (rows.some(row => String(row.id) === selected)) $('queueLecturer').value = selected;
    renderSelection();
  }
  function renderSelection() {
    const row = roster.find(item => String(item.id) === $('queueLecturer').value);
    $('queueSelectedLecturer').hidden = !row;
    $('queueSelectedName').textContent = row ? row.name : '';
    $('queueSelectedProgram').textContent = row ? row.program : '';
    $('queueSelectedRank').textContent = row ? 'Jabatan saat ini: ' + row.currentRank : '';
    const previous = $('queueProposedRank').value;
    const offered = row ? ranks.filter((_, index) => index > ranks.indexOf(row.currentRank)) : ranks;
    const placeholder = make('option', row && !offered.length ? 'Sudah pada jabatan Guru Besar' : 'Pilih usulan jabatan…');
    placeholder.value = '';
    $('queueProposedRank').replaceChildren(placeholder, ...offered.map(value => { const option = make('option', value); option.value = value; return option; }));
    if (offered.includes(previous)) $('queueProposedRank').value = previous;
  }
  async function loadQueue() {
    if (loading || submitting) return;
    loading = true;
    $('refreshQueue').disabled = true;
    $('refreshQueue').textContent = 'Memuat…';
    message('');
    try {
      const data = await request(endpoint);
      validateData(data);
      applications = data.applications;
      roster = data.roster;
      formToken = data.formToken;
      ready = true;
      renderQueue();
      renderRoster();
      $('queueApplicationFields').disabled = false;
    } catch (error) {
      message(error.message + (ready ? ' Antrean yang terlihat adalah hasil pemuatan sebelumnya.' : ''), true);
      if (!ready) $('queueResultCount').textContent = 'Antrean belum berhasil dimuat.';
    } finally {
      loading = false;
      $('refreshQueue').disabled = false;
      $('refreshQueue').textContent = 'Muat ulang';
    }
  }
  $('queueApplicationForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (!ready || submitting || loading) return;
    const lecturerId = $('queueLecturer').value;
    const proposedRank = $('queueProposedRank').value;
    if (!roster.some(row => String(row.id) === lecturerId) || !ranks.includes(proposedRank)) {
      message('Pilih nama dosen dan jabatan akademik yang diajukan.', true);
      return;
    }
    submitting = true;
    $('queueApplicationFields').disabled = true;
    $('submitApplication').textContent = 'Mengirim ajuan…';
    message('');
    try {
      const result = await request(endpoint, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({lecturerId, proposedRank, formToken, website: $('queueWebsite').value})});
      if (!result || !uuid.test(result.reference || '') || !(result.pending === true || result.status === 'pending')) throw new Error('Hasil pengiriman belum dapat dipastikan. Coba periksa kembali sebelum mengirim ulang.');
      $('queueReceiptMessage').textContent = 'Menunggu validasi admin. Nomor antrean diberikan setelah ajuan disetujui.';
      $('queueReceiptCode').textContent = result.reference;
      $('queueReference').value = result.reference;
      $('queueSubmissionReceipt').hidden = false;
      $('queueSubmissionReceipt').focus();
      $('queueNameSearch').value = '';
      $('queueProposedRank').value = '';
      renderRoster();
      $('queueLecturer').value = '';
      renderSelection();
    } catch (error) {
      message(error.message, true);
      if (error.status === 403) {
        formToken = '';
        ready = false;
        message('Form perlu dimuat ulang. Klik Muat ulang; isian Anda tetap tersedia.', true);
      }
    } finally {
      submitting = false;
      $('queueApplicationFields').disabled = !ready;
      $('submitApplication').textContent = 'Kirim untuk validasi';
    }
  });
  $('queueTrackForm').addEventListener('submit', async event => {
    event.preventDefault();
    if (tracking) return;
    const reference = $('queueReference').value.trim();
    if (!uuid.test(reference)) { $('queueTrackResult').textContent = 'Periksa kembali kode ajuan yang Anda simpan.'; return; }
    tracking = true;
    $('trackApplication').disabled = true;
    $('trackApplication').textContent = 'Memeriksa…';
    $('queueTrackResult').textContent = '';
    try {
      const result = await request(endpoint + '?reference=' + encodeURIComponent(reference));
      if (!result || !Object.prototype.hasOwnProperty.call(labels, result.status)) throw new Error('Status ajuan belum dapat dibaca. Silakan coba lagi.');
      let text = labels[result.status] + '.';
      if (Number.isInteger(result.number) && result.number > 0) text += ' Nomor ajuan #' + result.number + '.';
      if (Number.isInteger(result.position) && result.position > 0) text += ' Posisi antrean saat ini: ' + result.position + '.';
      if (result.status === 'pending') text += ' Nomor antrean belum diberikan.';
      if (result.status === 'rejected') text += ' Hubungi admin SDM untuk memeriksa atau memperbaiki ajuan.';
      $('queueTrackResult').textContent = text;
    } catch (error) { $('queueTrackResult').textContent = error.status === 404 ? 'Kode ajuan tidak ditemukan. Periksa kode yang Anda simpan.' : error.message; }
    finally {
      tracking = false;
      $('trackApplication').disabled = false;
      $('trackApplication').textContent = 'Periksa status ajuan';
    }
  });
  $('refreshQueue').addEventListener('click', loadQueue);
  $('queueSearch').addEventListener('input', () => { if (ready) renderQueue(); });
  $('queueStatusFilter').addEventListener('change', () => { if (ready) renderQueue(); });
  $('queueNameSearch').addEventListener('input', renderRoster);
  $('queueLecturer').addEventListener('change', renderSelection);
  loadQueue();
})();
