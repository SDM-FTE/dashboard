(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./bkd-import.js'));
  else root.BkdPeriods = factory(root.BkdImport);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (importer) {
  'use strict';
  const LEGACY_ID = '2025-2026-genap';
  const CATALOG = [
    ['2025/2026', 'Genap'], ['2025/2026', 'Ganjil'],
    ['2024/2025', 'Genap'], ['2024/2025', 'Ganjil'], ['2023/2024', 'Genap'],
  ];
  const FIELDS = ['no', 'status', 'name', 'program', 'position', 'activity', 'totalPerformance', 'excessLoad', 'semesterBkd', 'obligation', 'conclusion', 'certification'];
  const STATUSES = ['Dosen (DS)', 'Dosen dengan tugas tambahan (DT)', 'Profesor (PR)', 'Profesor dengan tugas tambahan (PT)'];
  const CERTIFICATES = ['Sudah tersertifikasi', 'Belum tersertifikasi', 'Belum terdata'];
  const clone = value => JSON.parse(JSON.stringify(value));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  const tidy = value => String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
  class BkdPeriodError extends Error {
    constructor(code, message) { super(message); this.name = 'BkdPeriodError'; this.code = code; }
  }
  const fail = (code, message) => { throw new BkdPeriodError(code, message); };
  const text = (value, maximum, nullable) => (nullable && value === null) || typeof value === 'string' && value.length <= maximum && (!nullable ? value.trim().length > 0 : true);
  const number = value => value === null || typeof value === 'number' && Number.isFinite(value) && value >= 0;

  function descriptor(academicYear, semester) {
    if (typeof academicYear !== 'string' || !/^\d{4}\/\d{4}$/.test(academicYear)) fail('PERIOD_YEAR', 'Tahun akademik harus seperti 2025/2026.');
    const [first, last] = academicYear.split('/').map(Number);
    if (first < 2000 || first > 2199 || last !== first + 1) fail('PERIOD_YEAR', 'Tahun akademik harus berurutan, misalnya 2025/2026.');
    if (!['Ganjil', 'Genap'].includes(semester)) fail('PERIOD_SEMESTER', 'Pilih semester Ganjil atau Genap.');
    return {id: academicYear.replace('/', '-') + '-' + semester.toLowerCase(), academicYear, semester, label: academicYear + ' ' + semester};
  }
  const order = period => Number(period.academicYear.slice(0, 4)) * 2 + (period.semester === 'Genap' ? 1 : 0);
  const descending = (a, b) => order(b) - order(a);

  function validRecords(records, programs) {
    if (!Array.isArray(records) || records.length > 10000) fail('PERIOD_RECORDS', 'Data dosen pada periode BKD tidak valid.');
    const ids = new Set(), identities = new Set();
    for (const row of records) {
      if (!row || typeof row !== 'object' || Array.isArray(row) || Object.keys(row).sort().join(',') !== FIELDS.slice().sort().join(',')) fail('PERIOD_RECORDS', 'Data periode memuat kolom yang tidak sesuai rekap BKD.');
      const identity = tidy(row.name).toLocaleLowerCase('id-ID') + '\0' + row.program;
      if (!Number.isSafeInteger(row.no) || row.no < 1 || ids.has(row.no) || identities.has(identity) || !text(row.name, 250, false) || !programs.includes(row.program)) fail('PERIOD_IDENTITY', 'Identitas dosen pada periode BKD berulang atau tidak dikenali.');
      if (!STATUSES.includes(row.status) || !text(row.position, 250, true) || !Array.isArray(row.activity) || row.activity.length !== 8 || !row.activity.every(number) || !number(row.totalPerformance) || !number(row.excessLoad) || !['M', 'TM'].includes(row.semesterBkd) || !['M', 'TM'].includes(row.conclusion) || !text(row.obligation, 500, true) || !CERTIFICATES.includes(row.certification)) fail('PERIOD_RECORDS', 'Status atau angka dosen pada periode BKD tidak valid.');
      ids.add(row.no); identities.add(identity);
    }
  }

  function validateBaseline(data) {
    if (!data || typeof data !== 'object' || Array.isArray(data) || !data.meta || !Array.isArray(data.bkd) || !Array.isArray(data.focusPrograms) || data.focusPrograms.length !== 8 || new Set(data.focusPrograms).size !== 8) fail('BASELINE_INVALID', 'Data dashboard terbaru belum lengkap. Muat ulang sebelum memperbarui periode.');
    if (Object.prototype.hasOwnProperty.call(data, 'fte') || Object.keys(data.meta).some(key => /^fte/i.test(key))) fail('BASELINE_PRIVACY', 'Data dashboard lama masih memuat FTE. Gunakan versi dashboard yang sudah dibersihkan.');
    validRecords(data.bkd, data.focusPrograms);
  }

  function list(data) {
    validateBaseline(data);
    const periods = [];
    if (data.bkdPeriods === undefined) {
      for (const [year, semester] of CATALOG) {
        const item = descriptor(year, semester), populated = item.id === LEGACY_ID;
        periods.push({...item, records: populated ? clone(data.bkd) : [],
          source: populated ? String(data.meta.bkdSource || 'Data BKD sebelumnya') : '',
          sourceRows: populated ? (Number.isSafeInteger(data.meta.bkdSourceRows) ? data.meta.bkdSourceRows : data.bkd.length) : 0,
          updatedAt: populated && data.meta.bkdUpdatedAt ? data.meta.bkdUpdatedAt : null});
      }
    } else {
      if (!Array.isArray(data.bkdPeriods) || !data.bkdPeriods.length || data.bkdPeriods.length > 120) fail('PERIODS_INVALID', 'Daftar periode BKD tidak valid.');
      const ids = new Set();
      for (const raw of data.bkdPeriods) {
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) fail('PERIODS_INVALID', 'Daftar periode BKD tidak valid.');
        const item = descriptor(raw.academicYear, raw.semester);
        if (raw.id !== item.id || raw.label !== item.label || ids.has(item.id)) fail('PERIOD_DUPLICATE', 'Identitas periode BKD berulang atau tidak sesuai.');
        if (!text(raw.source, 250, true) || !Number.isSafeInteger(raw.sourceRows) || raw.sourceRows < 0 || !(raw.updatedAt === null || typeof raw.updatedAt === 'string' && raw.updatedAt.length <= 50 && Number.isFinite(Date.parse(raw.updatedAt)))) fail('PERIOD_METADATA', 'Informasi sumber periode BKD tidak valid.');
        validRecords(raw.records, data.focusPrograms);
        periods.push({...item, records: clone(raw.records), source: raw.source || '', sourceRows: raw.sourceRows, updatedAt: raw.updatedAt});
        ids.add(item.id);
      }
      for (const [year, semester] of CATALOG) {
        const item = descriptor(year, semester);
        if (!ids.has(item.id)) periods.push({...item, records: [], source: '', sourceRows: 0, updatedAt: null});
      }
    }
    return periods.sort(descending);
  }

  function activeId(data) { return list(data).find(period => period.records.length)?.id || LEGACY_ID; }
  function records(data, id) { return list(data).find(period => period.id === (id || activeId(data)))?.records || []; }

  function initialize(data) {
    const periods = list(data), current = periods.find(period => period.records.length);
    if (!current) fail('PERIOD_EMPTY', 'Belum ada periode yang memiliki data BKD.');
    if (data.bkdPeriods !== undefined && (!same(data.bkd, current.records) || data.meta.bkdActivePeriodId && data.meta.bkdActivePeriodId !== current.id)) fail('PERIOD_ALIAS', 'Data periode dan rekap BKD terbaru tidak sesuai. Periksa versi dashboard sebelum menyimpan.');
    const result = clone(data);
    result.bkdPeriods = periods;
    result.meta.bkdActivePeriodId = current.id;
    // Preserve every legacy row and legacy metadata value during migration.
    return result;
  }

  function scope(data) {
    const normalized = initialize(data);
    return {bkd: normalized.bkd, bkdPeriods: normalized.bkdPeriods, focusPrograms: normalized.focusPrograms,
      meta: Object.fromEntries(Object.entries(normalized.meta).filter(([key]) => /^bkd/i.test(key)))};
  }

  function prepare(table, baseline, options) {
    options = options || {};
    if (!importer || typeof importer.prepare !== 'function') fail('IMPORT_UNAVAILABLE', 'Pembaca file BKD belum tersedia. Muat ulang halaman.');
    const current = initialize(baseline), periods = current.bkdPeriods, active = periods.find(period => period.id === activeId(current));
    if (!['create', 'replace'].includes(options.mode)) fail('PERIOD_MODE', 'Pilih tambah periode atau unggah periode yang tersedia.');
    let item, previous;
    if (options.mode === 'create') {
      item = descriptor(options.academicYear, options.semester);
      if (options.periodId && options.periodId !== item.id) fail('PERIOD_ID', 'Identitas periode baru tidak sesuai.');
      if (periods.some(period => period.id === item.id)) fail('PERIOD_EXISTS', 'Periode ini sudah tersedia. Pilih Unggah data periode untuk mengisinya.');
      item = {...item, records: [], source: '', sourceRows: 0, updatedAt: null};
    } else {
      previous = periods.find(period => period.id === options.periodId);
      if (!previous) fail('PERIOD_UNKNOWN', 'Periode tidak ditemukan. Muat ulang daftar periode.');
      if (options.academicYear && options.academicYear !== previous.academicYear || options.semester && options.semester !== previous.semester) fail('PERIOD_ID', 'Label periode tidak sesuai pilihan.');
      item = previous;
    }
    const firstHistorical = !item.records.length && order(item) < order(active);
    const reference = item.records.length ? item.records : active.records.map(row => firstHistorical ? {...row, certification: 'Belum terdata'} : row);
    const target = {...clone(current), bkd: clone(reference)};
    const sourceName = tidy(options.sourceName || 'Unggahan admin BKD').split(/[\\/]/).pop();
    if (!sourceName || sourceName.length > 250) fail('PERIOD_SOURCE', 'Nama file sumber terlalu panjang atau tidak valid.');
    const imported = importer.prepare(table, target, {sourceName, now: options.now, allowMissingPrograms: order(item) < order(active)});
    const newRows = imported.candidate.bkd;
    validRecords(newRows, current.focusPrograms);
    const changed = !previous || !same(previous.records, newRows);
    const warnings = imported.report.warnings.slice();
    if (firstHistorical) warnings.push('Sertifikasi periode lampau mengikuti file periode tersebut. Status sertifikasi sekarang tidak disalin ke masa lampau.');
    const report = {...imported.report, changed, periodId: item.id, periodLabel: item.label, firstHistoricalUpload: firstHistorical,
      needsRemovalConfirmation: Boolean(previous?.records.length && imported.report.removedLecturers.length), warnings};
    if (!item.records.length) {
      report.countsBefore = {total: 0, M: 0, TM: 0, certified: 0, uncertified: 0, unknown: 0};
      report.modifiedLecturers = [];
      report.removedLecturers = [];
      report.addedLecturers = newRows.map(row => ({no: row.no, name: row.name, program: row.program, conclusion: row.conclusion, certification: row.certification}));
      report.byProgram = report.byProgram.map(row => ({...row, before: {...report.countsBefore}}));
    }
    if (!changed) return {candidate: current, report, period: clone(previous)};
    const date = options.now == null ? new Date() : new Date(options.now);
    if (!Number.isFinite(date.getTime())) fail('PERIOD_DATE', 'Waktu pembaruan tidak valid.');
    const next = {...item, records: clone(newRows), source: sourceName, sourceRows: imported.report.sourceRows, updatedAt: date.toISOString()};
    const candidate = clone(current);
    candidate.bkdPeriods = periods.filter(period => period.id !== item.id).concat(next).sort(descending);
    const latest = candidate.bkdPeriods.find(period => period.records.length);
    candidate.bkd = clone(latest.records);
    candidate.meta.bkdActivePeriodId = latest.id;
    // An upload to an old semester must not alter the current semester's summary.
    if (latest.id === next.id) Object.assign(candidate.meta, {
      bkdSource: latest.source, bkdRows: latest.records.length, bkdSourceRows: latest.sourceRows,
      bkdPrograms: candidate.focusPrograms.length, bkdProgramNames: candidate.focusPrograms.slice(), bkdUpdatedAt: latest.updatedAt,
    });
    return {candidate, report, period: clone(next)};
  }

  return Object.freeze({list, activeId, records, initialize, scope, prepare, descriptor, BkdPeriodError});
});
