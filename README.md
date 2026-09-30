# Dashboard Monitoring JAD + BKD

Paket statis untuk GitHub Pages. `index.html` membuka Beranda dashboard, dengan halaman Detail Usulan JAD dan Rekap BKD yang dapat dipilih lewat menu. Seluruh tampilan dan data dashboard berada di folder `assets/`.

## Isi paket

- Beranda: ringkasan data JAD dan BKD, dengan tombol menuju dua halaman detail.
- Detail Usulan JAD: 26 dosen, ringkasan yang memfilter daftar saat diklik, baris tabel yang membuka detail, filter nama/status publikasi/usulan JFA, serta rincian angka kredit dan SKP per tahun. Kartu Total AKK Baru sudah dihapus.
- Rekap BKD: 210 dosen pada 8 prodi pilihan, ringkasan yang dapat diklik untuk membuka detail per prodi atau menyaring status memenuhi/tidak memenuhi, daftar dosen per prodi yang dapat dibuka, dan filter pencarian lintas prodi.
- File sumber Excel tidak dimasukkan. Dashboard memakai salinan data JSON di `assets/data/dashboard-data.json`.
- NIDN dan NUPTK tidak ditampilkan di dashboard.

## Upload dan publish

1. Ekstrak ZIP.
2. Buat repository baru di GitHub.
3. Di halaman repository, pilih **Add file → Upload files**.
4. Unggah isi folder paket ini ke tingkat teratas repository. Pastikan `index.html` berada di tingkat teratas, dengan folder `assets` di sebelahnya. Jika mengganti versi lama, unggah berkas/folder baru pada lokasi yang sama lalu setujui penggantian berkas yang diminta GitHub.
5. Buka **Settings → Pages**.
6. Pada **Build and deployment**, pilih **Deploy from a branch**, pilih branch `main` dan folder `/ (root)`, lalu tekan **Save**.
7. Setelah GitHub selesai menerbitkan situs, buka alamat yang ditampilkan pada halaman Pages.

## Catatan akses data

Dashboard ini memuat nama dosen dan ringkasan penilaian JAD/BKD. Situs GitHub Pages publik dapat dibaca siapa saja. Pastikan penggunaan dan publikasi datanya sesuai izin yang berlaku sebelum mengunggah repository.

## Memperbarui data

Ganti `assets/data/dashboard-data.json` dengan data JSON yang sudah diperbarui, lalu unggah commit baru ke repository. Struktur halaman dan nama kolom data harus tetap sama.
