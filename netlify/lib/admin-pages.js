'use strict';
// Private server templates. The public build must exclude netlify/lib.
const login = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Akses pengelolaan dashboard untuk akun admin yang terverifikasi.">
  <meta name="color-scheme" content="light">
  <title>Masuk Admin · Monitoring Dosen</title>
  <style>
    :root {
      --ink: #142b3b;
      --navy: #0f2b3a;
      --navy-2: #17475a;
      --teal: #0f9e91;
      --teal-soft: #e2f5f1;
      --muted: #6b7c89;
      --line: #e0e9ec;
      --paper: #f5f8f8;
      font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
      color: var(--ink);
      background: var(--paper);
      font-synthesis: none;
      text-rendering: optimizeLegibility;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; }
    a { color: inherit; text-decoration: none; }
    a:focus-visible { outline: 3px solid #0f9e9180; outline-offset: 5px; }
    svg { flex: 0 0 auto; }
    .topbar { min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 20px; max-width: 1216px; margin: 0 auto; padding: 20px 32px; }
    .brand { display: inline-flex; align-items: center; gap: 12px; }
    .brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #b6d9d4; border-radius: 11px; background: var(--teal-soft); color: #168a7e; font-size: 20px; font-weight: 750; }
    .brand strong, .brand small { display: block; }
    .brand strong { font-size: 11px; font-weight: 750; letter-spacing: .13em; }
    .brand small { margin-top: 3px; color: var(--muted); font-size: 11px; letter-spacing: .07em; }
    .back-link { display: inline-flex; align-items: center; gap: 8px; padding: 9px 0; color: #506c77; font-size: 13px; font-weight: 600; }
    .back-link:hover { color: #087a70; }
    .back-link svg { width: 17px; height: 17px; }
    main { max-width: 1216px; margin: 0 auto; padding: 54px 32px 72px; }
    .entry-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(350px, 450px); align-items: center; gap: clamp(45px, 7vw, 90px); }
    .intro { max-width: 550px; padding: 12px 0; }
    .eyebrow { margin: 0 0 23px; color: #138478; font-size: 11px; font-weight: 750; letter-spacing: .14em; }
    h1, h2, h3, p { margin-top: 0; }
    h1, h2, h3 { font-family: Manrope, 'Segoe UI', Arial, sans-serif; }
    h1 { margin-bottom: 22px; color: var(--navy); font-size: clamp(36px, 4.25vw, 53px); line-height: 1.14; letter-spacing: -.05em; font-weight: 750; }
    h1 span { color: #148d81; }
    .intro-copy { max-width: 440px; margin-bottom: 39px; color: #58717d; font-size: 16px; line-height: 1.75; }
    .scope { display: flex; align-items: center; gap: 14px; max-width: 430px; padding: 20px 0; border-top: 1px solid #dde7e9; }
    .scope:last-child { border-bottom: 1px solid #dde7e9; }
    .scope-mark { display: grid; place-items: center; width: 39px; height: 39px; border: 1px solid #cee5e0; border-radius: 11px; background: #eaf5f2; color: #278e81; }
    .scope-mark svg { width: 19px; height: 19px; }
    .scope h2 { margin: 0 0 4px; font-size: 14px; font-weight: 700; letter-spacing: -.02em; }
    .scope p { margin: 0; color: #71858e; font-size: 13px; line-height: 1.5; }
    .login-card { position: relative; padding: 33px 33px 26px; overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: #fff; box-shadow: 0 16px 55px #1638490a, 0 2px 5px #16384903; }
    .login-card::before { position: absolute; top: 0; left: 30px; width: 50px; height: 3px; border-radius: 0 0 3px 3px; background: var(--teal); content: ''; }
    .card-topline { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 27px; }
    .access-symbol { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid #e0ecee; border-radius: 14px; background: #f4f9f9; color: #395f6a; }
    .access-symbol svg { width: 23px; height: 23px; }
    .admin-label { display: inline-flex; align-items: center; gap: 6px; color: #6c858d; font-size: 9px; font-weight: 750; letter-spacing: .1em; }
    .admin-label svg { width: 12px; height: 12px; }
    .login-card h2 { margin: 0 0 11px; color: var(--navy); font-size: 24px; font-weight: 750; letter-spacing: -.04em; }
    .login-copy { margin-bottom: 23px; color: var(--muted); font-size: 14px; line-height: 1.65; }
    .github-button { display: flex; justify-content: center; align-items: center; gap: 11px; min-height: 51px; padding: 13px 17px; border: 1px solid var(--navy); border-radius: 9px; background: var(--navy); color: #fff; font-size: 14px; font-weight: 700; transition: background .15s ease, transform .15s ease; }
    .github-button:hover { background: var(--navy-2); transform: translateY(-1px); }
    .github-button svg { width: 20px; height: 20px; fill: currentColor; }
    .login-note { margin: 11px 1px 24px; color: #7a8d95; font-size: 11px; line-height: 1.65; text-align: center; }
    .manage-section { padding-top: 22px; border-top: 1px solid #e8eef0; }
    .manage-section h3 { margin: 0 0 7px; color: #4e6974; font-size: 12px; font-weight: 650; }
    .manage-section > p { margin-bottom: 15px; color: #82949c; font-size: 11px; line-height: 1.6; }
    .manage-links { display: grid; gap: 9px; }
    .manage-link { display: flex; justify-content: space-between; align-items: center; gap: 14px; min-height: 61px; padding: 12px 14px; border: 1px solid #e4ecee; border-radius: 9px; background: #fcfdfd; transition: border-color .15s ease, background .15s ease; }
    .manage-link:hover { border-color: #b4d9d1; background: #f2faf7; }
    .manage-link strong { display: block; margin-bottom: 3px; color: #254957; font-size: 12px; font-weight: 650; }
    .manage-link small { display: block; color: #7d939b; font-size: 11px; }
    .manage-link svg { width: 16px; height: 16px; color: #6e969d; }
    .repo-link { display: flex; justify-content: center; align-items: center; gap: 6px; width: fit-content; margin: 20px auto 0; padding: 2px 0; color: #6b838d; font-size: 11px; }
    .repo-link:hover { color: #087a70; }
    .repo-link svg { width: 13px; height: 13px; }
    footer { max-width: 1152px; margin: 0 auto; padding: 0 32px 26px; color: #8a9ca4; font-size: 11px; }
    @media (max-width: 820px) {
      .topbar { padding: 19px 26px; }
      main { padding: 30px 26px 48px; }
      .entry-layout { grid-template-columns: minmax(0, 1fr) minmax(320px, 1fr); gap: 32px; }
      h1 { font-size: 37px; }
      .intro-copy { font-size: 14px; }
      .login-card { padding: 29px 25px 23px; }
    }
    @media (max-width: 680px) {
      .topbar { min-height: 77px; padding: 18px 21px; }
      main { max-width: 500px; padding: 20px 21px 38px; }
      .entry-layout { display: block; }
      .intro { padding: 0; margin-bottom: 29px; }
      .eyebrow { margin-bottom: 13px; font-size: 10px; }
      h1 { font-size: 36px; margin-bottom: 15px; }
      .intro-copy { margin-bottom: 0; font-size: 14px; }
      .scope { display: none; }
      .login-card { border-radius: 15px; padding: 26px 24px 24px; }
      .card-topline { margin-bottom: 22px; }
      .login-card h2 { font-size: 23px; }
      footer { max-width: 500px; padding: 0 21px 24px; text-align: center; }
      .brand strong { font-size: 10px; }
      .brand small { font-size: 10px; }
      .back-link { gap: 5px; font-size: 11px; }
    }
    @media (max-width: 360px) {
      .topbar { padding-inline: 16px; gap: 10px; }
      .brand { gap: 8px; }
      .brand-mark { width: 32px; height: 32px; font-size: 17px; }
      .brand strong { font-size: 9px; letter-spacing: .08em; }
      .brand small { font-size: 9px; }
      main { padding-inline: 16px; }
      h1 { font-size: 33px; }
      .login-card { padding: 23px 19px; }
    }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  
    button,input { font:inherit; }
    button { cursor:pointer; }
    button:focus-visible { outline:3px solid #0f9e9180;outline-offset:4px; }
    .status-message { margin:0 0 18px;padding:12px 14px;border:1px solid #d8e9e6;border-radius:8px;background:#f1faf7;color:#456e68;font-size:12px;line-height:1.65;overflow-wrap:anywhere; }
    .status-message:empty { display:none; }
    .verified-label { display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:20px;background:#e2f5f1;color:#147e72;font-size:9px;font-weight:750;letter-spacing:.04em; }
    .verified-label svg { width:13px;height:13px; }
    .admin-account { display:block;margin:0 0 18px;color:#568079;font-size:12px;overflow-wrap:anywhere; }
    .admin-menu { padding-top:0;border-top:0; }
    .logout-form { margin:23px 0 0; padding-top:19px;border-top:1px solid #e8eef0;text-align:center; }
    .logout-button { min-height:36px;padding:8px 19px;border:1px solid #d8e4e6;border-radius:7px;background:#fff;color:#627e87;font-size:12px;font-weight:600; }
    .logout-button:hover { color:#087a70;border-color:#9dcfc5;background:#f4fbf8; }
    .login-note { margin-bottom:5px; }
</style>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/#top" aria-label="Beranda Monitoring Dosen">
      <span class="brand-mark" aria-hidden="true">J</span>
      <span><strong>MONITORING DOSEN</strong><small>JAD, BKD &amp; FTE</small></span>
    </a>
    <a class="back-link" href="/#top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>
      Lihat dashboard
    </a>
  </header>
  <main><div class="entry-layout">
    <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">PENGELOLAAN DASHBOARD</p>
        <h1 id="page-title">Kelola dashboard,<br><span>dengan akses admin.</span></h1>
        <p class="intro-copy">Perbarui progres usulan dan data dosen agar informasi JAD, BKD, dan FTE tetap sesuai.</p>
        <div class="scope">
          <span class="scope-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="m8 11 2 2 5-5M8 17h8"/></svg></span>
          <div><h2>Progres usulan JAD</h2><p>Tahap ajuan dan kelengkapan syarat utama.</p></div>
        </div>
        <div class="scope">
          <span class="scope-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9h4v12M10 21V3h4v18M16 21V13h4v8M2 21h20"/></svg></span>
          <div><h2>Data BKD dan FTE</h2><p>Hasil beban kerja dan data dosen.</p></div>
        </div>
      </section>
    <section class="login-card" aria-labelledby="login-title">
      <div class="card-topline"><span class="access-symbol"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3"/></svg></span><span class="admin-label">KHUSUS ADMIN</span></div>
      <h2 id="login-title">Masuk ke pengelolaan</h2>
      <p class="login-copy">Gunakan akun GitHub yang memiliki akses pengelolaan dashboard.</p>
      <p class="status-message" id="adminStatus" role="status" aria-live="polite">__STATUS_MESSAGE__</p>
      <a class="github-button" href="/api/admin/login"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 .8a11.2 11.2 0 0 0-3.54 21.82c.56.1.77-.24.77-.54v-2.08c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.69.08-.69 1.13.08 1.72 1.16 1.72 1.16 1 .1 1.73-.24 2.15-.62.1-.73.39-1.23.71-1.51-2.5-.28-5.13-1.25-5.13-5.57 0-1.23.44-2.23 1.16-3.02-.12-.29-.5-1.43.11-2.98 0 0 .95-.3 3.08 1.15a10.67 10.67 0 0 1 5.6 0c2.13-1.45 3.08-1.15 3.08-1.15.61 1.55.23 2.69.11 2.98.72.79 1.16 1.79 1.16 3.02 0 4.33-2.64 5.29-5.15 5.57.4.35.76 1.04.76 2.09v3.18c0 .3.2.65.78.54A11.2 11.2 0 0 0 12 .8Z"/></svg>Masuk dengan GitHub</a>
      <p class="login-note">Menu pembaruan tersedia setelah akun admin diverifikasi.</p>
    </section>
  </div></main>
  <footer>Monitoring Dosen · JAD, BKD &amp; FTE</footer>
</body>
</html>
`;
const admin = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Akses pengelolaan dashboard untuk akun admin yang terverifikasi.">
  <meta name="color-scheme" content="light">
  <title>Pengelolaan Admin · Monitoring Dosen</title>
  <style>
    :root {
      --ink: #142b3b;
      --navy: #0f2b3a;
      --navy-2: #17475a;
      --teal: #0f9e91;
      --teal-soft: #e2f5f1;
      --muted: #6b7c89;
      --line: #e0e9ec;
      --paper: #f5f8f8;
      font-family: 'DM Sans', 'Segoe UI', Arial, sans-serif;
      color: var(--ink);
      background: var(--paper);
      font-synthesis: none;
      text-rendering: optimizeLegibility;
    }
    * { box-sizing: border-box; }
    body { margin: 0; min-width: 320px; }
    a { color: inherit; text-decoration: none; }
    a:focus-visible { outline: 3px solid #0f9e9180; outline-offset: 5px; }
    svg { flex: 0 0 auto; }
    .topbar { min-height: 82px; display: flex; align-items: center; justify-content: space-between; gap: 20px; max-width: 1216px; margin: 0 auto; padding: 20px 32px; }
    .brand { display: inline-flex; align-items: center; gap: 12px; }
    .brand-mark { display: grid; place-items: center; width: 38px; height: 38px; border: 1px solid #b6d9d4; border-radius: 11px; background: var(--teal-soft); color: #168a7e; font-size: 20px; font-weight: 750; }
    .brand strong, .brand small { display: block; }
    .brand strong { font-size: 11px; font-weight: 750; letter-spacing: .13em; }
    .brand small { margin-top: 3px; color: var(--muted); font-size: 11px; letter-spacing: .07em; }
    .back-link { display: inline-flex; align-items: center; gap: 8px; padding: 9px 0; color: #506c77; font-size: 13px; font-weight: 600; }
    .back-link:hover { color: #087a70; }
    .back-link svg { width: 17px; height: 17px; }
    main { max-width: 1216px; margin: 0 auto; padding: 54px 32px 72px; }
    .entry-layout { display: grid; grid-template-columns: minmax(0, 1fr) minmax(350px, 450px); align-items: center; gap: clamp(45px, 7vw, 90px); }
    .intro { max-width: 550px; padding: 12px 0; }
    .eyebrow { margin: 0 0 23px; color: #138478; font-size: 11px; font-weight: 750; letter-spacing: .14em; }
    h1, h2, h3, p { margin-top: 0; }
    h1, h2, h3 { font-family: Manrope, 'Segoe UI', Arial, sans-serif; }
    h1 { margin-bottom: 22px; color: var(--navy); font-size: clamp(36px, 4.25vw, 53px); line-height: 1.14; letter-spacing: -.05em; font-weight: 750; }
    h1 span { color: #148d81; }
    .intro-copy { max-width: 440px; margin-bottom: 39px; color: #58717d; font-size: 16px; line-height: 1.75; }
    .scope { display: flex; align-items: center; gap: 14px; max-width: 430px; padding: 20px 0; border-top: 1px solid #dde7e9; }
    .scope:last-child { border-bottom: 1px solid #dde7e9; }
    .scope-mark { display: grid; place-items: center; width: 39px; height: 39px; border: 1px solid #cee5e0; border-radius: 11px; background: #eaf5f2; color: #278e81; }
    .scope-mark svg { width: 19px; height: 19px; }
    .scope h2 { margin: 0 0 4px; font-size: 14px; font-weight: 700; letter-spacing: -.02em; }
    .scope p { margin: 0; color: #71858e; font-size: 13px; line-height: 1.5; }
    .login-card { position: relative; padding: 33px 33px 26px; overflow: hidden; border: 1px solid var(--line); border-radius: 20px; background: #fff; box-shadow: 0 16px 55px #1638490a, 0 2px 5px #16384903; }
    .login-card::before { position: absolute; top: 0; left: 30px; width: 50px; height: 3px; border-radius: 0 0 3px 3px; background: var(--teal); content: ''; }
    .card-topline { display: flex; justify-content: space-between; align-items: center; gap: 20px; margin-bottom: 27px; }
    .access-symbol { display: grid; place-items: center; width: 48px; height: 48px; border: 1px solid #e0ecee; border-radius: 14px; background: #f4f9f9; color: #395f6a; }
    .access-symbol svg { width: 23px; height: 23px; }
    .admin-label { display: inline-flex; align-items: center; gap: 6px; color: #6c858d; font-size: 9px; font-weight: 750; letter-spacing: .1em; }
    .admin-label svg { width: 12px; height: 12px; }
    .login-card h2 { margin: 0 0 11px; color: var(--navy); font-size: 24px; font-weight: 750; letter-spacing: -.04em; }
    .login-copy { margin-bottom: 23px; color: var(--muted); font-size: 14px; line-height: 1.65; }
    .github-button { display: flex; justify-content: center; align-items: center; gap: 11px; min-height: 51px; padding: 13px 17px; border: 1px solid var(--navy); border-radius: 9px; background: var(--navy); color: #fff; font-size: 14px; font-weight: 700; transition: background .15s ease, transform .15s ease; }
    .github-button:hover { background: var(--navy-2); transform: translateY(-1px); }
    .github-button svg { width: 20px; height: 20px; fill: currentColor; }
    .login-note { margin: 11px 1px 24px; color: #7a8d95; font-size: 11px; line-height: 1.65; text-align: center; }
    .manage-section { padding-top: 22px; border-top: 1px solid #e8eef0; }
    .manage-section h3 { margin: 0 0 7px; color: #4e6974; font-size: 12px; font-weight: 650; }
    .manage-section > p { margin-bottom: 15px; color: #82949c; font-size: 11px; line-height: 1.6; }
    .manage-links { display: grid; gap: 9px; }
    .manage-link { display: flex; justify-content: space-between; align-items: center; gap: 14px; min-height: 61px; padding: 12px 14px; border: 1px solid #e4ecee; border-radius: 9px; background: #fcfdfd; transition: border-color .15s ease, background .15s ease; }
    .manage-link:hover { border-color: #b4d9d1; background: #f2faf7; }
    .manage-link strong { display: block; margin-bottom: 3px; color: #254957; font-size: 12px; font-weight: 650; }
    .manage-link small { display: block; color: #7d939b; font-size: 11px; }
    .manage-link svg { width: 16px; height: 16px; color: #6e969d; }
    .repo-link { display: flex; justify-content: center; align-items: center; gap: 6px; width: fit-content; margin: 20px auto 0; padding: 2px 0; color: #6b838d; font-size: 11px; }
    .repo-link:hover { color: #087a70; }
    .repo-link svg { width: 13px; height: 13px; }
    footer { max-width: 1152px; margin: 0 auto; padding: 0 32px 26px; color: #8a9ca4; font-size: 11px; }
    @media (max-width: 820px) {
      .topbar { padding: 19px 26px; }
      main { padding: 30px 26px 48px; }
      .entry-layout { grid-template-columns: minmax(0, 1fr) minmax(320px, 1fr); gap: 32px; }
      h1 { font-size: 37px; }
      .intro-copy { font-size: 14px; }
      .login-card { padding: 29px 25px 23px; }
    }
    @media (max-width: 680px) {
      .topbar { min-height: 77px; padding: 18px 21px; }
      main { max-width: 500px; padding: 20px 21px 38px; }
      .entry-layout { display: block; }
      .intro { padding: 0; margin-bottom: 29px; }
      .eyebrow { margin-bottom: 13px; font-size: 10px; }
      h1 { font-size: 36px; margin-bottom: 15px; }
      .intro-copy { margin-bottom: 0; font-size: 14px; }
      .scope { display: none; }
      .login-card { border-radius: 15px; padding: 26px 24px 24px; }
      .card-topline { margin-bottom: 22px; }
      .login-card h2 { font-size: 23px; }
      footer { max-width: 500px; padding: 0 21px 24px; text-align: center; }
      .brand strong { font-size: 10px; }
      .brand small { font-size: 10px; }
      .back-link { gap: 5px; font-size: 11px; }
    }
    @media (max-width: 360px) {
      .topbar { padding-inline: 16px; gap: 10px; }
      .brand { gap: 8px; }
      .brand-mark { width: 32px; height: 32px; font-size: 17px; }
      .brand strong { font-size: 9px; letter-spacing: .08em; }
      .brand small { font-size: 9px; }
      main { padding-inline: 16px; }
      h1 { font-size: 33px; }
      .login-card { padding: 23px 19px; }
    }
    @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
  
    button,input { font:inherit; }
    button { cursor:pointer; }
    button:focus-visible { outline:3px solid #0f9e9180;outline-offset:4px; }
    .status-message { margin:0 0 18px;padding:12px 14px;border:1px solid #d8e9e6;border-radius:8px;background:#f1faf7;color:#456e68;font-size:12px;line-height:1.65;overflow-wrap:anywhere; }
    .status-message:empty { display:none; }
    .verified-label { display:inline-flex;align-items:center;gap:6px;padding:6px 9px;border-radius:20px;background:#e2f5f1;color:#147e72;font-size:9px;font-weight:750;letter-spacing:.04em; }
    .verified-label svg { width:13px;height:13px; }
    .admin-account { display:block;margin:0 0 18px;color:#568079;font-size:12px;overflow-wrap:anywhere; }
    .admin-menu { padding-top:0;border-top:0; }
    .logout-form { margin:23px 0 0; padding-top:19px;border-top:1px solid #e8eef0;text-align:center; }
    .logout-button { min-height:36px;padding:8px 19px;border:1px solid #d8e4e6;border-radius:7px;background:#fff;color:#627e87;font-size:12px;font-weight:600; }
    .logout-button:hover { color:#087a70;border-color:#9dcfc5;background:#f4fbf8; }
    .login-note { margin-bottom:5px; }
</style>
  <script src="/assets/js/admin-session.js" defer></script>
</head>
<body>
  <header class="topbar">
    <a class="brand" href="/#top" aria-label="Beranda Monitoring Dosen">
      <span class="brand-mark" aria-hidden="true">J</span>
      <span><strong>MONITORING DOSEN</strong><small>JAD, BKD &amp; FTE</small></span>
    </a>
    <a class="back-link" href="/#top">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m14 6-6 6 6 6M8 12h12"/></svg>
      Lihat dashboard
    </a>
  </header>
  <main><div class="entry-layout">
    <section class="intro" aria-labelledby="page-title">
        <p class="eyebrow">PENGELOLAAN DASHBOARD</p>
        <h1 id="page-title">Kelola dashboard,<br><span>dengan akses admin.</span></h1>
        <p class="intro-copy">Perbarui progres usulan dan data dosen agar informasi JAD, BKD, dan FTE tetap sesuai.</p>
        <div class="scope">
          <span class="scope-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M7 3h10a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="m8 11 2 2 5-5M8 17h8"/></svg></span>
          <div><h2>Progres usulan JAD</h2><p>Tahap ajuan dan kelengkapan syarat utama.</p></div>
        </div>
        <div class="scope">
          <span class="scope-mark" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V9h4v12M10 21V3h4v18M16 21V13h4v8M2 21h20"/></svg></span>
          <div><h2>Data BKD dan FTE</h2><p>Hasil beban kerja dan data dosen.</p></div>
        </div>
      </section>
    <section class="login-card" aria-labelledby="admin-title">
      <div class="card-topline"><span class="access-symbol"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/></svg></span><span class="verified-label"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/></svg>Admin terverifikasi</span></div>
      <h2 id="admin-title">Pilih pembaruan</h2>
      <p class="login-copy">Akun GitHub Anda sudah diverifikasi untuk mengelola dashboard.</p>
      <span class="admin-account">Masuk sebagai <strong>__ADMIN_LOGIN__</strong></span>
      <p class="status-message" role="status" aria-live="polite">__STATUS_MESSAGE__</p>
      <div class="manage-section admin-menu">
        <div class="manage-links">
          <a class="manage-link" href="/admin/bkd"><span><strong>Perbarui BKD</strong><small>Unggah Excel SISTER dan periksa hasilnya</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a>
          <a class="manage-link" href="/admin/jad"><span><strong>Progres JAD</strong><small>Tahap ajuan dan status dokumen</small></span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14m-5-5 5 5-5 5"/></svg></a>
        </div>
        <a class="repo-link" href="https://telkomuniversityofficial-my.sharepoint.com/:x:/g/personal/see_resources_telkomuniversity_ac_id/IQAItpnZubYrTJAjVgcQqKWnAXnbg5YhtknKilLcw7798Gw?e=i6LdBF" target="_blank" rel="noopener noreferrer">Kelola data FTE di Excel <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10"/></svg></a>
        <p class="login-note">Gunakan sheet 2026 (ganjil 26-27).</p>
      </div>
      <form class="logout-form" method="post" action="/api/admin/logout"><input type="hidden" name="csrf" value="__CSRF_TOKEN__"><button class="logout-button" type="submit">Keluar</button></form>
    </section>
  </div></main>
  <footer>Monitoring Dosen · JAD, BKD &amp; FTE</footer>
</body>
</html>
`;
const bkd = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Siapkan pembaruan rekap BKD dari ekspor SISTER terbaru.">
  <title>Perbarui BKD · Admin Monitoring Dosen</title>
  <link rel="stylesheet" href="/assets/css/admin-bkd.css?v=20261002">
  <script src="/assets/js/admin-session.js" defer></script>
  <script src="/assets/js/bkd-import.js?v=20261002" defer></script>
  <script src="/assets/js/bkd-xlsx.js?v=20261002" defer></script>
  <script src="/assets/js/admin-bkd.js?v=20261002" defer></script>
<style>
  .admin-header-actions { display:flex;align-items:center;justify-content:flex-end;gap:20px;min-width:0; }
  .verified-admin { display:inline-flex;align-items:center;gap:7px;font-size:10px;line-height:1.5;color:#b7e0d8; }
  .verified-admin svg { width:16px;height:16px; }
  .verified-admin strong { display:block;color:#e7f6f2;font-size:11px;overflow-wrap:anywhere;max-width:210px; }
  .admin-header-actions form { margin:0; }
  .admin-logout { min-height:34px;padding:7px 12px;border:1px solid #46727c;border-radius:6px;background:#163b4a;color:#d6ece9;font-size:11px; }
  .admin-logout:hover { border-color:#76b5ab;background:#1b4c5b; }
  .admin-status { margin:0 0 20px;padding:13px 16px;border:1px solid #c8e1db;border-radius:8px;background:#edf8f4;color:#456e68;font-size:12px;line-height:1.65;overflow-wrap:anywhere; }
  .admin-status:empty { display:none; }
  @media(max-width:720px) { .topbar { flex-wrap:wrap;gap:14px; }.admin-header-actions { width:100%;justify-content:space-between;gap:12px;padding-top:12px;border-top:1px solid #ffffff1a; }.verified-admin strong { max-width:160px; } }
  @media(max-width:360px) { .admin-header-actions { gap:9px; }.verified-admin strong { max-width:115px; }.admin-logout { padding:7px 9px; } }
</style>
</head>
<body>
  <header class="topbar"><a class="brand" href="/#top"><span class="brand-mark">J</span><span><strong>MONITORING DOSEN</strong><small>JAD, BKD &amp; FTE</small></span></a><div class="admin-header-actions"><span class="verified-admin"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6l-8-3Z"/><path d="m8.5 12 2.3 2.3 4.7-4.7"/></svg><span>Admin terverifikasi <strong>__ADMIN_LOGIN__</strong></span></span><a class="back-link" href="/admin/">← Menu admin</a><form method="post" action="/api/admin/logout"><input type="hidden" name="csrf" value="__CSRF_TOKEN__"><button class="admin-logout" type="submit">Keluar</button></form></div></header>
  <main class="shell" data-admin-editor>
    <p class="admin-status" role="status" aria-live="polite">__STATUS_MESSAGE__</p>
    <div class="page-heading"><div><p class="eyebrow">PENGELOLAAN DATA / BKD</p><h1>Perbarui rekap BKD</h1><p>Gunakan ekspor SISTER terbaru. Periksa hasil untuk 8 prodi sebelum menerbitkan pembaruan.</p></div><a class="view-link" href="/#bkd" target="_blank" rel="noopener">Lihat dashboard ↗</a></div>
    <ol class="steps" aria-label="Langkah pembaruan"><li><span>1</span> Pilih file</li><li><span>2</span> Periksa hasil</li><li><span>3</span> Terbitkan</li></ol>
    <div class="workspace">
      <section class="card upload-card" aria-labelledby="uploadHeading">
        <p class="eyebrow">LANGKAH 1</p><h2 id="uploadHeading">Pilih file BKD terbaru</h2><p class="muted">CSV atau Excel (.xlsx) hasil ekspor SISTER, maksimal 10 MB.</p>
        <label class="file-zone" for="bkdFile"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 16V3m-5 5 5-5 5 5M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></svg><strong>Pilih file dari komputer</strong><span>File akan diperiksa di halaman ini.</span><input id="bkdFile" type="file" accept=".csv,.xlsx" aria-label="Pilih file BKD terbaru"></label>
        <p id="fileInfo" class="file-info" aria-live="polite">Belum ada file dipilih.</p>
        <label id="sheetField" class="sheet-field" hidden>Lembar Excel<select id="sheetSelect" aria-label="Pilih lembar BKD"></select></label>
        <div class="baseline-box"><span class="status-dot" aria-hidden="true"></span><div><strong>Dasar pembaruan</strong><p id="baselineStatus" role="status">Memuat data dashboard terbaru…</p></div><button id="reloadBaseline" class="text-button" type="button">Muat ulang</button></div>
        <p class="helper">Hanya 8 prodi yang digunakan dashboard yang diambil dari file. Kesimpulan M/TM mengikuti ekspor SISTER.</p>
        <details class="format-help"><summary>Format file yang digunakan</summary><p>Gunakan ekspor lengkap SISTER dengan kolom nama dosen, prodi, status, jabatan fungsional, kinerja, beban lebih, dan kesimpulan. Jika memakai Excel, pertahankan judul kolom dari CSV SISTER.</p><p>Nomor sertifikat, NIDN, dan NUPTK tidak dimasukkan ke hasil untuk dashboard.</p></details>
      </section>
      <section class="card preview-card" aria-labelledby="previewHeading">
        <div class="card-heading"><div><p class="eyebrow">LANGKAH 2</p><h2 id="previewHeading">Periksa hasil pembaruan</h2></div><span id="draftBadge" class="badge">Belum ada draf</span></div>
        <div id="emptyPreview" class="empty-preview"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><path d="M4 4h16v16H4zM4 10h16M10 4v16"/></svg><h3>Rekap muncul setelah file dipilih</h3><p>Anda dapat memeriksa jumlah dosen, M/TM, dan perubahan data sebelum mengunduh hasil.</p></div>
        <div id="previewContent" hidden>
          <div class="kpis"><div><span>Total dosen</span><strong id="previewTotal">—</strong></div><div class="met"><span>Memenuhi</span><strong id="previewMet">—</strong></div><div class="unmet"><span>Tidak memenuhi</span><strong id="previewUnmet">—</strong></div></div>
          <p id="comparisonSummary" class="comparison-summary"></p>
          <div class="table-wrap"><table><caption>Rekap 8 prodi dari file terbaru</caption><thead><tr><th>Program studi</th><th>Saat ini</th><th>Terbaru</th><th>M</th><th>TM</th></tr></thead><tbody id="programRows"></tbody></table></div>
          <p id="certificationSummary" class="helper"></p><p id="sourceSummary" class="helper"></p>
          <details id="changeDetails" class="change-details"><summary>Daftar perubahan</summary><div id="changeLists"></div></details>
          <label id="removalField" class="removal-field" hidden><input id="confirmRemoval" type="checkbox"><span id="removalText"></span></label>
        </div>
      </section>
    </div>
    <p id="pageMessage" class="message" role="status" aria-live="polite" hidden></p>
    <section class="card publish-card" aria-labelledby="publishHeading"><div><p class="eyebrow">LANGKAH 3</p><h2 id="publishHeading">Terbitkan melalui GitHub</h2><p>Unduh hasil, lalu unggah sebagai <strong>dashboard-data.json</strong> ke folder data dan pilih <strong>Commit changes</strong>. GitHub memeriksa izin akun admin Anda.</p><p class="helper">Data JAD dan FTE dimuat ulang dari GitHub sebelum hasil diunduh. File sumber CSV/Excel tetap di komputer Anda.</p></div><div class="publish-actions"><button id="downloadResult" class="primary-button" type="button" disabled>1. Unduh hasil BKD</button><a class="secondary-button" href="https://github.com/SDM-FTE/dashboard/upload/main/assets/data" target="_blank" rel="noopener">2. Unggah ke GitHub ↗</a><a class="text-link" href="/#bkd" target="_blank" rel="noopener">Periksa dashboard setelah diterbitkan ↗</a></div></section>
    <footer>MONITORING DOSEN <span>Pengelolaan BKD melalui akun GitHub admin</span></footer>
  </main>
</body>
</html>
`;
const jad = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Perbarui status ajuan dan syarat utama penelitian JAD melalui form admin.">
  <meta name="csrf-token" content="__CSRF_TOKEN__">
  <title>Perbarui progres JAD · Admin Monitoring Dosen</title>
  <link rel="stylesheet" href="/assets/css/admin-bkd.css?v=20261002-admin">
  <link rel="stylesheet" href="/assets/css/admin-jad.css?v=20261002-admin">
  <script src="/assets/js/admin-session.js?v=20261002-admin" defer></script>
  <script src="/assets/js/admin-jad.js?v=20261002-admin" defer></script>
</head>
<body>
  <header class="topbar"><a class="brand" href="/#top"><span class="brand-mark">J</span><span><strong>MONITORING DOSEN</strong><small>JAD, BKD &amp; FTE</small></span></a><a class="back-link" href="/admin/">← Halaman admin</a></header>
  <main class="shell jad-shell" data-admin-editor>
    <div class="page-heading"><div><p class="eyebrow">PENGELOLAAN DATA / JAD</p><h1>Perbarui progres JAD</h1><p>Pilih dosen, ubah status ajuan dan kelengkapan penelitian, lalu simpan di halaman ini.</p></div><a class="view-link" href="/#jad" target="_blank" rel="noopener">Lihat dashboard ↗</a></div>
    <div class="admin-identity">Masuk sebagai <strong>__ADMIN_LOGIN__</strong><span>Khusus admin</span><form action="/api/admin/logout" method="post"><input type="hidden" name="csrf" value="__CSRF_TOKEN__"><button type="submit">Keluar</button></form></div>
    <ol class="steps" aria-label="Langkah pembaruan"><li><span>1</span> Pilih dosen</li><li><span>2</span> Ubah status</li><li><span>3</span> Simpan</li></ol>
    <p id="pageMessage" class="message" role="status" aria-live="polite" hidden></p>
    <a id="loginAgain" class="login-again" href="/admin/" target="_blank" rel="noopener" hidden>Masuk kembali sebagai admin ↗</a>
    <div class="workspace jad-workspace">
      <section class="card lecturer-card" aria-labelledby="lecturerHeading">
        <p class="eyebrow">LANGKAH 1</p><h2 id="lecturerHeading">Pilih dosen</h2>
        <label class="form-label" for="lecturerSearch">Cari nama atau ID</label><input id="lecturerSearch" class="form-input" type="search" placeholder="Contoh: Laily atau 20" autocomplete="off" disabled>
        <p id="searchCount" class="helper" aria-live="polite">Memuat daftar dosen…</p>
        <label class="form-label" for="lecturerSelect">Dosen yang diperbarui</label><select id="lecturerSelect" class="form-input" disabled><option value="">Memuat data…</option></select>
        <div id="selectedLecturer" class="selected-lecturer" hidden><strong id="lecturerName"></strong><span id="lecturerId"></span><a id="lecturerPublicLink" href="/#jad" target="_blank" rel="noopener">Lihat progres dosen ↗</a></div>
        <div class="baseline-box"><span class="status-dot" aria-hidden="true"></span><div><strong>Data tersimpan</strong><p id="baselineStatus" role="status">Memuat progres terbaru…</p></div><button id="reloadProgress" class="text-button" type="button" disabled>Muat ulang</button></div>
        <p class="helper">Perubahan berlaku untuk dosen yang dipilih. Pilihan kosong berarti belum diperbarui atau belum diperiksa.</p>
      </section>
      <section class="card editor-card" aria-labelledby="editorHeading">
        <div class="card-heading"><div><p class="eyebrow">LANGKAH 2</p><h2 id="editorHeading">Ubah status</h2></div><span id="draftBadge" class="badge">Memuat data</span></div>
        <form id="jadForm">
          <fieldset id="jadFields" disabled>
            <div class="stage-field"><label class="form-label" for="stageSelect">Status ajuan</label><select id="stageSelect" class="form-input"><option value="">Belum diperbarui</option><option value="0">Pengecekan ajuan</option><option value="1">Pengesahan</option><option value="2">Penugasan asesor</option><option value="3">Penilaian</option><option value="4">Verifikasi SK</option><option value="5">Selesai</option></select><p class="helper">Pilih tahap yang sedang berjalan. Pilih Selesai jika seluruh proses telah tuntas.</p></div>
            <h3 class="requirements-heading">Syarat utama penelitian</h3>
            <div class="requirement-field"><div><label class="form-label" for="paperPdfSelect">Paper terbit (PDF)</label><p>Naskah paper terbit tersedia dalam format PDF.</p></div><select id="paperPdfSelect" class="form-input"><option value="">Belum diperiksa</option><option value="true">Lengkap</option><option value="false">Belum lengkap</option></select></div>
            <div class="requirement-field"><div><label class="form-label" for="similaritySelect">Hasil similarity</label><p>Dokumen atau hasil pemeriksaan similarity tersedia.</p></div><select id="similaritySelect" class="form-input"><option value="">Belum diperiksa</option><option value="true">Lengkap</option><option value="false">Belum lengkap</option></select></div>
            <div class="requirement-field"><div><label class="form-label" for="correspondenceSelect">Korespondensi syarat utama</label><p>Bukti korespondensi untuk pemenuhan syarat utama tersedia.</p></div><select id="correspondenceSelect" class="form-input"><option value="">Belum diperiksa</option><option value="true">Lengkap</option><option value="false">Belum lengkap</option></select></div>
          </fieldset>
          <div id="conflictPanel" class="conflict-panel" role="alert" hidden><h3>Data dosen ini sudah berubah</h3><p>Perubahan Anda tetap ada di form. Berikut status terbaru yang telah tersimpan:</p><dl id="conflictDetails"></dl><button id="loadConflict" class="secondary-button" type="button">Muat data terbaru dan tinjau ulang</button><p class="helper">Memuat ulang akan mengganti perubahan yang belum disimpan setelah Anda menyetujuinya.</p></div>
          <div class="save-bar"><div><p class="eyebrow">LANGKAH 3</p><strong id="saveHint">Belum ada perubahan.</strong><p>Pembaruan akan tampil setelah penerbitan dashboard selesai.</p></div><button id="saveProgress" class="primary-button" type="submit" disabled>Simpan perubahan</button></div>
        </form>
        <noscript><p class="message error">Aktifkan JavaScript untuk menggunakan form pembaruan JAD.</p></noscript>
      </section>
    </div>
    <footer>MONITORING DOSEN <span>Pembaruan progres JAD oleh admin</span></footer>
  </main>
</body>
</html>
`;
exports.login = login;
exports.admin = admin;
exports.bkd = bkd;
exports.jad = jad;
