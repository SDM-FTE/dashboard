(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = value => new Intl.NumberFormat('id-ID').format(value);
  const apiUrl = '/api/admin/bkd';
  const initialMode = new URLSearchParams(window.location.search).get('mode');
  let baseline = null, sourceRows = null, sourceName = '', sheets = [], draft = null, generation = 0, busy = false;
  function message(text, error = false) { $('pageMessage').textContent = text; $('pageMessage').className = 'message' + (error ? ' error' : ''); $('pageMessage').hidden = !text; }
  function isNew() { return $('bkdMode').value === 'create'; }
  function periodOptions() {
    if (isNew()) return {mode:'create', periodId:'', academicYear:$('academicYear').value.trim(), semester:$('semester').value, sourceName};
    const period = baseline && BkdPeriods.list(baseline.data).find(item => item.id === $('periodSelect').value);
    if (!period) throw new Error('Pilih periode BKD yang akan diunggah.');
    return {mode:'replace', periodId:period.id, academicYear:period.academicYear, semester:period.semester, sourceName};
  }
  function controls() {
    const locked = busy || !baseline;
    $('savePeriod').disabled = locked || !draft?.report.changed || (draft.report.needsRemovalConfirmation && !$('confirmRemoval').checked);
    $('reloadBaseline').disabled = busy;
    for (const id of ['bkdFile','sheetSelect','bkdMode','periodSelect','academicYear','semester']) $(id).disabled = locked;
  }
  function clearDraft() {
    draft = null; $('previewContent').hidden = true; $('emptyPreview').hidden = false;
    $('draftBadge').textContent = 'Belum ada draf'; $('draftBadge').className = 'badge'; $('previewPeriod').textContent = '';
    $('savePeriod').textContent = 'Simpan periode BKD'; $('viewPublished').hidden = true;
    $('confirmRemoval').checked = false; $('removalField').hidden = true; controls();
  }
  async function readLatest() {
    if (!window.AdminAccess || !window.BkdPeriods) throw new Error('Halaman pengelolaan belum lengkap. Muat ulang halaman, lalu masuk kembali.');
    const session = await window.AdminAccess.ensure();
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 25000);
    try {
      const response = await fetch(apiUrl, {cache:'no-store', credentials:'same-origin', headers:{Accept:'application/json'}, signal:controller.signal});
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { const failure = new Error(result.message || (response.status === 401 ? 'Sesi admin berakhir. Masuk kembali sebelum menyimpan.' : 'Data BKD belum dapat dimuat. Coba Muat ulang.')); failure.status = response.status; throw failure; }
      if (!result.data || !Array.isArray(result.data.bkd) || !Array.isArray(result.data.focusPrograms) || !result.data.meta || !/^[0-9a-f]{64}$/.test(result.baseVersion || '')) throw new Error('Format data periode belum dikenali. Muat ulang halaman.');
      const csrfToken = result.csrfToken || session.csrfToken;
      if (!/^[A-Za-z0-9_-]{43}$/.test(csrfToken || '')) throw new Error('Verifikasi penyimpanan belum tersedia. Masuk kembali sebagai admin.');
      return {data:result.data, baseVersion:result.baseVersion, csrfToken};
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Pembacaan data terlalu lama. Periksa koneksi, lalu pilih Muat ulang.');
      if (error instanceof TypeError) throw new Error('Layanan BKD belum dapat dijangkau. Periksa koneksi, lalu pilih Muat ulang.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function fillPeriods(preferredId) {
    const periods = BkdPeriods.list(baseline.data), activeId = BkdPeriods.activeId(baseline.data), prior = preferredId || $('periodSelect').value;
    $('periodSelect').innerHTML = periods.map(period => '<option value="' + esc(period.id) + '">' + esc(period.label) + (period.records.length ? ' · ' + fmt(period.records.length) + ' dosen' : ' · Belum diunggah') + '</option>').join('');
    const fallback = $('bkdMode').value === 'history' ? periods.find(period => period.id !== activeId)?.id : activeId;
    $('periodSelect').value = periods.some(period => period.id === prior) ? prior : fallback || periods[0]?.id || '';
    updatePeriodDescription();
  }
  function updatePeriodDescription() {
    const creating = isNew(); $('existingPeriodFields').hidden = creating; $('newPeriodFields').hidden = !creating;
    $('pageTitle').textContent = creating ? 'Tambah periode BKD' : $('bkdMode').value === 'history' ? 'Upload BKD lampau' : 'Perbarui rekap BKD';
    if (creating) $('periodDescription').textContent = 'Isi tahun akademik dan semester, lalu unggah data SISTER untuk periode baru.';
    else if (baseline) {
      const period = BkdPeriods.list(baseline.data).find(item => item.id === $('periodSelect').value);
      $('periodDescription').textContent = period ? period.records.length ? fmt(period.records.length) + ' dosen sudah tersimpan pada periode ' + period.label + '. File baru hanya memperbarui periode ini.' : 'Data periode ' + period.label + ' belum diunggah. Periode lain tetap tersimpan.' : 'Pilih periode yang sesuai dengan file Anda.';
    }
  }
  function lists(title, rows, extra) {
    if (!rows.length) return '';
    return '<h3>' + esc(title) + ' (' + fmt(rows.length) + ')</h3><ul>' + rows.map(row => '<li>' + esc(row.name) + ' · ' + esc(row.program) + (extra ? ' — ' + esc(extra(row)) : '') + '</li>').join('') + '</ul>';
  }
  const fieldLabels = {status:'status dosen',position:'jabatan fungsional',activity:'kinerja kegiatan',totalPerformance:'total kinerja',excessLoad:'beban lebih',semesterBkd:'BKD semester',obligation:'kewajiban',conclusion:'kesimpulan',certification:'sertifikasi'};
  function render(result) {
    draft = result;
    const r = result.report, after = r.countsAfter, label = result.period?.label || periodOptions().academicYear + ' ' + periodOptions().semester;
    $('emptyPreview').hidden = true; $('previewContent').hidden = false;
    $('draftBadge').textContent = r.changed ? 'Siap diperiksa' : 'Data sudah sama'; $('draftBadge').className = 'badge ready'; $('previewPeriod').textContent = 'Periode ' + label;
    $('previewTotal').textContent = fmt(after.total); $('previewMet').textContent = fmt(after.M); $('previewUnmet').textContent = fmt(after.TM);
    $('comparisonSummary').textContent = r.changed ? fmt(r.modifiedLecturers.length) + ' dosen berubah · ' + fmt(r.addedLecturers.length) + ' dosen ditambahkan · ' + fmt(r.removedLecturers.length) + ' dosen tidak ada di file ini.' : 'Data file sama dengan periode yang tersimpan. Tidak perlu menyimpan ulang.';
    $('programRows').innerHTML = r.byProgram.map(row => '<tr><td>' + esc(row.program) + '</td><td>' + fmt(row.before.total) + '</td><td><strong>' + fmt(row.total) + '</strong></td><td>' + fmt(row.M) + '</td><td>' + fmt(row.TM) + '</td></tr>').join('');
    $('certificationSummary').textContent = 'Sertifikasi: ' + fmt(after.certified) + ' sudah · ' + fmt(after.uncertified) + ' belum' + (after.unknown ? ' · ' + fmt(after.unknown) + ' belum terdata' : '') + (r.certificationPreserved.length ? '. ' + fmt(r.certificationPreserved.length) + ' koreksi sertifikasi periode ini dipertahankan.' : '.');
    $('sourceSummary').textContent = fmt(r.selectedRows) + ' dosen dari ' + fmt(r.sourceRows) + ' baris sumber digunakan. ' + fmt(r.ignoredRows) + ' baris di luar 8 prodi dilewati.';
    $('changeLists').innerHTML = lists('Dosen yang berubah', r.modifiedLecturers, row => row.fields.map(field => fieldLabels[field] || field).join(', ')) + lists('Dosen baru', r.addedLecturers) + lists('Dosen yang tidak ada di file ini', r.removedLecturers) + lists('Koreksi sertifikasi dipertahankan', r.certificationPreserved, row => row.certification) + (r.warnings.length ? '<p>' + r.warnings.map(esc).join('<br>') + '</p>' : '');
    $('changeDetails').hidden = !$('changeLists').innerHTML;
    $('removalField').hidden = !r.needsRemovalConfirmation; $('confirmRemoval').checked = false;
    $('removalText').textContent = 'Saya sudah memeriksa ' + fmt(r.removedLecturers.length) + ' dosen yang tidak ada dalam file dan menyetujui pengeluarannya dari periode ini.';
    $('savePeriod').textContent = 'Simpan periode ' + label; controls();
  }
  function prepare() {
    if (!baseline || !sourceRows) return;
    try { render(BkdPeriods.prepare(sourceRows, baseline.data, periodOptions())); message(draft.report.changed ? 'File valid. Pastikan periode dan rekap sudah sesuai, lalu simpan.' : 'Data BKD periode ini sudah sama. Tidak perlu menyimpan ulang.'); }
    catch (error) { clearDraft(); message(error.message || 'File belum dapat dibaca.', true); }
  }
  async function reload() {
    if (busy) return; busy = true; controls(); message(''); $('baselineStatus').textContent = 'Memuat periode dan data BKD terbaru…';
    try { baseline = await readLatest(); fillPeriods(); $('baselineStatus').textContent = fmt(BkdPeriods.list(baseline.data).length) + ' periode BKD tersedia.'; if (sourceRows) prepare(); }
    catch (error) { baseline = null; clearDraft(); $('baselineStatus').textContent = 'Data BKD belum berhasil dimuat.'; message(error.message, true); }
    finally { busy = false; controls(); }
  }
  async function chooseFile() {
    const token = ++generation, file = $('bkdFile').files[0]; sourceRows = null; sourceName = ''; sheets = []; $('sheetField').hidden = true; clearDraft(); message('');
    if (!file) { $('fileInfo').textContent = 'Belum ada file dipilih.'; return; }
    $('fileInfo').textContent = file.name + ' · ' + fmt(Math.ceil(file.size / 1024)) + ' KB';
    try {
      if (file.size > 10 * 1024 * 1024 || file.size === 0) throw new Error('Pilih file yang berisi data, maksimal 10 MB.');
      const bytes = new Uint8Array(await file.arrayBuffer()); if (token !== generation) return;
      if (/\.csv$/i.test(file.name)) {
        let text; try { text = new TextDecoder('utf-8', {fatal:true}).decode(bytes); } catch { throw new Error('CSV belum menggunakan UTF-8. Simpan ulang sebagai CSV UTF-8, lalu pilih file tersebut.'); }
        sourceRows = BkdImport.parseCsv(text);
      } else if (/\.xlsx$/i.test(file.name)) {
        const workbook = await BkdXlsx.read(bytes); if (token !== generation) return;
        sheets = workbook.sheets; if (!sheets.length) throw new Error('Excel tidak memiliki lembar data.');
        const candidates = sheets.map((sheet,index) => ({sheet,index})).filter(({sheet}) => sheet.rows[0]?.some(cell => /^NAMA\s*DOSEN$/i.test(String(cell).trim())) && sheet.rows[0]?.some(cell => /^(PRODI|PROGRAM\s*STUDI)$/i.test(String(cell).trim())));
        const selected = candidates.length === 1 ? candidates[0].index : 0;
        $('sheetSelect').innerHTML = sheets.map((sheet,index) => '<option value="' + index + '">' + esc(sheet.name) + '</option>').join(''); $('sheetSelect').value = String(selected); $('sheetField').hidden = sheets.length < 2; sourceRows = sheets[selected].rows;
      } else throw new Error('Gunakan CSV atau Excel .xlsx hasil ekspor SISTER.');
      if (token !== generation) return; sourceName = file.name;
      if (baseline) prepare(); else message('File sudah dipilih. Muat data BKD terbaru sebelum memeriksa hasil.');
    } catch (error) { if (token !== generation) return; sourceRows = null; clearDraft(); message(error.message || 'File belum dapat dibaca.', true); }
  }
  async function save() {
    if (busy || !draft?.report.changed || (draft.report.needsRemovalConfirmation && !$('confirmRemoval').checked)) return;
    busy = true; controls(); message('Memeriksa data terbaru sebelum menyimpan periode…');
    try {
      const latest = await readLatest();
      if (latest.baseVersion !== baseline.baseVersion) { baseline = latest; fillPeriods(); prepare(); message('Ada pembaruan BKD sejak file dipilih. Periksa rekap terbaru, lalu pilih Simpan lagi.', true); return; }
      const options = periodOptions(), result = BkdPeriods.prepare(sourceRows, latest.data, options);
      if (!result.report.changed) { baseline = latest; render(result); message('Data periode ini sudah sama. Tidak perlu menyimpan ulang.'); return; }
      if (result.report.needsRemovalConfirmation && !$('confirmRemoval').checked) throw new Error('Periksa daftar dosen yang tidak ada dalam file sebelum menyimpan.');
      const body = JSON.stringify({...options, table:sourceRows, baseVersion:latest.baseVersion, confirmRemoval:$('confirmRemoval').checked});
      if (new Blob([body]).size > 3 * 1024 * 1024) throw new Error('Data file terlalu besar untuk disimpan sekaligus. Gunakan ekspor SISTER yang diperlukan untuk BKD.');
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 45000); let response, saved;
      try { response = await fetch(apiUrl, {method:'POST', credentials:'same-origin', cache:'no-store', signal:controller.signal, headers:{Accept:'application/json','Content-Type':'application/json','X-CSRF-Token':latest.csrfToken}, body}); saved = await response.json().catch(() => ({})); }
      finally { clearTimeout(timer); }
      if (!response.ok) {
        if (response.status === 409) { baseline = await readLatest(); fillPeriods(); prepare(); message(saved.message || 'Data periode berubah saat disimpan. Periksa hasil terbaru, lalu simpan kembali.', true); return; }
        throw new Error(saved.message || (response.status === 401 ? 'Sesi admin berakhir. Masuk kembali sebelum menyimpan.' : 'Periode belum berhasil disimpan. Coba Muat ulang.'));
      }
      const savedId = saved.periodId || result.period?.id;
      baseline = await readLatest(); $('bkdMode').value = 'replace'; fillPeriods(savedId); clearDraft(); prepare();
      $('viewPublished').href = '/#bkd?period=' + encodeURIComponent(savedId || $('periodSelect').value); $('viewPublished').hidden = false;
      message(saved.saved === false ? 'Data periode sudah sama dengan yang tersimpan.' : 'Periode BKD tersimpan. Dashboard akan diperbarui otomatis; buka rekap untuk melihat hasilnya.');
    } catch (error) { message(error.name === 'AbortError' ? 'Belum ada konfirmasi penyimpanan. Muat ulang data sebelum mencoba kembali.' : error.message || 'Periode belum berhasil disimpan. Coba Muat ulang.', true); }
    finally { busy = false; controls(); }
  }
  function changeTarget() { updatePeriodDescription(); clearDraft(); message(''); if (sourceRows) prepare(); }
  $('bkdMode').value = initialMode === 'create' ? 'create' : initialMode === 'history' ? 'history' : 'replace';
  $('bkdMode').addEventListener('change', () => { if (baseline) { $('periodSelect').value = ''; fillPeriods(); } changeTarget(); });
  for (const id of ['periodSelect','academicYear','semester']) $(id).addEventListener(id === 'academicYear' ? 'input' : 'change', changeTarget);
  $('bkdFile').addEventListener('change', chooseFile); $('sheetSelect').addEventListener('change', () => { sourceRows = sheets[Number($('sheetSelect').value)]?.rows || null; clearDraft(); message(''); prepare(); });
  $('reloadBaseline').addEventListener('click', reload); $('confirmRemoval').addEventListener('change', controls); $('savePeriod').addEventListener('click', save);
  document.addEventListener('admin-access-restored', () => { if (!busy) reload(); });
  updatePeriodDescription(); reload();
})();
