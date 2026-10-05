'use strict';

const crypto = require('node:crypto');
const ORIGIN = 'https://sdm-fte.netlify.app';
const API = 'https://api.github.com/repos/SDM-FTE/dashboard/contents/';
const RAW = 'https://raw.githubusercontent.com/SDM-FTE/dashboard/main/';
const MASTER = 'assets/data/dashboard-data.json';
const LEDGER = 'assets/data/jad-applications.json';
const STORE = 'jad-applications-private-v1';
const PREFIX = 'lecturers/';
const RANKS = ['Asisten Ahli', 'Lektor', 'Lektor Kepala', 'Guru Besar'];
const STATUSES = ['queued', 'processing', 'completed', 'cancelled'];
const PUBLIC_KEYS = ['id', 'number', 'name', 'program', 'currentRank', 'proposedRank', 'status', 'submittedAt', 'approvedAt'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HEADERS = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store, max-age=0', 'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow', 'Referrer-Policy': 'same-origin' };
const LOCATIONS = {
  'PRODI S1 TEKNIK FISIKA (TF)': 'Teknik Fisika (S1)',
  'PRODI S2 ELEKTRO (PASCA TE)': 'Teknik Elektro (S2)',
  'PRODI S3 TEKNIK ELEKTRO (DOCTORAL TE)': 'Teknik Elektro (S3)',
  'PRODI S1 TEKNIK TELEKOMUNIKASI (TT)': 'Teknik Telekomunikasi (S1)',
  'PRODI S1 TEKNIK KOMPUTER (TK)': 'Teknik Komputer (S1)',
  'PRODI S1 TEKNIK ELEKTRO (TE)': 'Teknik Elektro (S1)',
  'PRODI S1 TEKNIK BIOMEDIS (TB)': 'Teknik Biomedis (S1)',
  'PRODI S1 TEKNIK SISTEM ENERGI (TSE)': 'Teknik Sistem Energi (S1)',
};
class QueueError extends Error {
  constructor(status, code, message, extra) { super(message); this.status = status; this.code = code; this.extra = extra || {}; }
}
const error = (status, code, message, extra) => { throw new QueueError(status, code, message, extra); };
const canonical = value => Array.isArray(value) ? '[' + value.map(canonical).join(',') + ']' : value && typeof value === 'object' ? '{' + Object.keys(value).sort().map(key => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}' : JSON.stringify(value);
const version = value => crypto.createHash('sha256').update(canonical(value)).digest('hex');
const tidy = value => String(value == null ? '' : value).normalize('NFKC').trim().replace(/\s+/g, ' ');
const validText = value => typeof value === 'string' && value.trim().length > 0 && value.length <= 200 && !/[\u0000-\u001f\u007f]/.test(value);
const rank = value => ({ AA: RANKS[0], L: RANKS[1], LK: RANKS[2], GB: RANKS[3] })[value] || (RANKS.includes(value) ? value : null);
const active = row => row.status === 'queued' || row.status === 'processing';
const samePerson = (left, right) => tidy(left.name).toLowerCase() === tidy(right.name).toLowerCase() && tidy(left.program).toLowerCase() === tidy(right.program).toLowerCase();
const exactKeys = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).sort().join(',') === keys.slice().sort().join(',');
const header = (event, key) => { const found = Object.keys(event.headers || {}).find(name => name.toLowerCase() === key); return found ? String(event.headers[found]) : ''; };
const equal = (left, right) => { if (typeof left !== 'string' || typeof right !== 'string') return false; const a = Buffer.from(left), b = Buffer.from(right); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const output = (statusCode, value) => ({ statusCode, headers: { ...HEADERS }, body: JSON.stringify(value) });
const publicRecord = row => Object.fromEntries(PUBLIC_KEYS.map(key => [key, row[key]]));
const emptyLedger = () => ({ schemaVersion: 1, nextNumber: 1, applications: [] });

function validateLedger(data) {
  if (!exactKeys(data, ['schemaVersion', 'nextNumber', 'applications']) || data.schemaVersion !== 1 || !Number.isSafeInteger(data.nextNumber) || data.nextNumber < 1 || !Array.isArray(data.applications) || data.applications.length > 5000) error(503, 'ledger', 'Data antrean belum dapat dibaca. Coba kembali setelah pengelola memeriksa data.');
  const ids = new Set(), numbers = new Set(), activePeople = new Set();
  for (const row of data.applications) {
    if (!exactKeys(row, PUBLIC_KEYS) || !UUID.test(row.id) || !Number.isSafeInteger(row.number) || row.number < 1 || row.number >= data.nextNumber || ids.has(row.id) || numbers.has(row.number) || !['name', 'program', 'currentRank'].every(key => validText(row[key])) || ![...RANKS, 'Belum memiliki JFA'].includes(row.currentRank) || !RANKS.includes(row.proposedRank) || RANKS.indexOf(row.proposedRank) <= RANKS.indexOf(row.currentRank) || !STATUSES.includes(row.status) || !Number.isFinite(Date.parse(row.submittedAt)) || !Number.isFinite(Date.parse(row.approvedAt))) error(503, 'ledger', 'Identitas atau nomor antrean pada data tersimpan tidak valid. Pembaruan dibatalkan.');
    const person = tidy(row.name).toLowerCase() + '\u0000' + tidy(row.program).toLowerCase();
    if (active(row) && activePeople.has(person)) error(503, 'ledger', 'Dosen memiliki lebih dari satu ajuan aktif pada antrean tersimpan.');
    if (active(row)) activePeople.add(person);
    ids.add(row.id); numbers.add(row.number);
  }
  return data;
}

function rosterFrom(data) {
  if (!data || !Array.isArray(data.fte) || !Array.isArray(data.focusPrograms) || data.focusPrograms.length !== 8 || data.fte.length > 5000) error(503, 'roster', 'Daftar dosen terbaru belum dapat dibaca. Coba kembali.');
  const seen = new Set();
  const roster = data.fte.map(row => {
    const id = String(row.id), program = LOCATIONS[tidy(row.location).toUpperCase()];
    if (!/^[1-9][0-9]{0,6}$/.test(id) || seen.has(id) || !validText(row.name) || !program || !data.focusPrograms.includes(program)) error(503, 'roster', 'Identitas dosen atau prodi pada data master belum dapat dicocokkan.');
    seen.add(id);
    const currentRank = rank(tidy(row.jfa).toUpperCase()) || (['', 'NJFA'].includes(tidy(row.jfa).toUpperCase()) ? 'Belum memiliki JFA' : null);
    if (!currentRank) error(503, 'roster', 'Jabatan dosen pada data master tidak dikenali.');
    return { id, name: tidy(row.name), program, currentRank };
  });
  if (!roster.length) error(503, 'roster', 'Daftar dosen belum tersedia.');
  return roster;
}

function projectApplications(ledger, admin) {
  const sorted = ledger.applications.slice().sort((a, b) => a.number - b.number);
  let position = 0;
  return sorted.map(row => ({ ...publicRecord(row), position: active(row) ? ++position : null, ...(admin ? { baseVersion: version(row) } : {}) }));
}

function createQueueService(options) {
  const dependencies = options || {};
  const fetcher = dependencies.fetch || globalThis.fetch;
  const now = dependencies.now || (() => Math.floor(Date.now() / 1000));
  const uuid = dependencies.randomUUID || crypto.randomUUID;
  const env = () => dependencies.env || process.env;
  const iso = () => new Date(now() * 1000).toISOString();

  function secret() { const value = String(env().ADMIN_SESSION_SECRET || ''); if (value.length < 32) error(503, 'configuration', 'Form pengajuan belum tersedia. Pengelola perlu memeriksa pengaturan situs.'); return value; }
  function sign(value) { return crypto.createHmac('sha256', secret()).update('sdm-fte-jad-form:v1:' + ORIGIN + ':' + value).digest('base64url'); }
  function formToken() { const time = now(), encoded = Buffer.from(JSON.stringify({ v: 1, iat: time, exp: time + 1800, nonce: uuid() })).toString('base64url'); return encoded + '.' + sign(encoded); }
  function validateToken(value) {
    if (typeof value !== 'string' || value.length > 500 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]{43}$/.test(value)) error(403, 'form', 'Form telah berakhir atau tidak valid. Muat ulang halaman pengajuan.');
    const [encoded, mac] = value.split('.'); if (!equal(mac, sign(encoded))) error(403, 'form', 'Form tidak valid. Muat ulang halaman pengajuan.');
    let decoded; try { decoded = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')); } catch { error(403, 'form', 'Form tidak valid.'); }
    if (!exactKeys(decoded, ['v', 'iat', 'exp', 'nonce']) || decoded.v !== 1 || !UUID.test(decoded.nonce) || !Number.isInteger(decoded.iat) || !Number.isInteger(decoded.exp) || decoded.iat > now() + 30 || decoded.exp <= now() || decoded.exp - decoded.iat !== 1800) error(403, 'form', 'Form telah berakhir. Muat ulang halaman pengajuan.');
    return decoded;
  }
  function hostGate(event) { if (header(event, 'host').split(':')[0].toLowerCase() !== 'sdm-fte.netlify.app' || env().CONTEXT && env().CONTEXT !== 'production') error(403, 'host', 'Pengajuan hanya tersedia pada alamat dashboard utama.'); }
  function jsonBody(event) {
    if (!header(event, 'content-type').toLowerCase().startsWith('application/json')) error(415, 'format', 'Gunakan form pengajuan yang tersedia.');
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : String(event.body || '');
    if (Buffer.byteLength(raw) > 4096) error(413, 'size', 'Data pengajuan terlalu besar.');
    try { return JSON.parse(raw, (key, value) => { if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Invalid key'); return value; }); }
    catch { error(422, 'invalid', 'Data pengajuan tidak valid.'); }
  }
  async function request(url, init) {
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 8000);
    try { return await fetcher(url, { ...init, signal: controller.signal, redirect: 'error' }); }
    finally { clearTimeout(timer); }
  }
  function githubHeaders(token) { return { Accept: 'application/vnd.github+json', ...(token ? { Authorization: 'Bearer ' + token } : {}), 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'SDM-FTE-JAD-Queue', 'Cache-Control': 'no-cache' }; }
  async function readFile(path, token, missingAllowed) {
    if (!token) {
      const response = await request(RAW + path, { method: 'GET', headers: { 'Cache-Control': 'no-cache', Accept: 'application/json' } });
      if (response.status === 404 && missingAllowed) return { data: emptyLedger(), sha: null };
      if (!response.ok) error(502, 'github', 'Data terbaru belum dapat dibaca. Periksa koneksi lalu coba kembali.');
      let data; try { data = await response.json(); } catch { error(503, 'data', 'Format data tersimpan tidak valid.'); }
      return { data, sha: null };
    }
    const response = await request(API + path + '?ref=main', { method: 'GET', headers: githubHeaders(token) });
    if (response.status === 404 && missingAllowed) return { data: emptyLedger(), sha: null };
    if (!response.ok) error(502, 'github', 'Data GitHub terbaru belum dapat dibaca. Coba kembali.');
    const file = await response.json();
    if (!file || file.encoding !== 'base64' || !/^[0-9a-f]{40}$/.test(file.sha || '') || typeof file.content !== 'string' || file.content.length > 1800000) error(503, 'data', 'Format berkas GitHub tidak valid.');
    let data; try { data = JSON.parse(Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8')); } catch { error(503, 'data', 'Format data GitHub tidak valid.'); }
    return { data, sha: file.sha };
  }
  async function readLedger(token) { const result = await readFile(LEDGER, token, true); validateLedger(result.data); return result; }
  async function readRoster(token) { return rosterFrom((await readFile(MASTER, token, false)).data); }
  function selectLecturer(roster, id, proposedRank) {
    if (!/^[1-9][0-9]{0,6}$/.test(String(id)) || !['string', 'number'].includes(typeof id)) error(422, 'lecturer', 'Pilih dosen dari daftar yang tersedia.');
    const lecturer = roster.find(row => row.id === String(id)); if (!lecturer) error(422, 'lecturer', 'Dosen tidak ditemukan dalam data master terbaru. Muat ulang daftar.');
    const target = rank(proposedRank); if (!target || RANKS.indexOf(target) <= RANKS.indexOf(lecturer.currentRank)) error(422, 'rank', 'Usulan JAD harus lebih tinggi dari jabatan dosen saat ini.');
    return { ...lecturer, proposedRank: target };
  }
  function store(event) {
    if (dependencies.storeFactory) return dependencies.storeFactory(event);
    const blobs = require('@netlify/blobs');
    if (!event.modernRuntime) blobs.connectLambda(event);
    return blobs.getStore({ name: STORE, consistency: 'strong' });
  }
  function validPending(row) {
    const keys = ['id', 'lecturerId', 'name', 'program', 'currentRank', 'proposedRank', 'submittedAt', 'status', 'fingerprint'];
    if (row && row.status === 'approved') keys.push('number');
    return exactKeys(row, keys) && UUID.test(row.id) && /^[1-9][0-9]{0,6}$/.test(row.lecturerId) && ['pending', 'approving', 'approved', 'rejected'].includes(row.status) && ['name', 'program', 'currentRank'].every(key => validText(row[key])) && RANKS.includes(row.proposedRank) && Number.isFinite(Date.parse(row.submittedAt)) && /^[0-9a-f]{64}$/.test(row.fingerprint || '') && (row.status !== 'approved' || Number.isSafeInteger(row.number) && row.number > 0);
  }
  async function getPending(storage, key) {
    const entry = await storage.getWithMetadata(key, { type: 'json', consistency: 'strong' });
    if (!entry) return null;
    if (!entry.etag || !validPending(entry.data) || key !== PREFIX + entry.data.lecturerId) error(503, 'storage', 'Data pengajuan tersimpan belum dapat dibaca.');
    return entry;
  }
  async function writePending(storage, key, record, etag) {
    const saved = await storage.setJSON(key, record, etag ? { onlyIfMatch: etag } : { onlyIfNew: true });
    if (!saved.modified) return false;
    // Require a confirmed ETag and a strong read-back: never acknowledge a lost write.
    if (!saved.etag) error(503, 'storage', 'Penyimpanan pengajuan belum dapat dikonfirmasi. Coba kembali dengan form yang sama.');
    const proof = await getPending(storage, key);
    if (!proof || proof.etag !== saved.etag || canonical(proof.data) !== canonical(record)) error(503, 'storage', 'Penyimpanan pengajuan belum dapat dikonfirmasi. Coba kembali.');
    return true;
  }
  async function entries(storage) {
    const listing = await storage.list({ prefix: PREFIX });
    if (!listing || !Array.isArray(listing.blobs) || listing.blobs.length > 5000) error(503, 'storage', 'Daftar pengajuan belum dapat dibaca.');
    const result = [];
    for (const blob of listing.blobs) {
      if (!new RegExp('^' + PREFIX + '[1-9][0-9]{0,6}$').test(blob.key)) error(503, 'storage', 'Identitas pengajuan tersimpan tidak valid.');
      const entry = await getPending(storage, blob.key); if (entry) result.push({ key: blob.key, ...entry });
    }
    return result;
  }
  async function byReference(storage, id) { if (!UUID.test(id || '')) error(422, 'reference', 'Kode pengajuan tidak valid.'); return (await entries(storage)).find(entry => entry.data.id === id) || null; }
  function pendingView(row) { return { id: row.id, name: row.name, program: row.program, currentRank: row.currentRank, proposedRank: row.proposedRank, submittedAt: row.submittedAt, status: row.status }; }

  async function submit(storage, lecturer, ledger, fingerprint, admin) {
    const key = PREFIX + lecturer.id;
    for (let attempt = 0; attempt < 4; attempt++) {
      const previous = await getPending(storage, key), old = previous && previous.data;
      const approved = old && ledger.applications.find(row => row.id === old.id);
      if (approved && active(approved)) error(409, 'duplicate', 'Dosen ini masih memiliki ajuan dalam antrean. Pengajuan baru belum dapat dibuat.');
      if (ledger.applications.some(row => active(row) && samePerson(row, lecturer))) error(409, 'duplicate', 'Dosen ini masih memiliki ajuan dalam antrean.');
      if (old && ['pending', 'approving'].includes(old.status)) {
        if (equal(old.fingerprint || '', fingerprint) || admin && old.proposedRank === lecturer.proposedRank) return { key, record: old, duplicate: true };
        error(409, 'duplicate', 'Dosen ini sudah memiliki ajuan yang menunggu pemeriksaan admin.');
      }
      if (old && old.status === 'approved' && !approved) error(409, 'duplicate', 'Ajuan sebelumnya sedang diterbitkan. Tunggu pembaruan antrean sebelum mengajukan kembali.');
      const record = { id: uuid(), lecturerId: lecturer.id, name: lecturer.name, program: lecturer.program, currentRank: lecturer.currentRank, proposedRank: lecturer.proposedRank, submittedAt: iso(), status: 'pending', fingerprint };
      if (await writePending(storage, key, record, previous && previous.etag)) return { key, record, duplicate: false };
    }
    error(409, 'conflict', 'Ada pengajuan lain yang sedang disimpan untuk dosen ini. Coba muat ulang.');
  }

  async function saveLedger(current, next, token, message) {
    validateLedger(next);
    const response = await request(API + LEDGER, { method: 'PUT', headers: { ...githubHeaders(token), 'Content-Type': 'application/json' }, body: JSON.stringify({ message, content: Buffer.from(JSON.stringify(next, null, 2) + '\n').toString('base64'), branch: 'main', ...(current.sha ? { sha: current.sha } : {}) }) });
    if (response.status === 409 || response.status === 422 && !current.sha) return null;
    if (!response.ok) error(502, 'github', 'GitHub belum dapat menyimpan perubahan. Nomor antrean belum diberikan; ulangi pemeriksaan ajuan yang sama.');
    const saved = await response.json(); if (!saved.commit || !/^[0-9a-f]{40}$/.test(saved.commit.sha || '') || !saved.content || !/^[0-9a-f]{40}$/.test(saved.content.sha || '')) error(502, 'github', 'Hasil penyimpanan belum dapat dikonfirmasi. Periksa kembali ajuan yang sama.');
    return saved.commit.sha;
  }
  async function markApproved(storage, key, id, number) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const entry = await getPending(storage, key); if (!entry || entry.data.id !== id) return false;
      if (entry.data.status === 'approved' && entry.data.number === number) return true;
      if (await writePending(storage, key, { ...entry.data, status: 'approved', number }, entry.etag)) return true;
    }
    return false;
  }
  async function approve(storage, id, token) {
    let entry = await byReference(storage, id);
    if (!entry) error(404, 'unknown', 'Ajuan tidak ditemukan. Muat ulang daftar pengajuan.');
    let current = await readLedger(token), existing = current.data.applications.find(row => row.id === id);
    if (existing) {
      let synchronized = false; try { synchronized = await markApproved(storage, entry.key, id, existing.number); } catch {}
      return { saved: false, unchanged: true, application: projectApplications(current.data, true).find(row => row.id === id), message: synchronized ? 'Ajuan ini sudah disetujui. Nomor antrean tetap sama.' : 'Ajuan sudah tersimpan di antrean. Penanda internal akan dipulihkan saat pemeriksaan berikutnya.' };
    }
    const roster = await readRoster(token), lecturer = selectLecturer(roster, entry.data.lecturerId, entry.data.proposedRank);
    if (!samePerson(entry.data, lecturer)) error(409, 'identity', 'Identitas dosen pada data master berubah. Periksa ajuan dan data master sebelum menyetujui.');
    if (entry.data.status === 'rejected') error(409, 'conflict', 'Ajuan ini telah ditolak. Dosen dapat mengisi pengajuan baru.');
    if (entry.data.status === 'approved') error(503, 'ledger', 'Ajuan yang pernah disetujui tidak ditemukan pada antrean. Pembaruan dibatalkan.');
    if (entry.data.status === 'pending') {
      if (!await writePending(storage, entry.key, { ...entry.data, status: 'approving' }, entry.etag)) error(409, 'conflict', 'Ajuan sudah berubah. Muat ulang sebelum memeriksa kembali.');
      entry = { ...entry, data: { ...entry.data, status: 'approving' } };
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      current = await readLedger(token);
      existing = current.data.applications.find(row => row.id === id);
      if (existing) {
        try { await markApproved(storage, entry.key, id, existing.number); } catch {}
        return { saved: false, unchanged: true, application: projectApplications(current.data, true).find(row => row.id === id), message: 'Ajuan ini sudah tersimpan. Nomor antrean tetap sama.' };
      }
      if (current.data.applications.some(row => active(row) && samePerson(row, lecturer))) error(409, 'duplicate', 'Dosen ini sudah memiliki ajuan aktif dalam antrean.');
      if (!Number.isSafeInteger(current.data.nextNumber + 1)) error(503, 'ledger', 'Nomor antrean baru belum dapat dibuat.');
      const row = { id, number: current.data.nextNumber, name: lecturer.name, program: lecturer.program, currentRank: lecturer.currentRank, proposedRank: lecturer.proposedRank, status: 'queued', submittedAt: entry.data.submittedAt, approvedAt: iso() };
      const next = { schemaVersion: 1, nextNumber: row.number + 1, applications: [...current.data.applications, row] };
      let commit;
      try { commit = await saveLedger(current, next, token, 'Approve JAD application: ' + lecturer.name); }
      catch (failure) {
        // A timed-out request may have committed. Reconcile by immutable UUID, never assign another number.
        try { const proof = await readLedger(token), found = proof.data.applications.find(item => item.id === id); if (found) { try { await markApproved(storage, entry.key, id, found.number); } catch {} return { saved: true, application: projectApplications(proof.data, true).find(item => item.id === id), message: 'Ajuan berhasil tersimpan dan mendapatkan nomor antrean.' }; } } catch {}
        throw failure;
      }
      if (!commit) continue;
      let synchronized = false; try { synchronized = await markApproved(storage, entry.key, id, row.number); } catch {}
      return { saved: true, commit, application: projectApplications(next, true).find(item => item.id === id), message: synchronized ? 'Ajuan disetujui dan nomor antrean tersimpan.' : 'Ajuan dan nomor antrean tersimpan. Penanda internal perlu diselaraskan dengan memilih Periksa kembali ajuan yang sama.' };
    }
    error(409, 'conflict', 'Ada persetujuan lain yang sedang disimpan. Muat ulang lalu periksa ajuan yang sama.');
  }

  async function publicRequest(event) {
    try {
      hostGate(event); const method = String(event.httpMethod || 'GET').toUpperCase();
      if (method === 'GET') {
        const reference = event.queryStringParameters && event.queryStringParameters.reference;
        const ledger = (await readLedger()).data;
        if (reference != null) {
          if (!UUID.test(reference)) error(422, 'reference', 'Kode pengajuan tidak valid.');
          const approved = projectApplications(ledger, false).find(row => row.id === reference);
          if (approved) return output(200, { reference, status: approved.status, number: approved.number, position: approved.position });
          const entry = await byReference(store(event), reference);
          if (!entry) error(404, 'unknown', 'Kode pengajuan tidak ditemukan.');
          return output(200, { reference, status: entry.data.status === 'rejected' ? 'rejected' : entry.data.status === 'approved' ? 'queued' : 'pending', ...(entry.data.status === 'approved' && Number.isSafeInteger(entry.data.number) ? { number: entry.data.number, position: null } : {}) });
        }
        return output(200, { applications: projectApplications(ledger, false), roster: await readRoster(), formToken: formToken() });
      }
      if (method !== 'POST') return output(405, { error: 'method', message: 'Metode pengajuan tidak didukung.' });
      if (!equal(header(event, 'origin'), ORIGIN)) error(403, 'origin', 'Permintaan pengajuan tidak valid. Gunakan halaman pengajuan dashboard.');
      const body = jsonBody(event);
      if (!exactKeys(body, ['lecturerId', 'proposedRank', 'formToken', 'website']) || body.website !== '') error(422, 'invalid', 'Data pengajuan tidak valid.');
      validateToken(body.formToken);
      const roster = await readRoster(), lecturer = selectLecturer(roster, body.lecturerId, body.proposedRank), ledger = (await readLedger()).data;
      const saved = await submit(store(event), lecturer, ledger, version({ token: body.formToken, lecturerId: lecturer.id, proposedRank: lecturer.proposedRank }), false);
      return output(200, { submitted: true, reference: saved.record.id, status: 'pending', pending: true, message: 'Pengajuan diterima untuk diperiksa admin. Nomor antrean diberikan setelah ajuan disetujui.' });
    } catch (failure) { return failureResponse(failure); }
  }

  async function adminRequest(event, authenticated) {
    try {
      hostGate(event); const method = String(event.httpMethod || 'GET').toUpperCase(), storage = store(event);
      if (method === 'GET') {
        const roster = await readRoster(authenticated.token), ledger = (await readLedger(authenticated.token)).data;
        const savedEntries = await entries(storage);
        // Recover the private acknowledgement after a confirmed GitHub commit.
        // Public queue data remains authoritative, even if this repair must retry later.
        for (const entry of savedEntries) {
          const approved = ledger.applications.find(row => row.id === entry.data.id);
          if (approved && entry.data.status !== 'approved') { try { await markApproved(storage, entry.key, entry.data.id, approved.number); } catch {} }
        }
        const pending = savedEntries.filter(entry => ['pending', 'approving'].includes(entry.data.status)).filter(entry => !ledger.applications.some(row => row.id === entry.data.id)).map(entry => pendingView(entry.data)).sort((a, b) => a.submittedAt.localeCompare(b.submittedAt) || a.id.localeCompare(b.id));
        return output(200, { csrfToken: authenticated.csrf, roster, pending, applications: projectApplications(ledger, true) });
      }
      if (method !== 'POST') return output(405, { error: 'method', message: 'Metode pengelolaan antrean tidak didukung.' });
      if (!equal(header(event, 'origin'), ORIGIN) || !equal(header(event, 'x-csrf-token'), authenticated.csrf)) error(403, 'csrf', 'Permintaan penyimpanan tidak valid. Muat ulang halaman admin.');
      const body = jsonBody(event);
      if (!body || !['approve', 'reject', 'add', 'status'].includes(body.action)) error(422, 'invalid', 'Pilihan pengelolaan ajuan tidak valid.');
      if (body.action === 'approve' || body.action === 'reject') {
        if (!exactKeys(body, ['action', 'id']) || !UUID.test(body.id)) error(422, 'invalid', 'Kode pengajuan tidak valid.');
        if (body.action === 'approve') return output(200, await approve(storage, body.id, authenticated.token));
        const entry = await byReference(storage, body.id); if (!entry) error(404, 'unknown', 'Ajuan tidak ditemukan.');
        const ledger = (await readLedger(authenticated.token)).data;
        if (ledger.applications.some(row => row.id === body.id) || ['approving', 'approved'].includes(entry.data.status)) error(409, 'approval_in_progress', 'Ajuan sedang atau sudah disetujui. Periksa kembali persetujuannya; gunakan status antrean untuk ajuan yang telah diterbitkan.');
        if (entry.data.status !== 'rejected' && !await writePending(storage, entry.key, { ...entry.data, status: 'rejected' }, entry.etag)) error(409, 'conflict', 'Ajuan sudah berubah. Muat ulang daftar.');
        return output(200, { saved: true, rejected: true, id: body.id, message: 'Ajuan ditolak. Nomor antrean tidak dibuat.' });
      }
      if (body.action === 'add') {
        if (!exactKeys(body, ['action', 'lecturerId', 'proposedRank'])) error(422, 'invalid', 'Data pengajuan admin tidak valid.');
        const roster = await readRoster(authenticated.token), lecturer = selectLecturer(roster, body.lecturerId, body.proposedRank), ledger = (await readLedger(authenticated.token)).data;
        const saved = await submit(storage, lecturer, ledger, version({ admin: authenticated.id, nonce: uuid() }), true);
        return output(200, await approve(storage, saved.record.id, authenticated.token));
      }
      if (!exactKeys(body, ['action', 'id', 'status', 'baseVersion']) || !UUID.test(body.id) || !STATUSES.includes(body.status) || !/^[0-9a-f]{64}$/.test(body.baseVersion || '')) error(422, 'invalid', 'Status atau versi ajuan tidak valid.');
      for (let attempt = 0; attempt < 5; attempt++) {
        const current = await readLedger(authenticated.token), old = current.data.applications.find(row => row.id === body.id);
        if (!old) error(404, 'unknown', 'Ajuan tidak ditemukan pada antrean terbaru.');
        if (!equal(version(old), body.baseVersion)) error(409, 'conflict', 'Ajuan sudah berubah. Periksa status terbaru sebelum menyimpan.', { application: projectApplications(current.data, true).find(row => row.id === body.id) });
        if (old.status === body.status) return output(200, { saved: false, unchanged: true, application: projectApplications(current.data, true).find(row => row.id === body.id), message: 'Status ajuan sudah sama.' });
        if (!active(old)) error(422, 'closed', 'Ajuan yang selesai atau dibatalkan tetap menjadi arsip. Buat ajuan baru jika diperlukan.');
        const next = { ...current.data, applications: current.data.applications.map(row => row.id === body.id ? { ...row, status: body.status } : row) };
        const commit = await saveLedger(current, next, authenticated.token, 'Update JAD queue status: ' + old.name);
        if (commit) return output(200, { saved: true, commit, application: projectApplications(next, true).find(row => row.id === body.id), message: 'Status antrean berhasil disimpan.' });
      }
      error(409, 'conflict', 'Ada pembaruan antrean lain. Muat ulang sebelum menyimpan kembali.');
    } catch (failure) { return failureResponse(failure); }
  }
  function failureResponse(failure) { return failure instanceof QueueError ? output(failure.status, { error: failure.code, message: failure.message, ...failure.extra }) : output(503, { error: 'unavailable', message: 'Pengajuan belum dapat diproses. Data sebelumnya tetap tersimpan; coba kembali.' }); }
  return { publicRequest, adminRequest };
}

exports.createQueueService = createQueueService;
exports.rosterFrom = rosterFrom;
exports.validateLedger = validateLedger;
exports.projectApplications = projectApplications;
exports.constants = { ORIGIN, LEDGER, MASTER, RANKS, PUBLIC_KEYS };
