'use strict';

// Only the authenticated Netlify handler serves this template.
module.exports = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Validasi pengajuan dan kelola antrean JAD oleh admin.">
  <title>Kelola antrean JAD · Admin Monitoring Dosen</title>
  <link rel="stylesheet" href="/assets/css/admin-queue.css?v=20261005">
  <script src="/assets/js/admin-session.js?v=20261005" defer></script>
  <script src="/assets/js/admin-queue.js?v=20261005" defer></script>
</head>
<body>
  <header class="queue-topbar"><a class="queue-brand" href="/#top"><span class="queue-brand-mark">J</span><span><strong>MONITORING DOSEN</strong><small>JAD, BKD &amp; FTE</small></span></a><div class="queue-header-actions"><span>Admin <strong>__ADMIN_LOGIN__</strong></span><a href="/admin/">← Menu admin</a><form action="/api/admin/logout" method="post"><input type="hidden" name="csrf" value="__CSRF_TOKEN__"><button type="submit">Keluar</button></form></div></header>
  <main class="queue-shell" data-admin-editor>
    <div class="queue-heading"><div><p class="queue-eyebrow">PENGELOLAAN DATA / JAD</p><h1>Kelola antrean JAD</h1><p>Periksa pengajuan dosen, berikan nomor antrean, dan perbarui status penanganannya.</p></div><a class="queue-secondary" href="/antrian-jad/" target="_blank" rel="noopener">Lihat antrean publik ↗</a></div>
    <div class="queue-load-bar"><p id="queueLoadState" role="status">Memuat data terbaru…</p><button id="queueReload" class="queue-text-button" type="button" disabled>Muat ulang</button></div>
    <p id="queueMessage" class="queue-message" role="status" aria-live="polite" hidden></p><a id="queueLoginAgain" class="queue-login-again" href="/admin/" target="_blank" rel="noopener" hidden>Masuk kembali sebagai admin ↗</a>
    <section class="queue-panel" aria-labelledby="queuePendingHeading"><div class="queue-section-heading"><div><h2 id="queuePendingHeading">Menunggu validasi</h2><p>Pengajuan dari halaman publik belum mendapat nomor. Nomor diberikan setelah admin menyetujui pengajuan.</p></div><span id="queuePendingCount" class="queue-count"></span></div><p id="queuePendingEmpty" class="queue-empty" hidden>Belum ada pengajuan yang perlu divalidasi.</p><div id="queuePendingList" class="queue-pending-list"></div></section>
    <section class="queue-panel" aria-labelledby="queueAddHeading"><div class="queue-section-heading"><div><h2 id="queueAddHeading">Tambahkan ajuan langsung</h2><p>Gunakan formulir ini jika admin memasukkan ajuan dosen. Nomor antrean diberikan setelah berhasil disimpan.</p></div></div><form id="queueAddForm"><fieldset id="queueAddFields" disabled><div class="queue-add-grid"><div><label for="queueLecturerSearch">Cari nama dosen</label><input id="queueLecturerSearch" type="search" placeholder="Ketik nama atau ID dosen" autocomplete="off"><p id="queueLecturerCount" class="queue-helper">Memuat daftar dosen…</p><label for="queueLecturerSelect">Pilih dosen</label><select id="queueLecturerSelect"><option value="">Pilih dosen…</option></select><p id="queueLecturerInfo" class="queue-helper">Prodi dan jabatan saat ini akan ditampilkan setelah dosen dipilih.</p></div><div><label for="queueRankSelect">Jabatan yang diajukan</label><select id="queueRankSelect"><option value="">Pilih jabatan tujuan…</option></select><p class="queue-helper">Pilih jabatan yang lebih tinggi dari jabatan dosen saat ini.</p><button id="queueAddButton" class="queue-primary queue-add-button" type="submit" disabled>Tambahkan ke antrean</button></div></div></fieldset></form></section>
    <section class="queue-panel" aria-labelledby="queueApplicationsHeading"><div class="queue-section-heading"><div><h2 id="queueApplicationsHeading">Ajuan bernomor</h2><p>Nomor ajuan tetap. Urutan aktif hanya menghitung ajuan dengan status Dalam antrean atau Sedang diproses.</p></div><span id="queueApplicationsCount" class="queue-count"></span></div><p id="queueApplicationsEmpty" class="queue-empty" hidden>Belum ada ajuan yang disetujui atau dimasukkan oleh admin.</p><div id="queueApplicationsList" class="queue-applications-list"></div></section>
    <noscript><p class="queue-message queue-error">Aktifkan JavaScript untuk mengelola antrean JAD.</p></noscript>
    <footer>MONITORING DOSEN <span>Validasi dan pengelolaan antrean oleh admin</span></footer>
  </main>
</body>
</html>`;
