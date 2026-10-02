(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  const fmt = value => new Intl.NumberFormat('id-ID').format(value);
  const contentUrl = 'https://api.github.com/repos/SDM-FTE/dashboard/contents/assets/data/dashboard-data.json?ref=main';
  let baseline = null, sourceRows = null, sourceName = '', sheets = [], draft = null, generation = 0, busy = false;
  function message(text, error = false) { $('pageMessage').textContent = text; $('pageMessage').className = 'message' + (error ? ' error' : ''); $('pageMessage').hidden = !text; }
  function controls() {
    $('downloadResult').disabled = busy || !draft?.report.changed || (draft.report.needsRemovalConfirmation && !$('confirmRemoval').checked);
    $('reloadBaseline').disabled = busy; $('bkdFile').disabled = busy; $('sheetSelect').disabled = busy;
  }
  function clearDraft() {
    draft = null; $('previewContent').hidden = true; $('emptyPreview').hidden = false; $('draftBadge').textContent = 'Belum ada draf'; $('draftBadge').className = 'badge'; $('confirmRemoval').checked = false; $('removalField').hidden = true; controls();
  }
  async function readLatest() {
    const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const response = await fetch(contentUrl + '&_=' + Date.now(), {cache:'no-store', credentials:'omit', headers:{Accept:'application/vnd.github+json'}, signal:controller.signal});
      if (!response.ok) throw new Error(response.status === 403 || response.status === 429 ? 'GitHub sedang membatasi akses baca. Tunggu sebentar, lalu pilih Muat ulang.' : 'Data GitHub belum dapat dibaca. Periksa koneksi, lalu pilih Muat ulang.');
      const file = await response.json();
      if (file.encoding !== 'base64' || typeof file.content !== 'string' || !file.sha) throw new Error('Format data GitHub tidak dikenali. Coba muat ulang.');
      const bytes = Uint8Array.from(atob(file.content.replace(/\s/g, '')), ch => ch.charCodeAt(0));
      const data = JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(bytes));
      if (!data || !Array.isArray(data.jad) || !Array.isArray(data.fte) || !Array.isArray(data.bkd) || !data.meta || !Array.isArray(data.focusPrograms) || data.focusPrograms.length !== 8) throw new Error('Data dashboard belum lengkap. Pembaruan dibatalkan agar data lain tidak tertimpa.');
      return {data, sha:file.sha};
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('Pembacaan GitHub terlalu lama. Periksa koneksi, lalu pilih Muat ulang.');
      if (error instanceof TypeError) throw new Error('GitHub belum dapat dijangkau. Periksa koneksi internet, lalu pilih Muat ulang.');
      throw error;
    } finally { clearTimeout(timer); }
  }
  function lists(title, rows, extra) {
    if (!rows.length) return '';
    return '<h3>' + esc(title) + ' (' + fmt(rows.length) + ')</h3><ul>' + rows.map(row => '<li>' + esc(row.name) + ' · ' + esc(row.program) + (extra ? ' — ' + esc(extra(row)) : '') + '</li>').join('') + '</ul>';
  }
  const fieldLabels = {status:'status dosen',position:'jabatan fungsional',activity:'kinerja kegiatan',totalPerformance:'total kinerja',excessLoad:'beban lebih',semesterBkd:'BKD semester',obligation:'kewajiban',conclusion:'kesimpulan',certification:'sertifikasi'};
  function render(result) {
    draft = result; const r = result.report, after = r.countsAfter;
    $('emptyPreview').hidden = true; $('previewContent').hidden = false;
    $('draftBadge').textContent = r.changed ? 'Draf siap diperiksa' : 'Data sudah sama'; $('draftBadge').className = 'badge ready';
    $('previewTotal').textContent = fmt(after.total); $('previewMet').textContent = fmt(after.M); $('previewUnmet').textContent = fmt(after.TM);
    $('comparisonSummary').textContent = r.changed ? fmt(r.modifiedLecturers.length) + ' dosen berubah · ' + fmt(r.addedLecturers.length) + ' dosen ditambahkan · ' + fmt(r.removedLecturers.length) + ' dosen tidak ada di file terbaru.' : 'Data file sama dengan dashboard terbaru. Tidak perlu menerbitkan ulang.';
    $('programRows').innerHTML = r.byProgram.map(row => '<tr><td>' + esc(row.program) + '</td><td>' + fmt(row.before.total) + '</td><td><strong>' + fmt(row.total) + '</strong></td><td>' + fmt(row.M) + '</td><td>' + fmt(row.TM) + '</td></tr>').join('');
    $('certificationSummary').textContent = 'Sertifikasi: ' + fmt(after.certified) + ' sudah · ' + fmt(after.uncertified) + ' belum' + (after.unknown ? ' · ' + fmt(after.unknown) + ' belum terdata' : '') + (r.certificationPreserved.length ? '. ' + fmt(r.certificationPreserved.length) + ' koreksi sertifikasi dashboard tetap dipertahankan.' : '.');
    $('sourceSummary').textContent = fmt(r.selectedRows) + ' dosen dari ' + fmt(r.sourceRows) + ' baris sumber digunakan. ' + fmt(r.ignoredRows) + ' baris di luar 8 prodi dilewati.';
    $('changeLists').innerHTML = lists('Dosen yang berubah', r.modifiedLecturers, row => row.fields.map(field => fieldLabels[field] || field).join(', ')) + lists('Dosen baru', r.addedLecturers) + lists('Dosen yang tidak ada di file terbaru', r.removedLecturers) + lists('Koreksi sertifikasi dipertahankan', r.certificationPreserved, row => row.certification) + (r.warnings.length ? '<p>' + r.warnings.map(esc).join('<br>') + '</p>' : '');
    $('changeDetails').hidden = !$('changeLists').innerHTML;
    $('removalField').hidden = !r.needsRemovalConfirmation; $('confirmRemoval').checked = false;
    $('removalText').textContent = 'Saya sudah memeriksa ' + fmt(r.removedLecturers.length) + ' dosen yang tidak ada di file ini dan menyetujui pengeluarannya dari rekap BKD.';
    controls();
  }
  function prepare() {
    if (!baseline || !sourceRows) return;
    try { render(BkdImport.prepare(sourceRows, baseline.data, {sourceName})); message(draft.report.changed ? 'File valid. Periksa rekap, lalu unduh hasil untuk diterbitkan.' : 'Data BKD sudah sama dengan dashboard. Tidak perlu unggah ulang.'); }
    catch (error) { clearDraft(); message(error.message || 'File belum dapat dibaca.', true); }
  }
  async function reload() {
    if (busy) return; busy = true; controls(); message(''); $('baselineStatus').textContent = 'Memuat data dashboard terbaru…';
    try { baseline = await readLatest(); $('baselineStatus').textContent = 'Data GitHub terbaru siap · ' + fmt(baseline.data.bkd.length) + ' dosen BKD.'; if (sourceRows) prepare(); }
    catch (error) { baseline = null; clearDraft(); $('baselineStatus').textContent = 'Data dashboard belum berhasil dimuat.'; message(error.message, true); }
    finally { busy = false; controls(); }
  }
  async function chooseFile() {
    const token = ++generation; const file = $('bkdFile').files[0]; sourceRows = null; sourceName = ''; sheets = []; $('sheetField').hidden = true; clearDraft(); message('');
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
        $('sheetSelect').innerHTML = sheets.map((sheet,index) => '<option value="' + index + '">' + esc(sheet.name) + '</option>').join(''); $('sheetSelect').value = String(selected); $('sheetField').hidden = sheets.length < 2;
        sourceRows = sheets[selected].rows;
      } else throw new Error('Gunakan CSV atau Excel .xlsx hasil ekspor SISTER.');
      if (token !== generation) return; sourceName = file.name;
      if (baseline) prepare(); else message('File sudah dipilih. Muat data dashboard terbaru sebelum memeriksa hasil.');
    } catch (error) { if (token !== generation) return; sourceRows = null; clearDraft(); message(error.message || 'File belum dapat dibaca.', true); }
  }
  async function download() {
    if (busy || !draft?.report.changed || (draft.report.needsRemovalConfirmation && !$('confirmRemoval').checked)) return;
    busy = true; controls(); message('Memeriksa data GitHub terbaru sebelum mengunduh…');
    try {
      const latest = await readLatest();
      if (JSON.stringify(latest.data.bkd) !== JSON.stringify(baseline.data.bkd)) {
        baseline = latest; prepare();
        if (draft?.report.changed) message('Data BKD di GitHub berubah sejak file dipilih. Rekap sudah diperbarui; periksa hasil, lalu pilih Unduh hasil BKD lagi.');
        return;
      }
      const result = BkdImport.prepare(sourceRows, latest.data, {sourceName});
      if (!result.report.changed) { baseline = latest; render(result); message('Data BKD sudah sama dengan dashboard. Tidak perlu unggah ulang.'); return; }
      if (result.report.needsRemovalConfirmation && !$('confirmRemoval').checked) throw new Error('Periksa daftar dosen yang tidak ada dalam file sebelum mengunduh.');
      const blob = new Blob([JSON.stringify(result.candidate, null, 2) + '\n'], {type:'application/json;charset=utf-8'}); const url = URL.createObjectURL(blob), link = document.createElement('a');
      link.href = url; link.download = 'dashboard-data.json'; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      baseline = latest; draft = result;
      message('Hasil diunduh. Unggah ke GitHub dengan nama dashboard-data.json, lalu pilih Commit changes. Data publik berubah setelah penerbitan selesai.');
    } catch (error) { message(error.message || 'Hasil belum dapat diunduh. Coba lagi.', true); }
    finally { busy = false; controls(); }
  }
  $('bkdFile').addEventListener('change', chooseFile); $('sheetSelect').addEventListener('change', () => { sourceRows = sheets[Number($('sheetSelect').value)]?.rows || null; clearDraft(); message(''); prepare(); });
  $('reloadBaseline').addEventListener('click', reload); $('confirmRemoval').addEventListener('change', controls); $('downloadResult').addEventListener('click', download);
  reload();
})();
