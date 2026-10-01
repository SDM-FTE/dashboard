# Dashboard Monitoring JAD + BKD + FTE

Paket untuk repository GitHub `SDM-FTE/dashboard`. Halaman utama berisi pilihan Detail Usulan JAD, Rekap BKD, dan Data FTE 2026. Pembaruan data dilakukan melalui GitHub. URL Netlify yang dibagikan merupakan halaman yang dilihat; paket ini tidak mengubah konfigurasi penerbitan repository.

## Halaman

- **JAD:** daftar usulan dan rincian angka kredit/SKP.
- **BKD:** rekap 210 dosen pada 8 prodi pilihan, dengan daftar dosen dan rincian kinerja.
- **FTE:** 225 dosen dari sheet `2026 (ganjil 26-27)`, pencarian, filter prodi/unit, JFA, status dosen, detail pendidikan/keahlian, dan pagination. Baris selain dosen telah dihapus dari data dashboard.
- Masa TMT JFA, masa kerja, masa kerja SK, dan umur dihitung ulang di halaman menggunakan tanggal berjalan zona WIB. Halaman terbuka lama memeriksa perubahan tanggal dan memperbarui hitungan.

## Data yang ditampilkan

Berkas JSON tidak menyertakan NIP, NIDN, NUPTK, nomor sertifikat, tempat lahir, atau gender. **Tanggal lahir tetap tersimpan di `assets/data/dashboard-data.json` sebagai dasar hitung umur otomatis, meskipun tidak ditampilkan di halaman.** JSON tersebut dapat dibuka siapa pun apabila situs diterbitkan secara publik. Tanggal TMT JFA, mulai kerja, dan mulai SK juga tersedia di JSON sebagai dasar perhitungan masa.

## Pasang perbaikan situs satu kali

1. Ekstrak ZIP situs yang telah diperbaiki.
2. Buka repository `SDM-FTE/dashboard`, pilih **Add file → Upload files**.
3. Unggah `index.html`, `.nojekyll`, `README.md`, serta folder `assets` ke tingkat teratas repository. Pertahankan susunan folder dan ganti berkas versi lama.
4. Commit perubahan ke branch `main`. Gunakan konfigurasi penerbitan repository yang sudah ada; GitHub Pages yang tercatat menggunakan `main` dan `/(root)`.
5. Setelah penerbitan selesai, buka halaman progres dosen untuk memeriksa tampilannya.

Jika data di GitHub sudah berubah sejak paket ini dibuat, pasang hanya `assets/js/dashboard.js` dan `assets/css/styles.css` dari paket. Pertahankan kedua JSON terbaru di repository agar pemasangan perbaikan tidak mengganti data yang sudah diperbarui.

Perbaikan ini diperlukan agar halaman membaca status yang disimpan dalam objek `lecturers` pada JSON. Pasang perbaikan sebelum memakai alur pembaruan harian berikut.

## Perbarui progres harian dengan Excel atau alat lokal

Alat lokal **PEMBARU-JAD.html** dan workbook **UPDATE-PROGRES-JAD.xlsx** diberikan terpisah dari ZIP situs. Simpan keduanya di komputer pengelola. Jangan unggah keduanya ke repository situs.

1. Pilih **satu sumber terbaru**: `jad-progress.json` terakhir dari GitHub/cadangan, atau workbook Excel terakhir yang memuat seluruh status terkini. Buka `PEMBARU-JAD.html` di komputer dan muat sumber tersebut.
2. Jika memakai JSON, ubah tahap dan checklist dosen langsung di alat lokal. Jika memakai Excel, edit workbook terakhir di Excel, simpan, lalu muat workbook hasil edit ke alat. Untuk penggunaan Excel berikutnya, lanjutkan workbook terakhir itu; jangan kembali ke template awal setelah progres berubah.
3. Periksa hasil dan unduh berkas bernama `jad-progress.json`.
4. Di GitHub, buka folder `assets/data` pada repository `SDM-FTE/dashboard`, pilih **Add file → Upload files**, lalu unggah `jad-progress.json` untuk mengganti berkas lama. Pastikan berkas berada di `assets/data`, bukan di tingkat teratas.
5. Commit ke `main`. Tunggu penerbitan dari repository selesai, lalu muat ulang halaman dosen.

Impor mengganti status **seluruh 26 dosen** dengan isi berkas yang dimuat; impor tidak menggabungkan dua sumber. Jangan memuat template Excel awal sesudah JSON terbaru karena status dalam template dapat menggantikan progres terkini. Bila terakhir mengedit melalui alat langsung, gunakan JSON hasil unduhan sebagai sumber untuk pembaruan berikutnya.

Pembaruan harian cukup mengganti JSON progres; berkas HTML, CSS, JavaScript, dan `dashboard-data.json` tidak perlu diunggah ulang. Website menampilkan status baca-saja. Izin menyimpan perubahan dikelola melalui akses tulis repository GitHub.

Workbook Excel tidak dimasukkan. Data dashboard berada di `assets/data/dashboard-data.json`.

## Progres dan ceklis JAD

- Klik baris dosen pada tabel JAD untuk membuka halaman progres, tahapan ajuan, dan rincian yang tersedia dari workbook.
- Ceklis syarat utama adalah **Paper terbit (PDF)**, **Hasil similarity**, dan **Korespondensi syarat utama**. Di situs, status tampil baca-saja.
- Data setiap dosen berada dalam `lecturers`, dengan nomor yang sama seperti data JAD. Nilai syarat menggunakan `true` (lengkap), `false` (sudah diperiksa tetapi belum lengkap), atau `null` (belum diperiksa). Gunakan `stage: null` bila belum diperbarui; angka 0–4 menunjukkan tahap yang sedang berjalan dan 5 berarti Selesai.
- Setelah memperbarui data, pengelola menyimpan JSON di GitHub melalui commit. Situs dan berkas JSON bersifat baca-saja bagi pengunjung. Ceklis hanya menunjukkan status kelengkapan.
- Untuk menambah dosen ke daftar, tambahkan entri baru di `lecturers` dengan `no` yang sama seperti data JAD.
