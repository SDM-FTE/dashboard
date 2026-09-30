# Dashboard Monitoring JAD + BKD

Paket statis untuk GitHub Pages. `index.html` membuka Beranda yang hanya berisi pilihan halaman JAD dan BKD.

## Isi paket

- Beranda: dua pilihan halaman, Detail Usulan JAD dan Rekap BKD.
- JAD: klik angka ringkasan atau status publikasi untuk membuka halaman tabel Detail Usulan JAD. Tabel menyediakan pencarian/filter; klik baris dosen untuk melihat rincian angka kredit dan SKP per tahun. Kartu Total AKK Baru sudah dihapus.
- BKD: 210 dosen pada 8 prodi pilihan. Klik nama prodi di rekap untuk membuka halaman berisi daftar dosen pada prodi itu saja. Daftar memiliki pencarian, filter kesimpulan, dan pagination; klik baris dosen untuk membuka rincian kinerja.
- File sumber Excel tidak dimasukkan. Dashboard memakai salinan data JSON di `assets/data/dashboard-data.json`.
- NIDN dan NUPTK tidak ditampilkan di dashboard.

## Upload dan publish

1. Ekstrak ZIP.
2. Buat repository baru di GitHub.
3. Di halaman repository, pilih **Add file → Upload files**.
4. Unggah isi folder paket ini ke tingkat teratas repository. Pastikan `index.html` berada di tingkat teratas, dengan folder `assets` di sebelahnya. Jika mengganti versi lama, unggah berkas/folder baru pada lokasi yang sama lalu setujui penggantian berkas yang diminta GitHub.
5. Buka **Settings → Pages**.
6. Pada **Build and deployment**, pilih **GitHub Actions** sebagai sumber publish. Ini diperlukan untuk alur pembaruan data terjadwal pada bagian berikut.
7. Setelah GitHub menerbitkan situs, buka alamat yang ditampilkan pada halaman Pages.

## Catatan akses data

Dashboard ini memuat nama dosen dan ringkasan penilaian JAD/BKD. Situs GitHub Pages publik dapat dibaca siapa saja. Pastikan penggunaan dan publikasi datanya sesuai izin yang berlaku sebelum mengunggah repository.

## Pembaruan JAD otomatis dari OneDrive/SharePoint

Paket ini menyertakan workflow harian yang mengambil workbook JAD terbaru, mengganti data JAD di JSON, lalu menerbitkan dashboard dengan GitHub Pages. Data BKD yang sudah ada tetap dipertahankan; workflow ini belum memperbarui BKD.

### Yang perlu disiapkan satu kali

1. Simpan workbook JAD di OneDrive for Business atau SharePoint kampus dan jangan pindahkan file setelah workflow dipasang.
2. Minta bantuan admin TI kampus untuk mendaftarkan aplikasi Microsoft Entra bagi GitHub Actions, menghubungkan identitas GitHub Actions melalui federated credential, dan memberi izin Microsoft Graph baca ke file JAD.
   - Untuk repository `SDM-FTE/dashboard` pada branch `main`, federated credential GitHub memakai issuer `https://token.actions.githubusercontent.com`, audience `api://AzureADTokenExchange`, dan subject `repo:SDM-FTE/dashboard:ref:refs/heads/main`.
   - Jika memungkinkan, minta izin terbatas `Files.SelectedOperations.Selected` dengan peran `read` hanya untuk file JAD.
   - Endpoint download Microsoft Graph mencantumkan `Files.Read.All` sebagai izin aplikasi paling rendah yang didukung secara umum; izin ini dapat membaca seluruh file organisasi, jadi jangan berikan tanpa persetujuan admin TI. Admin dapat menilai izin terpilih atau alternatif kampus.
   - Jangan membuat atau mengirim client secret. Workflow menggunakan federated identity sehingga tidak menyimpan password Microsoft di GitHub.
3. Siapkan nilai **Application (client) ID**, **Directory (tenant) ID**, **Drive ID**, dan **Item ID** untuk workbook JAD. Admin TI dapat membantu mendapatkan ID drive dan item dari Microsoft Graph. Jangan tempel tautan file atau kredensial Microsoft ke chat atau ke berkas repository.
4. Di repository GitHub, buka **Settings → Secrets and variables → Actions → Variables**, lalu buat variabel berikut:

   | Nama variabel | Nilai |
   | --- | --- |
   | `AZURE_CLIENT_ID` | Application (client) ID dari Microsoft Entra |
   | `AZURE_TENANT_ID` | Directory (tenant) ID kampus |
   | `JAD_DRIVE_ID` | Drive ID tempat workbook JAD disimpan |
   | `JAD_ITEM_ID` | Item ID workbook JAD |

5. Unggah isi paket ke tingkat teratas repository, termasuk folder tersembunyi `.github/workflows` dan folder `scripts`. Pastikan halaman GitHub Pages memakai sumber **GitHub Actions**.
6. Buka tab **Actions**, pilih **Refresh JAD data and publish Pages**, lalu tekan **Run workflow** untuk pembaruan pertama. Setelah berhasil, workflow berjalan otomatis setiap hari pukul **08.17 WIB**.

Jika workbook berubah posisi atau namanya diganti, ID item dapat berubah atau workflow tidak menemukan file. Jadwal otomatis dapat terlambat sesekali karena antrean GitHub; gunakan **Run workflow** untuk menjalankannya langsung.

Workflow memperbarui JSON saat proses publish, tetapi tidak membuat commit data otomatis ke repository. Halaman publik tetap menerima data terbaru dari workbook.

### Jika pengaturan Entra kampus tidak tersedia

Minta admin TI memeriksa apakah kampus mengizinkan akses Graph dengan ruang lingkup hanya pada satu file. Jika tidak, pembaruan otomatis dari akun organisasi mungkin memerlukan persetujuan keamanan tambahan atau solusi kampus seperti Power Automate.
