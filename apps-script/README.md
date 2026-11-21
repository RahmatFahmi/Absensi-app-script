# Setup Apps Script - Presensi Sekolah

## Langkah Instalasi & Uji
1. Buka Google Spreadsheet "Presensi Sekolah" > menu **Ekstensi > Apps Script**.
2. Salin seluruh file dari folder `apps-script/`: `appsscript.json`, `Code.gs`, `Auth.gs`, `Master.gs`, `Import.gs`, `Presensi.gs`, `Izin.gs`, `Rekap.gs`, `Setup.gs`, `Tests.gs`, `Index.html`, `Login.html`, `Style.html`, `Script.html`, `DashboardPage.html`, `MasterPage.html`, `JadwalPage.html`, `ImportPage.html`, `PresensiPage.html`, `PengajuanPage.html`, `PersetujuanPage.html`, `RekapPage.html`.
3. Project Settings > **Script Properties**: pastikan `ADMIN_INITIAL_PASSWORD` sudah terisi.
4. Jalankan `setupSheets()`, lalu `seedAdmin()` — hanya bisa dari editor oleh pemilik script (lihat "Pengaman Pemilik" di bawah).
5. Jalankan `testT01()` … `testT10()` di editor; pastikan log menampilkan pesan ... LULUS. `testT05`–`testT10` perlu 1 semester aktif: setelah `testT04()` (yang membersihkan semester ujinya), buat dan aktifkan semester di menu Semester & Jadwal.
6. Jalankan `installTriggers_()` sekali dari editor (idempoten) untuk memasang penolakan otomatis harian.
7. **Hapus file `Tests.gs`** sebelum deploy produksi (hanya berisi uji otomatis). `Setup.gs` tetap disimpan.
8. Deploy Web App (Execute as: `Me / USER_DEPLOYING`, Who has access: `Anyone`).

## Pengaman Pemilik & Fungsi Internal (Audit Fondasi)
- **`Setup.gs`** berisi `setupSheets` dan `seedAdmin`; file ini tetap ada di produksi. **`Tests.gs`** hanya berisi `testT01`–`testT10` dan **DIHAPUS dari proyek yang dideploy**.
- Fungsi setup/uji di `Setup.gs` dan `Tests.gs` diawali `requireEditorOwner_()`: menolak jika email pemanggil aktif ≠ email pemilik script. Asumsi deploy: `executeAs: USER_DEPLOYING` + `access: ANYONE` (lihat `appsscript.json`).
- Semua helper internal berakhiran `_` (mis. `getSpreadsheet_`, `requireRole_`, `appendRow_`, `parseTsv_`). Fungsi berakhiran `_` tidak bisa dipanggil dari klien lewat `google.script.run`.
- Setiap fungsi global tanpa akhiran `_` diawali `requireRole_()` dengan role-nya, kecuali `doGet`, `login`, `logout`, `whoAmI`, dan `changePassword` (alur login/ganti password awal yang disengaja).
- Proteksi formula terpusat: `NON_TEXT_COLUMNS` + `getTextColumnIndexes_`/`applyTextFormats_` memasang format teks `@` pada semua kolom teks sebelum tulis. Kolom tanggal/boolean dikecualikan eksplisit.
- Temuan yang sengaja ditunda dicatat di `docs/DEBT.md` (root repo).

## Langkah Uji Manual Audit Fondasi
1. **Fungsi internal tidak terekspos**: buka web app, di console browser jalankan `google.script.run.getSpreadsheet_()` (atau `requireRole_('x','Admin')`) -> gagal "fungsi tidak ditemukan"/tidak terdefinisi, bukan data sheet.
2. **Pengaman pemilik**: buka web app memakai akun Google lain (atau mode incognito), jalankan `google.script.run.setupSheets()` dari console -> ditolak dengan pesan "hanya boleh dijalankan oleh pemilik script". Jalankan `setupSheets()` dari editor sebagai pemilik -> tetap berhasil.
3. **Formula injection (UI)**: login Admin > Data Master > Kelas/Mapel > tambah data dengan nama `=1+1`. Nilai ditolak dengan pesan "tidak boleh diawali = + - @"; sheet tidak bertambah, dan `testT05()` memeriksa kasus yang sama.
4. **Tidak ada hash/salt ke klien**: di editor panggil `whoAmI(token)` dan `listEntity(token, 'Guru')`; hasilnya tidak boleh memuat `password_hash` atau `salt`.
5. **Wajib ganti password**: login akun baru (guru/siswa hasil import), lalu panggil `listEntity(token, 'Kelas')` sebelum ganti password -> ditolak "Wajib mengganti password...". `whoAmI(token)` dan `changePassword(...)` tetap boleh.
6. **Sesi**: logout -> panggil `whoAmI(tokenLama)` -> "Sesi tidak valid"; biarkan token 6 jam -> kedaluwarsa sendiri.

## Langkah Uji Manual T02
1. **Password Salah**: Masukkan username/password sembarang -> pesan error "Username atau password salah".
2. **Akun Terkunci**: Masukkan password salah 5x berturut-turut -> percobaan ke-6 menampilkan pesan akun terkunci 5 menit.
3. **Wajib Ganti Password**: Login pertama dengan akun `admin` -> modal ganti password wajib muncul dan mengunci layar hingga diganti (minimal 8 karakter).
4. **Menu per Role**: Tambahkan data uji di sheet `Users` untuk Guru dan Siswa; saat login, menu sidebar tampil hanya untuk role terkait (role ditentukan server).
5. **Token Palsu Ditolak**: Pemanggilan `requireRole_('token_palsu', 'Admin')` di Apps Script ditolak ("Sesi tidak valid").
6. **Logout**: Klik tombol Keluar -> sesi terhapus di server dan tampilan kembali ke halaman login.

## Langkah Uji Manual T04 (Semester & Jadwal)
1. **Dua semester & pindah aktif**: menu Admin > Semester & Jadwal > tab Semester > Tambah dua semester (mis. 2026/2027 Ganjil dan 2026/2027 Genap). Klik Aktifkan pada salah satu; pastikan hanya satu yang berstatus Aktif dan yang lain menjadi Tidak aktif. Klik Aktifkan pada semester kedua; status berpindah.
2. **Jadwal bentrok guru**: tab Jadwal Pelajaran > Tambah Jadwal (Senin 07:00-08:00, satu guru/kelas). Tambah lagi Senin 07:30-08:30 dengan guru sama tetapi kelas lain; simpan harus ditolak dengan pesan yang menyebut nama guru dan jam bentrok.
3. **Jadwal bentrok kelas**: tambah Senin 07:30-08:30 dengan kelas sama tetapi guru lain; simpan harus ditolak dengan pesan yang menyebut kelas dan jam bentrok. Jadwal 08:00-09:00 (tepat bersambung) harus diterima.
4. **Hapus kelas yang punya jadwal ditolak**: menu Data Master > Kelas > Hapus kelas yang dipakai jadwal; server menolak dengan pesan "masih digunakan pada data Jadwal".
5. **Role siswa tidak bisa memanggil fungsi jadwal**: login sebagai Siswa lalu panggil `listJadwal(tokenSiswa, {})` dari editor Apps Script (token sesi siswa) -> ditolak "Akses ditolak: role tidak memiliki izin".
6. **Jam tetap teks**: buka sheet `Jadwal`; kolom `jam_mulai`/`jam_selesai` berisi teks "07:00", bukan tanggal.
7. **Semester aktif tidak bisa dihapus**: coba Hapus pada semester berstatus Aktif (tombol nonaktif di UI); pemanggilan `deleteSemester(token, idSemesterAktif)` di editor harus ditolak.

## Tes Fungsi Murni T04 (node, bukan Apps Script)
Jalankan `node apps-script/test/t04-pure.test.js` di komputer. Tes ini hanya menguji logika murni: normalisasi/validasi jam, urutan tahun ajaran, dan deteksi bentrok jadwal (termasuk kasus tepat bersambung, beda hari, dan edit diri sendiri). Tes ini tidak menyentuh Google Sheets.

## Langkah Uji Manual T05 (Import Data Paste)
1. **Urutan ketergantungan**: menu Admin > Import Data Paste. Import Kelas dulu, lalu Mapel, Guru, Siswa, dan terakhir Jadwal. Semester harus sudah dibuat di halaman Semester & Jadwal (satu aktif).
2. **Tempel dari Excel sungguhan**: salin blok data (termasuk header) dari Excel/Sheets untuk tiap jenis data, tempel ke kotak teks, klik Pratinjau. Pastikan tabel menampilkan nomor baris, badge Valid/Error, dan pesan error per baris. Ringkasan harus berbunyi "N valid, M error".
3. **Kolom boleh berbeda urutan**: ubah urutan kolom (mis. `nama` sebelum `nip` untuk Guru). Pratinjau tetap menerima karena header dicocokkan lewat nama.
4. **Header salah**: hapus salah satu header wajib atau tambah kolom tak dikenal; seluruh input ditolak dengan pesan jelas dan tombol simpan tetap nonaktif.
5. **Hanya baris valid tersimpan**: buat satu baris valid dan satu baris error (mis. NIS dobel dalam tempelan atau kelas tidak ada). Tombol "Simpan N baris valid" hanya menyimpan baris valid; pesan hasil menyebut jumlah tersimpan dan ditolak.
6. **Tempel ulang = ditolak "sudah ada"**: ulangi import data yang sama; semua baris menjadi error "sudah ada"/"Jadwal identik sudah ada" sehingga tidak ada duplikat.
7. **NIP 18 digit & NIS berawalan nol**: import Guru dengan NIP 18 digit dan Siswa dengan NIS diawali `0`; buka sheet dan pastikan nilainya persis sama (bukan notasi ilmiah/angka) dan bertipe teks.
8. **Akun hasil import**: login dengan username=NIP (Guru) atau NIS (Siswa), password awal sama dengan NIP/NIS; modal wajib ganti password harus muncul dan tidak bisa ditutup sebelum password diganti.
9. **Siswa tidak boleh import**: login sebagai Siswa, lalu panggil `previewImport(tokenSiswa, 'Kelas', 'nama_kelas\nX')` dan `commitImport(...)` dari editor Apps Script -> ditolak "Akses ditolak: role tidak memiliki izin".
10. **Batas input**: tempel lebih dari 500 baris data atau teks > 200 KB -> ditolak dengan pesan batas, tidak ada baris tersimpan.
11. **Bersihkan data uji**: `testT05()` membuat dan menghapus data berawalan `TEST_` secara otomatis; periksa sheet tidak menyisakan baris `TEST_`.

## Tes Fungsi Murni T05 (node, bukan Apps Script)
Jalankan `node apps-script/test/t05-pure.test.js`. Tes ini menguji parser TSV (BOM, CRLF, baris kosong, sel berkutip berisi newline/kutip ganda, batas 500 baris), normalisasi jam `7:00`/`07.00`, urutan kolom, header salah, duplikat dalam tempelan, NIP/NIS panjang, referensi kelas tidak ada, data "sudah ada", dan bentrok jadwal dalam tempelan. Tes ini tidak menyentuh Google Sheets; uji end-to-end tetap lewat `testT05()` dan langkah manual di atas.

## Langkah Uji Manual T06 (Presensi Guru)
1. **Dua guru login bergantian**: Guru A login dan melihat menu "Jadwal & Presensi" dengan jadwal mengajar kelasnya. Logout, Guru B login dan hanya melihat jadwal mengajar milik Guru B.
2. **Guru A tidak bisa membuka jadwal Guru B**: saat Guru A login, buka DevTools Console dan coba panggil `google.script.run.getFormPresensi(getStoredToken(), 'ID_JADWAL_GURU_B', 'YYYY-MM-DD')` atau `google.script.run.savePresensi(getStoredToken(), 'ID_JADWAL_GURU_B', 'YYYY-MM-DD', [...])` -> server menolak dengan pesan error "Akses ditolak: jadwal ini bukan milik Anda".
3. **Simpan dari ponsel (Touch Target >= 44px)**: buka web app di perangkat ponsel (atau mode responsif mobile browser). Tombol status Hadir/Izin/Sakit/Alpa nyaman ditekan tanpa salah sentuh (tinggi tombol minimal 44px). Klik "Tandai Semua Hadir", ubah satu siswa menjadi Sakit, klik "Simpan Presensi". Tombol nonaktif selama proses simpan dan muncul toast sukses.
4. **Edit presensi kemarin**: pilih tanggal kemarin pada date picker (jadwal berstatus "Sudah diisi"), klik "Edit Presensi". Form memuat data yang tersimpan sebelumnya dengan label "Mode Edit" serta info NIP guru dan waktu terakhir diubah. Ubah keterangan salah satu siswa, klik Simpan Presensi. Periksa sheet `Presensi`: baris diperbarui di tempat tanpa penambahan baris baru ganda.
5. **Dua guru simpan hampir bersamaan**: buka dua browser berbeda (Guru A dan Guru B di kelas masing-masing), tekan Simpan Presensi secara serentak. Berkat `LockService`, kedua presensi tersimpan lengkap tanpa terjadi race condition atau baris yang saling menimpa.
6. **Siswa tidak bisa memanggil fungsi presensi**: login sebagai Siswa, lalu di console browser panggil `google.script.run.getJadwalGuru(getStoredToken(), 'YYYY-MM-DD')` -> ditolak "Akses ditolak: role tidak memiliki izin".

## Tes Fungsi Murni T06 (node, bukan Apps Script)
Jalankan `node apps-script/test/t06-pure.test.js`. Tes ini menguji:
- Penolakan tanggal masa depan (`tanggal > today`).
- Penerimaan tanggal hari ini dan masa lampau.
- Format tanggal tidak valid / bukan kalender valid.
- Ketidakcocokan hari tanggal dengan jadwal ditolak.
- Integritas daftar siswa: siswa kurang, siswa lebih, atau NIS duplikat ditolak "Daftar siswa berubah, muat ulang halaman".
- Validasi status (Hadir, Izin, Sakit, Alpa) dan panjang maksimal keterangan (200 karakter).
- Pembentukan baris upsert batch (membedakan insert baris baru vs update baris lama tanpa appendRow berulang).

## Langkah Uji Manual T07 (Pengajuan Siswa & Bukti)
1. **Window 15 Menit (Uji Waktu Riil)**: Edit salah satu jadwal di sheet `Jadwal` agar `jam_mulai` berada tepat pada waktu sekarang (misal sekarang 07:35, set `jam_mulai` menjadi 07:30). Buka portal Siswa > menu "Ajukan Izin/Sakit". Jadwal tersebut berlabel "Window Buka" dan tombol "Pilih & Ajukan" aktif. Coba ubah `jam_mulai` menjadi 07:10 (lebih dari 15 menit lalu); jadwal berubah menjadi "Window Tutup" dan tombol pengajuan nonaktif (jika dipaksa lewat console, server menolak: "Batas waktu pengajuan telah berakhir").
2. **Isolasi Privasi Antar Siswa**: Login sebagai Siswa A. Buka DevTools Console, jalankan `google.script.run.withSuccessHandler(console.log).getPengajuanSaya(getStoredToken())` -> hanya riwayat pengajuan milik Siswa A yang kembali. Coba panggil `google.script.run.unggahBukti(getStoredToken(), 'ID_IZIN_MILIK_SISWA_B', {base64: '...'})` -> server menolak: "Anda tidak memiliki akses ke pengajuan ini".
3. **Berkas Drive Privat**: Setelah Siswa A mengunggah surat izin/sakit, periksa link bukti di sheet `Izin`. Salin link URL Google Drive tersebut, lalu buka di browser menggunakan akun Google lain yang bukan pemilik Drive. Google Drive menampilkan halaman minta akses/ditolak (berkas tidak publik). File hanya dibaca oleh Guru melalui server Apps Script pada T08.
4. **Unggah dari Ponsel**: Buka web app dari browser ponsel (mis. Chrome Android atau Safari iOS). Login sebagai Siswa, pilih jadwal yang buka, pilih jenis Sakit, dan klik Kirim Pengajuan. Buka tab "Pengajuan Saya", klik tombol "Unggah Surat Dokter", ambil foto langsung menggunakan kamera ponsel (ukuran foto asli 4-8 MB). Skrip klien otomatis mengoptimalkan dan mengompres foto lewat canvas sebelum dikirim; berkas berhasil tersimpan tanpa error kuota/ukuran.

## Tes Fungsi Murni T07 (node, bukan Apps Script)
Jalankan `node apps-script/test/t07-pure.test.js`. Tes ini menguji:
- Batas window 15 menit (jam_mulai 07:00: 06:59 ditolak, 07:00 dan 07:15 diterima, 07:16 ditolak).
- Deteksi magic bytes: PDF (%PDF), JPEG (FF D8 FF), PNG (89 50 4E 47), serta kompatibilitas signed bytes dari `Utilities.base64Decode`.
- Penolakan file yang di-rename (mis. EXE di-rename menjadi .pdf atau teks biasa di-rename menjadi .jpg).
- Batas ukuran berkas 2 MB (2.097.152 bytes diterima, 2.097.153 bytes ditolak).
- Penamaan aman berkas `{id_izin}_{nis}.{ext}` dan pencegahan directory traversal.
- Pembersihan data URI base64 prefix sebelum decoding.
- Urutan riwayat pengajuan terbaru lebih dulu saat `diajukan_pada` berupa Date.

## Langkah Uji Manual T08 (Persetujuan Guru & Penolakan Otomatis)
1. **Daftar per guru**: login Guru A > menu "Persetujuan Izin". Hanya pengajuan pada jadwal Guru A di semester aktif yang tampil. Login Guru B: pengajuan milik jadwal Guru A tidak terlihat.
2. **Filter status**: ganti pilihan status (Menunggu bukti / Menunggu persetujuan / Disetujui / Ditolak / Semua). Daftar langsung tersaring tanpa memuat ulang halaman.
3. **Pratinjau bukti**: klik "Lihat Bukti & Proses" pada pengajuan yang punya bukti. Gambar tampil langsung; PDF tampil di panel pratinjau. Buka DevTools Console dan panggil `google.script.run.withSuccessHandler(console.log).getPengajuanGuru(getStoredToken())` -> tidak ada properti `link_bukti` pada data yang dikirim (hanya `ada_bukti`).
4. **Setuju mengubah presensi**: isi presensi kelas lebih dulu (menu Jadwal & Presensi), lalu setujui pengajuan siswa. Buka sheet `Presensi`: baris siswa pada jadwal+tanggal itu berubah menjadi Sakit/Izin tanpa baris baru.
5. **Presensi belum diisi tidak dibuatkan baris**: setujui pengajuan untuk jadwal+tanggal yang belum pernah diisi. Sheet `Presensi` tidak bertambah; buka form presensi jadwal tersebut, siswa tampil dengan status default Sakit/Izin (dari pengajuan Disetujui).
6. **Ubah keputusan**: pada pengajuan Disetujui, klik Tolak dan isi catatan -> status presensi siswa kembali Alpa dan catatan tersimpan. Setujui lagi pengajuan yang Ditolak -> status presensi kembali Sakit/Izin.
7. **Guru lain ditolak**: dengan token sesi Guru B, panggil `prosesPengajuan(tokenGuruB, 'ID_IZIN_MILIK_GURU_A', 'Disetujui', '')` dari editor/console -> ditolak "Akses ditolak: pengajuan ini bukan untuk jadwal Anda".
8. **Penolakan otomatis**: ubah satu baris `Izin` Sakit berstatus "Menunggu bukti" agar `tanggal` berjarak 4 hari ke belakang, lalu jalankan `tolakPengajuanKedaluwarsa_()` dari editor -> baris itu menjadi `Ditolak`, `diproses_oleh` = `SISTEM`, catatan "Ditolak otomatis: bukti tidak diunggah". Pengajuan "Menunggu bukti" hari ini tidak ikut ditolak.
9. **Trigger idempoten**: jalankan `installTriggers_()` dua kali, lalu buka Project Settings > Triggers. Hanya ada satu trigger `tolakPengajuanKedaluwarsa_` (harian, 01:00 zona waktu aplikasi).
10. **Tanggal Izin sebagai teks**: baris baru sheet `Izin` menyimpan `tanggal` sebagai teks `yyyy-MM-dd` (bukan objek tanggal). Baris lama bertipe Date tetap terbaca oleh halaman dan trigger.

Catatan: `testT08()` membatasi penolakan otomatis ke `id_izin` uji (`TEST_*`) sehingga pengajuan nyata tidak tersentuh. Trigger produksi tetap memanggil fungsi tanpa parameter (semua baris).

## Tes Fungsi Murni T08 (node, bukan Apps Script)
Jalankan `node apps-script/test/t08-pure.test.js`. Tes ini menguji:
- Batas unggah bukti: hari ke-3 setelah pengajuan masih diterima, hari ke-4 ditolak, pergantian bulan, sel tanggal lama bertipe Date, dan tanggal tidak valid tidak pernah ditolak.
- Transisi presensi: Menunggu/Ditolak -> Disetujui menulis status, Disetujui -> Ditolak mengembalikan ke Alpa, keputusan sama tidak mengubah apa pun.
- `unggahBukti` menulis `link_bukti` + `status` dalam satu `setValues` 1x2 (bukan dua panggilan tulis).

## Langkah Uji Manual T09 (Rekap & Ekspor Excel)
1. **Rekap Siswa hanya dirinya**: login Siswa A > menu "Rekap Kehadiran". Tabel berisi satu baris per mapel dengan kolom Hadir/Izin/Sakit/Alpa/Total/% Hadir. Dari DevTools Console panggil `google.script.run.getRekapSiswa(getStoredToken(), { nis: 'NIS_SISWA_LAIN' })` -> hasil tetap hanya data Siswa A (NIS dari sesi).
2. **Isolasi Guru**: login Guru A, pilih semester dan rentang tanggal. Hanya kelas+mapel pada jadwal Guru A yang muncul. Panggil `google.script.run.getRekapGuru(getStoredToken(), { nip_guru: 'NIP_GURU_LAIN' })` -> filter NIP dari klien diabaikan.
3. **Rekap Admin + filter**: login Admin, coba kombinasi semester/kelas/mapel/tanggal. Angka H/I/S/A harus sama dengan hitungan manual sheet `Presensi` untuk jadwal yang cocok; jadwal yang belum pernah diisi tidak dihitung sebagai Alpa.
4. **Tanggal inklusif & total 0**: isi presensi pada tanggal 10 dan 11. Filter dari=sampai=10 -> hanya tanggal 10 terhitung. Filter tanggal tanpa presensi -> ringkasan 0 dan % Hadir menampilkan "-".
5. **Ekspor Excel**: sebagai Guru/Admin klik "Ekspor Excel". Berkas `Rekap_Presensi_*.xlsx` terunduh dan dapat dibuka di Excel/LibreOffice; isinya sama dengan tabel. Buka Google Drive > Trash: spreadsheet sementara sudah dihapus (tidak ada sisa file).
6. **Formula injection**: coba ubah nama kelas/mapel menjadi `=1+1` (Data Master). Nilai ditolak ("tidak boleh diawali = + - @"), jadi ekspor tidak pernah menerima sel berisi rumus.
7. **Role ditolak di server**: login Siswa, panggil `google.script.run.exportRekapExcel(getStoredToken(), {})` dan `getRekapAdmin(...)` -> "Akses ditolak: role tidak memiliki izin".
8. **Bersih-bersih**: `testT09()` tidak menulis/menghapus data sheet; hanya membaca.

## Tes Fungsi Murni T09 (node, bukan Apps Script)
Jalankan `node apps-script/test/t09-pure.test.js`. Tes ini menguji:
- Persen hadir satu desimal, total 0 menjadi "-".
- Agregasi H/I/S/A + total per kelas+mapel, hanya pertemuan tercatat.
- Filter semester, filter tanggal inklusif, dan tanpa baris total 0.
- Isolasi guru (nip_guru) dan siswa (NIS, dikelompokkan per mapel).
- Validasi filter tanggal `yyyy-MM-dd` dan rentang tidak terbalik.
- Nama file ekspor aman (tanpa path/karakter berbahaya) dan sanitasi formula injection sel Excel.

## Langkah Uji Manual T10 (Dashboard per Role)
1. **Admin**: login Admin > dashboard menampilkan total siswa, guru, kelas, dan angka Hadir/Izin/Sakit/Alpa hari ini. Angka harus sama dengan rekap hari ini di menu "Rekap Kehadiran".
2. **Guru**: login Guru > dashboard menampilkan sesi jadwal hari ini (badge Sudah/Belum diisi), jumlah presensi belum diisi, dan jumlah pengajuan "Menunggu persetujuan". Tombol "Jadwal & Presensi" dan "Cek Izin Siswa" membuka halaman terkait.
3. **Siswa**: login Siswa > dashboard menampilkan % hadir semester aktif, rincian Izin/Sakit/Alpa, dan status pengajuan terakhir. Tombol riwayat membuka "Pengajuan Saya".
4. **Tanpa semester aktif**: ubah semua Semester menjadi "Tidak aktif" dari menu Semester & Jadwal. Ketiga dashboard menampilkan pesan empty state (bukan error). Aktifkan kembali satu semester.
5. **Satu panggilan server**: di kode `DashboardPage.html`, tiap `muatDashboard*` hanya memanggil satu fungsi `google.script.run` (`getDashboardAdmin`/`getDashboardGuru`/`getDashboardSiswa`).
6. **Role ditolak di server**: login Guru, jalankan `google.script.run.getDashboardAdmin(getStoredToken())` di console -> "Akses ditolak: role tidak memiliki izin". Login Siswa, panggil `getDashboardGuru(...)` -> ditolak.
7. **Bersih-bersih**: `testT10()` hanya membaca sheet; tidak menulis atau menghapus data.

## Tes Fungsi Murni T10 (node, bukan Apps Script)
Jalankan `node apps-script/test/t10-pure.test.js`. Tes ini menguji:
- Hitung Hadir/Izin/Sakit/Alpa untuk satu tanggal dan jadwal semester aktif; status asing/tanggal lain diabaikan.
- Kasus kosong: semua nol dan persen "-".
- Ringkasan rekap menjumlah H/I/S/A/total dan menghitung persen.
- Jumlah pengajuan "Menunggu persetujuan" hanya untuk jadwal guru.
- Pengajuan terakhir siswa berdasarkan `diajukan_pada`, tanpa data mengembalikan null.



