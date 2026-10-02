(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BkdImport = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  class BkdImportError extends Error {
    constructor(code, message, details) {
      super(message);
      this.name = 'BkdImportError';
      this.code = code;
      this.details = details || {};
    }
  }
  const fail = (code, message, details) => { throw new BkdImportError(code, message, details); };
  const tidy = value => String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  const identity = value => tidy(value).toLocaleLowerCase('id-ID');
  const headerKey = value => identity(value).replace(/σ/g, 'sigma').replace(/[\s._-]/g, '');
  const clone = value => JSON.parse(JSON.stringify(value));
  const recordKey = row => identity(row.name) + '\u0000' + identity(row.program);
  const CERTIFIED = 'Sudah tersertifikasi';
  const UNCERTIFIED = 'Belum tersertifikasi';
  const UNKNOWN = 'Belum terdata';
  const CERT_LABELS = new Set([CERTIFIED, UNCERTIFIED, UNKNOWN]);
  const LECTURER_STATUSES = new Map([
    ['Dosen (DS)', 'Dosen (DS)'],
    ['Dosen dengan tugas tambahan (DT)', 'Dosen dengan tugas tambahan (DT)'],
    ['Profesor (PR)', 'Profesor (PR)'],
    ['Profesor dengan tugas tambahan (PT)', 'Profesor dengan tugas tambahan (PT)'],
  ].map(([key, value]) => [identity(key), value]));
  const COLUMNS = [
    { key: 'sourceNo', label: 'NO.', aliases: ['NO.', 'NO', 'NOMOR'] },
    { key: 'status', label: 'STATUS', aliases: ['STATUS', 'STATUS DOSEN'] },
    { key: 'certificate', label: 'NO. SERTIFIKAT', aliases: ['NO. SERTIFIKAT', 'NOMOR SERTIFIKAT', 'STATUS SERTIFIKASI', 'SERTIFIKASI'] },
    { key: 'name', label: 'NAMA DOSEN', aliases: ['NAMA DOSEN'] },
    { key: 'program', label: 'PRODI', aliases: ['PRODI', 'PROGRAM STUDI'] },
    { key: 'position', label: 'JABATANFUNGSIONAL', aliases: ['JABATANFUNGSIONAL', 'JABATAN FUNGSIONAL', 'JFA'] },
    { key: 'activity0', label: 'A/B', aliases: ['A/B'] },
    { key: 'activity1', label: 'Lebih A/B', aliases: ['Lebih A/B'] },
    { key: 'activity2', label: 'C', aliases: ['C'] },
    { key: 'activity3', label: 'Lebih C', aliases: ['Lebih C'] },
    { key: 'activity4', label: 'D', aliases: ['D'] },
    { key: 'activity5', label: 'Lebih D', aliases: ['Lebih D'] },
    { key: 'activity6', label: 'E', aliases: ['E'] },
    { key: 'activity7', label: 'Lebih E', aliases: ['Lebih E'] },
    { key: 'totalPerformance', label: 'ΣKinerja', aliases: ['ΣKinerja', 'Sigma Kinerja', 'Total Kinerja'] },
    { key: 'excessLoad', label: 'ΣBeban Lebih', aliases: ['ΣBeban Lebih', 'Sigma Beban Lebih', 'Total Beban Lebih'] },
    { key: 'semesterBkd', label: 'BKD SEMESTER', aliases: ['BKD SEMESTER', 'SEMESTER BKD'] },
    { key: 'obligation', label: 'KEWAJIBAN DOSEN', aliases: ['KEWAJIBAN DOSEN'] },
    { key: 'conclusion', label: 'KESIMPULAN', aliases: ['KESIMPULAN'] },
  ];
  const ALIASES = new Map(COLUMNS.flatMap(column => column.aliases.map(alias => [headerKey(alias), column.key])));
  const PUBLIC_FIELDS = ['no', 'status', 'name', 'program', 'position', 'activity', 'totalPerformance', 'excessLoad', 'semesterBkd', 'obligation', 'conclusion', 'certification'];

  function parseDelimited(input, delimiter) {
    const rows = [];
    let row = [], field = '', state = 'start';
    const endField = () => { row.push(field); field = ''; state = 'start'; };
    const endRow = () => { endField(); rows.push(row); row = []; };
    for (let index = 0; index < input.length; index++) {
      const char = input[index];
      if (state === 'quoted') {
        if (char === '"' && input[index + 1] === '"') { field += '"'; index++; }
        else if (char === '"') state = 'closed';
        else field += char;
      } else if (char === delimiter) endField();
      else if (char === '\r' || char === '\n') {
        if (char === '\r' && input[index + 1] === '\n') index++;
        endRow();
      } else if (char === '"') {
        if (state !== 'start') fail('CSV_QUOTE', 'Tanda kutip CSV tidak valid. Simpan ulang sebagai CSV dari Excel.', { row: rows.length + 1 });
        state = 'quoted';
      } else {
        if (state === 'closed') fail('CSV_AFTER_QUOTE', 'Ada karakter setelah penutup tanda kutip CSV.', { row: rows.length + 1 });
        field += char;
        state = 'plain';
      }
    }
    if (state === 'quoted') fail('CSV_UNCLOSED_QUOTE', 'Ada tanda kutip CSV yang belum ditutup.', { row: rows.length + 1 });
    if (field !== '' || row.length || state === 'closed') endRow();
    return rows.filter(values => values.some(value => tidy(value) !== ''));
  }

  function parseCsv(input) {
    if (typeof input !== 'string') fail('CSV_TYPE', 'Isi CSV harus berupa teks.');
    const text = input.replace(/^\uFEFF/, '');
    if (!text.trim()) fail('CSV_EMPTY', 'File CSV kosong.');
    const attempts = [',', ';', '\t'].map(delimiter => {
      try {
        const rows = parseDelimited(text, delimiter);
        return { delimiter, rows, score: new Set((rows[0] || []).map(headerKey).map(key => ALIASES.get(key)).filter(Boolean)).size };
      } catch (error) { return { delimiter, error, score: -1 }; }
    }).sort((left, right) => right.score - left.score);
    const chosen = attempts[0];
    if (chosen.score < 2) {
      const strictError = attempts.find(attempt => attempt.error);
      if (strictError && attempts.every(attempt => attempt.score < 2)) throw strictError.error;
      fail('CSV_DELIMITER', 'Kolom CSV tidak dikenali. Gunakan ekspor SISTER dengan pemisah koma, titik koma, atau tab.');
    }
    for (let index = 1; index < chosen.rows.length; index++) {
      if (chosen.rows[index].length !== chosen.rows[0].length) fail('CSV_WIDTH', 'Jumlah kolom CSV tidak sama pada baris ' + (index + 1) + '.', { row: index + 1, expected: chosen.rows[0].length, actual: chosen.rows[index].length });
    }
    return chosen.rows;
  }

  function columnsFor(rows) {
    const header = rows[0];
    if (!Array.isArray(header)) fail('HEADER_MISSING', 'Baris pertama harus berisi nama kolom ekspor SISTER.');
    const columns = new Map(), seen = new Set();
    header.forEach((value, index) => {
      const normalized = headerKey(value);
      if (!normalized) {
        if (rows.slice(1).some(row => tidy(row[index]) !== '')) fail('HEADER_EMPTY', 'Kolom berisi data tetapi judulnya kosong.', { column: index + 1 });
        return;
      }
      if (seen.has(normalized)) fail('HEADER_DUPLICATE', 'Ada nama kolom yang berulang: ' + tidy(value) + '.', { column: index + 1 });
      seen.add(normalized);
      const key = ALIASES.get(normalized);
      if (key) {
        if (columns.has(key)) fail('HEADER_DUPLICATE', 'Ada dua kolom untuk ' + COLUMNS.find(column => column.key === key).label + '.');
        columns.set(key, index);
      }
    });
    const missing = COLUMNS.filter(column => !columns.has(column.key)).map(column => column.label);
    if (missing.length) fail('HEADER_REQUIRED', 'Kolom wajib belum tersedia: ' + missing.join(', ') + '.', { missingColumns: missing });
    return columns;
  }

  function textCell(value, label, rowNumber, allowEmpty) {
    const text = tidy(value);
    if (!text && !allowEmpty) fail('CELL_EMPTY', label + ' kosong pada baris ' + rowNumber + '.', { row: rowNumber, column: label });
    if (/^[=+@]/.test(text) || /^#(?:REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/i.test(text)) fail('CELL_ERROR', label + ' berisi formula atau kesalahan pada baris ' + rowNumber + '.', { row: rowNumber, column: label });
    return text || null;
  }

  function numberCell(value, label, rowNumber, integer) {
    const text = tidy(value);
    if (!text) {
      if (!integer) return null;
      fail('NUMBER_EMPTY', label + ' kosong pada baris ' + rowNumber + '.', { row: rowNumber, column: label });
    }
    if (typeof value !== 'number' && !/^\d+(?:[.,]\d+)?$/.test(text)) fail('NUMBER_INVALID', label + ' harus berisi angka pada baris ' + rowNumber + '.', { row: rowNumber, column: label });
    const number = typeof value === 'number' ? value : Number(text.replace(',', '.'));
    if (!Number.isFinite(number) || number < 0 || (integer && (!Number.isSafeInteger(number) || number < 1))) fail('NUMBER_INVALID', label + ' tidak valid pada baris ' + rowNumber + '.', { row: rowNumber, column: label });
    return number;
  }

  function checkTotal(activity, total, indexes, label, rowNumber) {
    if (total == null || indexes.some(index => activity[index] == null)) return;
    const sum = indexes.reduce((result, index) => result + activity[index], 0);
    if (Math.abs(total - sum) > 0.001000001) fail('TOTAL_MISMATCH', label + ' tidak sesuai jumlah komponennya pada baris ' + rowNumber + '.', { row: rowNumber, column: label, componentTotal: sum, statedTotal: total });
  }

  function conclusionCell(value, label, rowNumber) {
    const text = tidy(value).toUpperCase();
    if (text !== 'M' && text !== 'TM') fail('CONCLUSION_INVALID', label + ' harus M atau TM pada baris ' + rowNumber + '.', { row: rowNumber, column: label });
    return text;
  }

  function sourceCertification(value) {
    const normalized = identity(value);
    if (!normalized || normalized === identity(UNKNOWN)) return UNKNOWN;
    if ([UNCERTIFIED, 'Belum tersertifikasi dosen', 'Belum', 'Belum sertifikasi'].some(label => identity(label) === normalized)) return UNCERTIFIED;
    if ([CERTIFIED, 'Sudah tersertifikasi dosen', 'Sudah', 'Tersertifikasi'].some(label => identity(label) === normalized)) return CERTIFIED;
    // The certificate number is used only to derive this label, never copied into public data.
    const certificate = normalized.replace(/^no\.?\s*/, '');
    if ((typeof value === 'number' && Number.isFinite(value) && value > 0) || ((/^[\d\s./-]+$/.test(certificate) || /^[a-z0-9][a-z0-9./-]*$/.test(certificate)) && /[1-9]/.test(certificate))) return CERTIFIED;
    return UNKNOWN;
  }

  function counts(records) {
    return {
      total: records.length,
      M: records.filter(row => row.conclusion === 'M').length,
      TM: records.filter(row => row.conclusion === 'TM').length,
      certified: records.filter(row => row.certification === CERTIFIED).length,
      uncertified: records.filter(row => row.certification === UNCERTIFIED).length,
      unknown: records.filter(row => row.certification === UNKNOWN).length,
    };
  }

  function prepare(inputRows, baseline, options) {
    options = options || {};
    if (!baseline || !Array.isArray(baseline.bkd) || !Array.isArray(baseline.focusPrograms) || baseline.focusPrograms.length !== 8) fail('BASELINE_INVALID', 'Data dashboard terbaru harus berisi BKD dan delapan prodi. Muat ulang data GitHub.');
    if (!Array.isArray(inputRows) || !inputRows.length || inputRows.some(row => !Array.isArray(row))) fail('ROWS_INVALID', 'File harus berisi tabel dengan judul kolom pada baris pertama.');
    const rows = inputRows.filter(row => row.some(value => tidy(value) !== ''));
    if (rows.length < 2) fail('ROWS_EMPTY', 'File tidak berisi data dosen.');
    const columns = columnsFor(rows);
    const programs = new Map(baseline.focusPrograms.map(program => [identity(program), program]));
    if (programs.size !== 8 || baseline.focusPrograms.some(program => !tidy(program))) fail('PROGRAM_BASELINE', 'Daftar delapan prodi pada dashboard tidak valid.');
    const previous = new Map(), oldNumbers = new Set();
    let nextId = 1;
    baseline.bkd.forEach(row => {
      if (!row || !tidy(row.name) || !programs.has(identity(row.program)) || !Number.isSafeInteger(row.no) || row.no < 1 || oldNumbers.has(row.no) || previous.has(recordKey(row))) fail('BASELINE_IDENTITY', 'Identitas dosen BKD pada dashboard berulang atau tidak valid. Muat ulang data GitHub.');
      previous.set(recordKey(row), row);
      oldNumbers.add(row.no);
      nextId = Math.max(nextId, row.no + 1);
    });
    const imported = new Map(), sourceNumbers = new Set(), certificationPreserved = [], certificationUnknown = [], sourceNumberDifferences = [];
    let sourceRows = 0, excludedRows = 0;
    rows.slice(1).forEach((values, index) => {
      const rowNumber = index + 2;
      if (values.length > rows[0].length && values.slice(rows[0].length).some(value => tidy(value) !== '')) fail('ROW_WIDTH', 'Ada data di luar judul kolom pada baris ' + rowNumber + '.', { row: rowNumber });
      const get = key => values[columns.get(key)];
      sourceRows++;
      const program = programs.get(identity(get('program')));
      if (!program) { excludedRows++; return; }
      const name = textCell(get('name'), 'NAMA DOSEN', rowNumber, false);
      const key = recordKey({ name, program });
      if (imported.has(key)) fail('LECTURER_DUPLICATE', 'Nama dosen berulang di prodi yang sama: ' + name + '.', { row: rowNumber, name, program });
      const sourceNo = numberCell(get('sourceNo'), 'NO.', rowNumber, true);
      if (sourceNumbers.has(sourceNo)) fail('NUMBER_DUPLICATE', 'Nomor dosen berulang pada baris ' + rowNumber + '.', { row: rowNumber });
      sourceNumbers.add(sourceNo);
      const status = LECTURER_STATUSES.get(identity(get('status')));
      if (!status) fail('STATUS_INVALID', 'STATUS dosen tidak dikenali pada baris ' + rowNumber + '.', { row: rowNumber, name, program });
      const old = previous.get(key);
      const rawCertification = sourceCertification(get('certificate'));
      let certification = rawCertification;
      const oldCertification = old && CERT_LABELS.has(old.certification) ? old.certification : UNKNOWN;
      if (old && ((oldCertification === CERTIFIED && rawCertification !== CERTIFIED) || (rawCertification === UNKNOWN && oldCertification !== UNKNOWN))) {
        certification = oldCertification;
        certificationPreserved.push({ no: old.no, name: old.name, program, certification, sourceCertification: rawCertification });
      }
      if (rawCertification === UNKNOWN) certificationUnknown.push({ no: old ? old.no : null, name: old ? old.name : name, program, retained: !!old && certification !== UNKNOWN });
      const record = {
        no: old ? old.no : null,
        status,
        name: old ? old.name : name,
        program,
        position: textCell(get('position'), 'JABATANFUNGSIONAL', rowNumber, true),
        activity: Array.from({ length: 8 }, (_, activityIndex) => numberCell(get('activity' + activityIndex), COLUMNS.find(column => column.key === 'activity' + activityIndex).label, rowNumber, false)),
        totalPerformance: numberCell(get('totalPerformance'), 'ΣKinerja', rowNumber, false),
        excessLoad: numberCell(get('excessLoad'), 'ΣBeban Lebih', rowNumber, false),
        semesterBkd: conclusionCell(get('semesterBkd'), 'BKD SEMESTER', rowNumber),
        obligation: textCell(get('obligation'), 'KEWAJIBAN DOSEN', rowNumber, false),
        conclusion: conclusionCell(get('conclusion'), 'KESIMPULAN', rowNumber),
        certification,
      };
      checkTotal(record.activity, record.totalPerformance, [0, 2, 4, 6], 'ΣKinerja', rowNumber);
      checkTotal(record.activity, record.excessLoad, [1, 3, 5, 7], 'ΣBeban Lebih', rowNumber);
      if (old && old.no !== sourceNo) sourceNumberDifferences.push({ no: old.no, name: old.name, program, sourceNo });
      imported.set(key, record);
    });
    const missingPrograms = baseline.focusPrograms.filter(program => !Array.from(imported.values()).some(row => row.program === program));
    if (missingPrograms.length) fail('PROGRAM_MISSING', 'File belum memuat seluruh delapan prodi: ' + missingPrograms.join(', ') + '.', { missingPrograms });
    const bkd = baseline.bkd.filter(row => imported.has(recordKey(row))).map(row => imported.get(recordKey(row)));
    const additions = Array.from(imported.entries()).filter(([key]) => !previous.has(key)).map(([, row]) => row).sort((left, right) => recordKey(left).localeCompare(recordKey(right), 'id'));
    additions.forEach(row => {
      if (!Number.isSafeInteger(nextId)) fail('ID_EXHAUSTED', 'Nomor identitas dosen baru tidak dapat dibuat.');
      row.no = nextId++;
      bkd.push(row);
    });
    const modifiedLecturers = bkd.flatMap(row => {
      const old = previous.get(recordKey(row));
      if (!old) return [];
      const fields = PUBLIC_FIELDS.filter(field => JSON.stringify(row[field]) !== JSON.stringify(old[field]));
      return fields.length ? [{ no: row.no, name: row.name, program: row.program, fields, before: { conclusion: old.conclusion, certification: old.certification }, after: { conclusion: row.conclusion, certification: row.certification } }] : [];
    });
    const removedLecturers = baseline.bkd.filter(row => !imported.has(recordKey(row))).map(row => ({ no: row.no, name: row.name, program: row.program }));
    const addedLecturers = additions.map(row => ({ no: row.no, name: row.name, program: row.program, conclusion: row.conclusion, certification: row.certification }));
    const changed = JSON.stringify(bkd) !== JSON.stringify(baseline.bkd);
    const candidate = clone(baseline);
    if (changed) {
      const now = options.now == null ? new Date() : new Date(options.now);
      if (!Number.isFinite(now.getTime())) fail('DATE_INVALID', 'Waktu pembaruan tidak valid.');
      candidate.bkd = bkd;
      candidate.meta = Object.assign({}, candidate.meta, {
        bkdSource: tidy(options.sourceName || 'Unggahan admin BKD').split(/[\\/]/).pop(),
        bkdRows: bkd.length,
        bkdSourceRows: sourceRows,
        bkdPrograms: baseline.focusPrograms.length,
        bkdProgramNames: baseline.focusPrograms.slice(),
        bkdUpdatedAt: now.toISOString(),
      });
    }
    return {
      candidate,
      report: {
        changed,
        sourceRows,
        selectedRows: bkd.length,
        excludedRows,
        ignoredRows: excludedRows,
        countsBefore: counts(baseline.bkd),
        countsAfter: counts(bkd),
        byProgram: baseline.focusPrograms.map(program => Object.assign({ program, before: counts(baseline.bkd.filter(row => row.program === program)) }, counts(bkd.filter(row => row.program === program)))),
        modifiedLecturers,
        addedLecturers,
        removedLecturers,
        certificationPreserved,
        certificationUnknown,
        warnings: [
          ...(certificationPreserved.length ? [certificationPreserved.length + ' status sertifikasi dari dashboard dipertahankan karena file terbaru belum mencatatnya.'] : []),
          ...(certificationUnknown.some(row => !row.retained) ? [certificationUnknown.filter(row => !row.retained).length + ' dosen belum memiliki status sertifikasi yang dapat dikenali.'] : []),
          ...(bkd.some(row => row.activity.some(value => value == null) || row.totalPerformance == null || row.excessLoad == null) ? ['Angka yang kosong tetap ditandai belum terdata, bukan diubah menjadi 0.'] : []),
        ],
        sourceNumberDifferences,
        needsRemovalConfirmation: removedLecturers.length > 0,
      },
    };
  }

  return Object.freeze({ parseCsv, prepare, BkdImportError, publicFields: Object.freeze(PUBLIC_FIELDS.slice()) });
});
