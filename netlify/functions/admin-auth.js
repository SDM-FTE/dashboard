'use strict';

const crypto = require('node:crypto');

const ORIGIN = 'https://sdm-fte.netlify.app';
const OWNER_ID = 335875372;
const OWNER_LOGIN = 'SDM-FTE';
const REPOSITORY_ID = 1396958677;
const REPOSITORY = 'SDM-FTE/dashboard';
const API_ROOT = 'https://api.github.com/repos/' + REPOSITORY;
const PROGRESS_PATH = 'assets/data/jad-progress.json';
const STAGES = ['Pengecekan ajuan', 'Pengesahan', 'Penugasan asesor', 'Penilaian', 'Verifikasi SK', 'Selesai'];
const REQUIREMENTS = { paperPdf: 'Paper terbit (PDF)', similarity: 'Hasil similarity', correspondence: 'Korespondensi syarat utama' };
const SESSION_SECONDS = 15 * 60;
const STATE_SECONDS = 10 * 60;
const SESSION_COOKIE = '__Host-sdm-admin';
const STATE_COOKIE = '__Host-sdm-oauth';
const COOKIE_OPTIONS = '; Path=/; HttpOnly; Secure; SameSite=Lax';

const SECURITY_HEADERS = {
  'Cache-Control': 'private, no-store, max-age=0',
  'Pragma': 'no-cache',
  // Native same-origin logout forms must send Origin; no-referrer makes it null.
  'Referrer-Policy': 'same-origin',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self' https://api.github.com; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
};

const MESSAGES = {
  cancelled: 'Login dibatalkan. Silakan masuk kembali saat ingin memperbarui data.',
  denied: 'Akun ini tidak memiliki akses admin. Gunakan akun GitHub SDM-FTE.',
  state: 'Permintaan login telah berakhir atau tidak valid. Silakan masuk kembali.',
  unavailable: 'Login admin belum diaktifkan. Pengelola perlu menyelesaikan pengaturan akun GitHub di Netlify.',
  github: 'GitHub belum dapat memverifikasi akun Anda. Silakan coba kembali.',
  expired: 'Sesi admin telah berakhir. Silakan masuk kembali.',
  logout: 'Anda telah keluar dari pengelolaan dashboard.'
};

function escaped(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function equal(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string') return false;
  const a = Buffer.from(left, 'utf8');
  const b = Buffer.from(right, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function header(event, name) {
  const headers = event.headers || {};
  const entry = Object.keys(headers).find((key) => key.toLowerCase() === name.toLowerCase());
  return entry ? String(headers[entry]) : '';
}

function readCookie(event, name) {
  const entries = header(event, 'cookie').split(';').map((item) => item.trim());
  const values = entries.filter((item) => item.startsWith(name + '=')).map((item) => item.slice(name.length + 1));
  return values.length === 1 ? values[0] : '';
}

function cookie(name, value, seconds) {
  return name + '=' + value + '; Max-Age=' + seconds + COOKIE_OPTIONS;
}

function clearCookie(name) {
  return cookie(name, '', 0);
}

function response(statusCode, body, type, extraHeaders, cookies) {
  const result = {
    statusCode,
    headers: { ...SECURITY_HEADERS, 'Content-Type': type || 'text/html; charset=utf-8', ...(extraHeaders || {}) },
    body: body || ''
  };
  if (cookies && cookies.length) result.multiValueHeaders = { 'Set-Cookie': cookies };
  return result;
}

function redirect(location, cookies) {
  return response(303, '', undefined, { Location: location }, cookies);
}

function route(event) {
  const path = String(event.path || '').replace(/\/+$/, '') || '/';
  const params = event.queryStringParameters || {};
  if (path === '/admin' || path === '/admin/index' || path === '/admin/index.html') return { action: 'page', page: 'login' };
  if (path === '/admin/bkd' || path === '/admin/bkd.html') return { action: 'page', page: 'bkd' };
  if (path === '/admin/jad' || path === '/admin/jad.html') return { action: 'page', page: 'jad' };
  if (path === '/admin/antrian' || path === '/admin/antrian.html') return { action: 'page', page: 'queue' };
  if (path === '/admin/manage' || path === '/admin/manage.html') return { action: 'page', page: 'admin' };
  if (path.startsWith('/api/admin/')) return { action: path.slice('/api/admin/'.length), page: '' };
  if (path === '/.netlify/functions/admin-auth') {
    const page = String(params.page || '').replace(/\/+$/, '');
    return { action: String(params.action || ''), page: ({ '': 'login', index: 'login', 'index.html': 'login', manage: 'admin', 'manage.html': 'admin', bkd: 'bkd', 'bkd.html': 'bkd', jad: 'jad', 'jad.html': 'jad', antrian: 'queue', 'antrian.html': 'queue', login: 'login', admin: 'admin' })[page] || 'unknown' };
  }
  return { action: 'unknown', page: 'unknown' };
}

function createHandler(options) {
  const dependencies = options || {};
  const now = dependencies.now || (() => Math.floor(Date.now() / 1000));
  const random = dependencies.randomBytes || crypto.randomBytes;
  const fetcher = dependencies.fetch || globalThis.fetch;

  function configuration() {
    const env = dependencies.env || process.env;
    const clientId = String(env.GITHUB_OAUTH_CLIENT_ID || '').trim();
    const clientSecret = String(env.GITHUB_OAUTH_CLIENT_SECRET || '').trim();
    const sessionSecret = String(env.ADMIN_SESSION_SECRET || '');
    if (!/^[A-Za-z0-9_.-]{10,100}$/.test(clientId) || clientSecret.length < 20 || sessionSecret.length < 32) return null;
    return { clientId, clientSecret, key: crypto.createHash('sha256').update(sessionSecret, 'utf8').digest() };
  }

  function seal(payload, kind, config) {
    const iv = random(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', config.key, iv);
    cipher.setAAD(Buffer.from('sdm-fte-admin:v1:' + kind + ':' + ORIGIN));
    const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
    return ['v1', iv.toString('base64url'), ciphertext.toString('base64url'), cipher.getAuthTag().toString('base64url')].join('.');
  }

  function unseal(value, kind, config, maximumLifetime) {
    if (!value || value.length > 3500 || !/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value)) return null;
    try {
      const parts = value.split('.');
      const iv = Buffer.from(parts[1], 'base64url');
      const tag = Buffer.from(parts[3], 'base64url');
      if (iv.length !== 12 || tag.length !== 16) return null;
      const decipher = crypto.createDecipheriv('aes-256-gcm', config.key, iv);
      decipher.setAAD(Buffer.from('sdm-fte-admin:v1:' + kind + ':' + ORIGIN));
      decipher.setAuthTag(tag);
      const payload = JSON.parse(Buffer.concat([decipher.update(Buffer.from(parts[2], 'base64url')), decipher.final()]).toString('utf8'));
      const time = now();
      if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp) || payload.exp <= time || payload.iat > time + 30 || payload.exp <= payload.iat || payload.exp - payload.iat > maximumLifetime) return null;
      return payload;
    } catch (_) {
      return null;
    }
  }

  function session(event, config) {
    if (!config) return null;
    const payload = unseal(readCookie(event, SESSION_COOKIE), 'session', config, SESSION_SECONDS);
    if (!payload || payload.id !== OWNER_ID || String(payload.login).toLowerCase() !== OWNER_LOGIN.toLowerCase() || !/^[A-Za-z0-9_-]{43}$/.test(payload.csrf || '') || !/^ghu_[A-Za-z0-9_]{10,2044}$/.test(payload.token || '')) return null;
    return payload;
  }

  function html(name, payload, message) {
    const pages = dependencies.pages || require('../lib/admin-pages.js');
    const source = pages[name];
    if (typeof source !== 'string') throw new Error('Missing admin template');
    return source.replace(/__ADMIN_LOGIN__/g, escaped(payload ? OWNER_LOGIN : ''))
      .replace(/__CSRF_TOKEN__/g, escaped(payload ? payload.csrf : ''))
      .replace(/__STATUS_MESSAGE__/g, escaped(message || ''));
  }

  async function githubJson(url, request, emptyResponse) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const result = await fetcher(url, { ...request, signal: controller.signal, redirect: 'error' });
      if (emptyResponse) {
        if (result.status === 204 || result.status === 404) return null;
        const failure = new Error('GitHub revocation unavailable'); failure.status = result.status; throw failure;
      }
      if (!result.ok) { const failure = new Error('GitHub unavailable'); failure.status = result.status; throw failure; }
      const value = await result.json();
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid GitHub response');
      return value;
    } finally {
      clearTimeout(timer);
    }
  }

  function githubHeaders(token) {
    return { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'SDM-FTE-dashboard-admin', 'Cache-Control': 'no-cache' };
  }

  async function verifyAdmin(token) {
    const user = await githubJson('https://api.github.com/user', { method: 'GET', headers: githubHeaders(token) });
    if (user.id !== OWNER_ID || String(user.login).toLowerCase() !== OWNER_LOGIN.toLowerCase()) return false;
    const repo = await githubJson(API_ROOT, { method: 'GET', headers: githubHeaders(token) });
    if (repo.id !== REPOSITORY_ID || repo.full_name !== REPOSITORY || !repo.owner || repo.owner.id !== OWNER_ID || repo.archived === true || repo.disabled === true) return false;
    const permission = await githubJson(API_ROOT + '/collaborators/' + OWNER_LOGIN + '/permission', { method: 'GET', headers: githubHeaders(token) });
    return permission.permission === 'admin' && permission.user && permission.user.id === OWNER_ID;
  }

  function jsonError(status, error, message, extra) {
    return response(status, JSON.stringify({ error, message, ...(extra || {}) }), 'application/json; charset=utf-8');
  }

  function canonical(value) {
    if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
    if (value && typeof value === 'object') return '{' + Object.keys(value).sort().map((key) => JSON.stringify(key) + ':' + canonical(value[key])).join(',') + '}';
    return JSON.stringify(value);
  }

  function version(record) {
    return crypto.createHash('sha256').update(canonical(record)).digest('hex');
  }

  function lecturer(id, record) {
    return { id, name: record.name, stage: record.stage, requirements: Object.fromEntries(Object.keys(REQUIREMENTS).map((key) => [key, record.requirements[key]])), baseVersion: version(record) };
  }

  function validStatus(value) {
    return value === null || value === true || value === false;
  }

  function validProgress(data) {
    if (!data || typeof data !== 'object' || !data.lecturers || Array.isArray(data.lecturers) || typeof data.lecturers !== 'object' || !Array.isArray(data.stages) || data.stages.length !== STAGES.length || data.stages.some((value, index) => value !== STAGES[index])) return false;
    const records = Object.entries(data.lecturers);
    if (!records.length || records.length > 5000) return false;
    return records.every(([id, record]) => /^[1-9][0-9]{0,6}$/.test(id) && record && typeof record === 'object' && !Array.isArray(record) && typeof record.name === 'string' && record.name.trim().length > 0 && record.name.length <= 200 && (record.stage === null || Number.isInteger(record.stage) && record.stage >= 0 && record.stage < STAGES.length) && record.requirements && typeof record.requirements === 'object' && !Array.isArray(record.requirements) && Object.keys(REQUIREMENTS).every((key) => validStatus(record.requirements[key])));
  }

  async function readProgress(token) {
    const file = await githubJson(API_ROOT + '/contents/' + PROGRESS_PATH + '?ref=main', { method: 'GET', headers: githubHeaders(token) });
    if (file.encoding !== 'base64' || !/^[0-9a-f]{40}$/.test(file.sha || '') || typeof file.content !== 'string' || file.content.length > 1400000) throw new Error('Invalid progress file');
    const decoded = Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8');
    const data = JSON.parse(decoded);
    if (!validProgress(data)) throw new Error('Invalid progress schema');
    return { data, sha: file.sha };
  }

  function validUpdate(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== 'baseVersion,id,requirements,stage') return false;
    if (typeof body.id !== 'string' || !/^[1-9][0-9]{0,6}$/.test(body.id) || !/^[0-9a-f]{64}$/.test(body.baseVersion || '') || !(body.stage === null || Number.isInteger(body.stage) && body.stage >= 0 && body.stage < STAGES.length)) return false;
    const checks = body.requirements;
    return checks && typeof checks === 'object' && !Array.isArray(checks) && Object.keys(checks).sort().join(',') === Object.keys(REQUIREMENTS).sort().join(',') && Object.keys(REQUIREMENTS).every((key) => validStatus(checks[key]));
  }

  async function progressRequest(event, authenticated, method) {
    if (method === 'GET') {
      const current = await readProgress(authenticated.token);
      return response(200, JSON.stringify({ lecturers: Object.keys(current.data.lecturers).sort((a, b) => Number(a) - Number(b)).map((id) => lecturer(id, current.data.lecturers[id])), stages: STAGES, requirements: REQUIREMENTS, csrfToken: authenticated.csrf }), 'application/json; charset=utf-8');
    }
    if (!equal(header(event, 'origin'), ORIGIN) || !equal(header(event, 'x-csrf-token'), authenticated.csrf)) return jsonError(403, 'csrf', 'Permintaan penyimpanan tidak valid. Muat ulang halaman admin.');
    if (!header(event, 'content-type').toLowerCase().startsWith('application/json')) return jsonError(415, 'format', 'Gunakan format pembaruan yang disediakan halaman admin.');
    const raw = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : String(event.body || '');
    if (raw.length > 8192) return jsonError(413, 'size', 'Pembaruan terlalu besar.');
    let update;
    try { update = JSON.parse(raw); } catch (_) { return jsonError(422, 'invalid', 'Data pembaruan tidak valid.'); }
    if (!validUpdate(update)) return jsonError(422, 'invalid', 'ID dosen, tahap, atau status dokumen tidak valid.');

    for (let attempt = 0; attempt < 2; attempt++) {
      const current = await readProgress(authenticated.token);
      const record = current.data.lecturers[update.id];
      if (!record) return jsonError(422, 'unknown', 'Dosen tidak ditemukan pada data JAD terbaru.');
      if (!equal(version(record), update.baseVersion)) return jsonError(409, 'conflict', 'Data dosen ini sudah berubah. Periksa versi terbaru sebelum menyimpan.', { lecturer: lecturer(update.id, record) });
      const next = { ...record, stage: update.stage, requirements: { ...record.requirements, ...update.requirements } };
      if (canonical(next) === canonical(record)) return response(200, JSON.stringify({ saved: false, unchanged: true, lecturer: lecturer(update.id, record) }), 'application/json; charset=utf-8');
      const candidate = { ...current.data, lecturers: { ...current.data.lecturers, [update.id]: next }, updatedAt: new Date(now() * 1000).toISOString() };
      try {
        const saved = await githubJson(API_ROOT + '/contents/' + PROGRESS_PATH, {
          method: 'PUT',
          headers: { ...githubHeaders(authenticated.token), 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: 'Update JAD progress: ' + record.name, content: Buffer.from(JSON.stringify(candidate, null, 2) + '\n', 'utf8').toString('base64'), sha: current.sha, branch: 'main' })
        });
        if (!saved.commit || !/^[0-9a-f]{40}$/.test(saved.commit.sha || '')) throw new Error('Invalid commit response');
        return response(200, JSON.stringify({ saved: true, lecturer: lecturer(update.id, next), commit: saved.commit.sha, publicUrl: ORIGIN + '/#jad-progress/' + update.id }), 'application/json; charset=utf-8');
      } catch (failure) {
        if (failure.status !== 409) throw failure;
        if (attempt === 1) return jsonError(409, 'conflict', 'Ada pembaruan lain yang sedang disimpan. Muat ulang data dan periksa draf sebelum mencoba kembali.');
      }
    }
  }

  async function handler(event) {
    const selected = route(event);
    const params = event.queryStringParameters || {};
    const method = String(event.httpMethod || 'GET').toUpperCase();
    const config = configuration();
    let authenticated = session(event, config);
    const host = header(event, 'host').split(':')[0].toLowerCase();
    if (host && host !== 'sdm-fte.netlify.app') return response(403, 'Akses admin hanya tersedia pada alamat dashboard utama.');
    if (authenticated && !['login', 'callback', 'logout'].includes(selected.action)) {
      try {
        if (!await verifyAdmin(authenticated.token)) authenticated = null;
      } catch (failure) {
        if (failure.status === 401 || failure.status === 403 || failure.status === 404) authenticated = null;
        else return selected.action === 'page' ? response(503, html('login', null, MESSAGES.github)) : jsonError(502, 'github', MESSAGES.github);
      }
    }

    if (selected.action === 'page') {
      if (!['GET', 'HEAD'].includes(method)) return response(405, '', undefined, { Allow: 'GET, HEAD' });
      if (!['login', 'admin', 'bkd', 'jad', 'queue'].includes(selected.page)) return response(404, 'Halaman tidak ditemukan.');
      if (selected.page !== 'login' && !authenticated) return redirect('/admin/?error=' + (config ? 'expired' : 'unavailable'), [clearCookie(SESSION_COOKIE)]);
      const page = selected.page === 'login' && authenticated ? 'admin' : selected.page;
      const reason = !config ? 'unavailable' : String(params.error || '');
      const output = html(page, authenticated, MESSAGES[reason] || '');
      return response(200, method === 'HEAD' ? '' : output);
    }

    if (selected.action === 'session') {
      if (method !== 'GET') return response(405, '', undefined, { Allow: 'GET' });
      const value = authenticated ? { authenticated: true, login: OWNER_LOGIN, csrfToken: authenticated.csrf, expiresAt: new Date(authenticated.exp * 1000).toISOString() } : { authenticated: false, configured: Boolean(config) };
      return response(authenticated ? 200 : 401, JSON.stringify(value), 'application/json; charset=utf-8');
    }

    if (selected.action === 'progress') {
      if (!['GET', 'POST'].includes(method)) return jsonError(405, 'method', 'Metode pembaruan tidak didukung.');
      if (!config) return jsonError(503, 'unavailable', MESSAGES.unavailable);
      if (!authenticated) return jsonError(401, 'unauthenticated', MESSAGES.expired);
      try { return await progressRequest(event, authenticated, method); }
      catch (_) { return jsonError(502, 'github', 'Perubahan belum dapat disimpan di GitHub. Draf Anda tetap tersedia; coba kembali setelah koneksi pulih.'); }
    }

    if (selected.action === 'queue') {
      if (!['GET', 'POST'].includes(method)) return jsonError(405, 'method', 'Metode pengelolaan antrean tidak didukung.');
      if (!config) return jsonError(503, 'unavailable', MESSAGES.unavailable);
      if (!authenticated) return jsonError(401, 'unauthenticated', MESSAGES.expired);
      const queue = dependencies.queue || require('../lib/jad-queue.js').createQueueService({ env: dependencies.env, fetch: fetcher, now, storeFactory: dependencies.storeFactory });
      return queue.adminRequest(event, authenticated);
    }

    if (selected.action === 'logout') {
      if (method !== 'POST') return response(405, '', undefined, { Allow: 'POST' });
      if (!equal(header(event, 'origin'), ORIGIN) || !header(event, 'content-type').toLowerCase().startsWith('application/x-www-form-urlencoded')) return response(403, 'Permintaan keluar tidak valid.');
      const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : String(event.body || '');
      if (!authenticated || body.length > 8192 || !equal(new URLSearchParams(body).get('csrf'), authenticated.csrf)) return response(403, 'Permintaan keluar tidak valid.');
      try {
        await githubJson('https://api.github.com/applications/' + encodeURIComponent(config.clientId) + '/token', {
          method: 'DELETE',
          headers: { Accept: 'application/vnd.github+json', Authorization: 'Basic ' + Buffer.from(config.clientId + ':' + config.clientSecret, 'utf8').toString('base64'), 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2026-03-10', 'User-Agent': 'SDM-FTE-dashboard-admin' },
          body: JSON.stringify({ access_token: authenticated.token })
        }, true);
      } catch (_) {
        return response(503, html('login', null, 'Anda telah keluar di browser ini. GitHub belum dapat mengonfirmasi penutupan sesi.'), undefined, {}, [clearCookie(SESSION_COOKIE), clearCookie(STATE_COOKIE)]);
      }
      return redirect('/admin/?error=logout', [clearCookie(SESSION_COOKIE), clearCookie(STATE_COOKIE)]);
    }

    if (selected.action === 'login') {
      if (method !== 'GET') return response(405, '', undefined, { Allow: 'GET' });
      if (!config) return response(503, html('login', null, MESSAGES.unavailable), undefined, { 'Retry-After': '300' });
      const time = now();
      const state = random(32).toString('base64url');
      const verifier = random(32).toString('base64url');
      const next = ['bkd', 'jad', 'antrian'].includes(params.next) ? params.next : 'admin';
      const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
      const authorization = new URL('https://github.com/login/oauth/authorize');
      authorization.search = new URLSearchParams({ client_id: config.clientId, redirect_uri: ORIGIN + '/api/admin/callback', scope: '', state, code_challenge: challenge, code_challenge_method: 'S256', allow_signup: 'false', prompt: 'select_account' }).toString();
      const value = seal({ iat: time, exp: time + STATE_SECONDS, state, verifier, next }, 'oauth', config);
      return redirect(authorization.href, [cookie(STATE_COOKIE, value, STATE_SECONDS)]);
    }

    if (selected.action === 'callback') {
      if (method !== 'GET') return response(405, '', undefined, { Allow: 'GET' });
      const discarded = [clearCookie(STATE_COOKIE), clearCookie(SESSION_COOKIE)];
      if (!config) return redirect('/admin/?error=unavailable', discarded);
      if (params.error) return redirect('/admin/?error=cancelled', discarded);
      const flow = unseal(readCookie(event, STATE_COOKIE), 'oauth', config, STATE_SECONDS);
      if (!flow || !equal(params.state, flow.state) || typeof params.code !== 'string' || !/^[A-Za-z0-9_-]{1,512}$/.test(params.code) || !/^[A-Za-z0-9_-]{43}$/.test(flow.verifier || '')) return redirect('/admin/?error=state', discarded);
      try {
        const token = await githubJson('https://github.com/login/oauth/access_token', {
          method: 'POST',
          headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, code: params.code, redirect_uri: ORIGIN + '/api/admin/callback', code_verifier: flow.verifier, repository_id: String(REPOSITORY_ID) }).toString()
        });
        if (token.error || token.token_type !== 'bearer' || !/^ghu_[A-Za-z0-9_]{10,2044}$/.test(token.access_token || '') || typeof token.scope !== 'string' || token.scope.trim() !== '') throw new Error('Unexpected OAuth token');
        if (!await verifyAdmin(token.access_token)) return redirect('/admin/?error=denied', discarded);
        const time = now();
        const value = seal({ iat: time, exp: time + SESSION_SECONDS, id: OWNER_ID, login: OWNER_LOGIN, token: token.access_token, csrf: random(32).toString('base64url') }, 'session', config);
        return redirect(['bkd', 'jad', 'antrian'].includes(flow.next) ? '/admin/' + flow.next : '/admin/', [clearCookie(STATE_COOKIE), cookie(SESSION_COOKIE, value, SESSION_SECONDS)]);
      } catch (_) {
        return redirect('/admin/?error=github', discarded);
      }
    }

    return response(404, 'Halaman tidak ditemukan.');
  }

  return async function safelyHandled(event) {
    try {
      return await handler(event || {});
    } catch (_) {
      return response(503, 'Pengelolaan sedang tidak tersedia. Dashboard umum tetap dapat dibuka.', undefined, { 'Retry-After': '300' });
    }
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
