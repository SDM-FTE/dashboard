# Dashboard Monitoring JAD + BKD + FTE

Paket untuk repository GitHub Pages `SDM-FTE/dashboard`. Halaman utama berisi pilihan Detail Usulan JAD, Rekap BKD, dan Data FTE 2026.

## Halaman

- **JAD:** daftar usulan dan rincian angka kredit/SKP.
- **BKD:** rekap 210 dosen pada 8 prodi pilihan, dengan daftar dosen dan rincian kinerja.
- **FTE:** 260 baris pegawai dari sheet `2026 (ganjil 26-27)`, pencarian, filter prodi/unit, JFA, status pegawai, detail pendidikan/keahlian, dan pagination.
- Masa TMT JFA, masa kerja, masa kerja SK, dan umur dihitung ulang di halaman menggunakan tanggal berjalan zona WIB. Halaman terbuka lama memeriksa perubahan tanggal dan memperbarui hitungan.

## Data yang ditampilkan

Berkas JSON tidak menyertakan NIP, NIDN, NUPTK, nomor sertifikat, tempat lahir, atau gender. **Tanggal lahir tetap tersimpan di `assets/data/dashboard-data.json` sebagai dasar hitung umur otomatis, meskipun tidak ditampilkan di halaman.** JSON tersebut dapat dibuka siapa pun karena situs GitHub Pages bersifat publik. Unggah paket ini hanya jika publikasi tanggal lahir untuk penghitungan umur telah disetujui. Tanggal TMT JFA, mulai kerja, dan mulai SK juga tersedia di JSON sebagai dasar perhitungan masa.

## Unggah ke repository yang sudah ada

1. Ekstrak ZIP.
2. Buka repository `SDM-FTE/dashboard`, pilih **Add file → Upload files**.
3. Unggah `index.html`, `.nojekyll`, `README.md`, serta folder `assets` ke tingkat teratas repository. Saat GitHub meminta penggantian berkas, pilih untuk mengganti berkas lama.
4. Commit perubahan langsung ke branch `main`.
5. GitHub Pages dari `main` dan `/(root)` akan menerbitkan pembaruan otomatis setelah commit.

Workbook Excel tidak dimasukkan. Data dashboard berada di `assets/data/dashboard-data.json`.

## Progres dan ceklis admin JAD

- Klik baris dosen pada tabel JAD untuk membuka halaman progres, tahapan ajuan, dan rincian yang tersedia dari workbook.
- Ceklis syarat utama adalah **Paper terbit (PDF)**, **Hasil similarity**, dan **Korespondensi syarat utama**. Di situs, status tampil baca-saja.
- Untuk mengubah status, admin yang memiliki akses tulis repository membuka [`assets/data/jad-progress.json`](https://github.com/SDM-FTE/dashboard/edit/main/assets/data/jad-progress.json), mencari nama dosen pada berkas tersebut, mengubah nilai syarat menjadi `true` (lengkap), `false` (sudah diperiksa tetapi belum lengkap), atau `null` (belum diperiksa), lalu melakukan commit. Gunakan `stage: null` bila belum diperbarui; angka 0–4 menunjukkan tahap yang sedang berjalan dan 5 berarti Selesai.
- GitHub membatasi siapa yang dapat menyimpan perubahan ke branch utama. Namun situs dan berkas JSON tetap dapat dibaca publik; jangan masukkan berkas PDF, tautan privat, atau informasi sensitif ke JSON. Ceklis hanya menunjukkan status kelengkapan.
- Untuk menambah dosen ke daftar, tambahkan entri baru di `lecturers` dengan `no` yang sama seperti data JAD.
