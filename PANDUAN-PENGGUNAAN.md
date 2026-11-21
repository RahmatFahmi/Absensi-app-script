# Panduan Penggunaan Aplikasi Presensi Sekolah

Panduan ini menjelaskan pemakaian aplikasi dari awal sampai akhir untuk setiap role:
**Admin**, **Guru**, dan **Siswa**.

Aplikasi berjalan sebagai Google Apps Script Web App di atas Google Sheets, jadi semua
pengguna cukup membuka satu tautan di browser (laptop maupun ponsel). Tidak ada instalasi
aplikasi.

---

## 1. Gambaran Singkat

| Role | Login dengan | Tugas utama |
|---|---|---|
| **Admin** | `admin` | Menyiapkan semester, data master, jadwal, impor data, memantau rekap |
| **Guru** | NIP | Mengisi presensi kelas yang diajar, menyetujui izin/sakit siswa, melihat rekap |
| **Siswa** | NIS | Mengajukan izin/sakit, mengunggah bukti, melihat rekap kehadiran sendiri |

Role **tidak pernah dipilih** saat login. Server membacanya dari sheet `Users`, sehingga
satu akun hanya bisa membuka menu sesuai role-nya.

### Menu yang terlihat per role

| Menu | Admin | Guru | Siswa |
|---|:--:|:--:|:--:|
| Dashboard Admin | ✔ | – | – |
| Data Master | ✔ | – | – |
| Semester & Jadwal | ✔ | – | – |
| Import Data Paste | ✔ | – | – |
| Dashboard Guru | – | ✔ | – |
| Jadwal & Presensi | – | ✔ | – |
| Persetujuan Izin | – | ✔ | – |
| Dashboard Siswa | – | – | ✔ |
| Ajukan Izin/Sakit | – | – | ✔ |
| Pengajuan Saya | – | – | ✔ |
| Rekap Kehadiran | ✔ | ✔ | ✔ (hanya dirinya) |

Menu **Rekap Kehadiran** ada untuk semua role, tetapi isinya menyesuaikan role dan
dihitung di server.

---

## 2. Persiapan Awal (dilakukan sekali oleh Admin/Pemilik Sekolah)

Bagian ini hanya untuk orang yang memasang aplikasi. Pengguna biasa boleh langsung ke
bagian 3.

1. Buat Google Spreadsheet baru, misalnya bernama **Presensi Sekolah**.
2. Buka **Ekstensi > Apps Script**.
3. Salin seluruh file dari folder `apps-script/` ke proyek Apps Script (termasuk
   `appsscript.json`). Daftar lengkap ada di `apps-script/README.md`.
4. Buka **Project Settings > Script Properties**, lalu isi:
   - `ADMIN_INITIAL_PASSWORD` — **wajib**, password awal akun `admin`.
   - `BUKTI_FOLDER_ID` — opsional, folder Drive untuk bukti izin. Dibuat otomatis bila kosong.
   - `SPREADSHEET_ID` — opsional, hanya jika script tidak dibuka dari spreadsheet.
5. Di editor Apps Script, jalankan `setupSheets()` lalu `seedAdmin()` (izinkan akses saat diminta).
6. Jalankan `installTriggers_()` sekali untuk memasang penolakan otomatis pengajuan kedaluwarsa
   (berjalan setiap hari pukul 01.00 waktu aplikasi).
7. **Deploy > New deployment > Web app** dengan pengaturan:
   - Execute as: `Me (USER_DEPLOYING)`
   - Who has access: `Anyone`
8. Salin URL Web App dan bagikan ke guru serta siswa.
9. Hapus file `Tests.gs` dari proyek produksi, lalu deploy versi baru
   (`Setup.gs` tetap disimpan).

Setelah langkah ini, aplikasi siap dipakai. Lanjutkan ke bagian 3 untuk login pertama.

---

## 3. Login, Ganti Password, dan Keluar (semua role)

### 3.1 Login

1. Buka URL Web App.
2. Isi **Username (NIP / NIS)** dan **Password**.
3. Klik **Masuk ke Aplikasi**.

| Role | Username | Password awal |
|---|---|---|
| Admin | `admin` | nilai `ADMIN_INITIAL_PASSWORD` |
| Guru | NIP | sama dengan NIP |
| Siswa | NIS | sama dengan NIS |

Tidak ada pilihan role di halaman login. Jika username/password salah, muncul pesan
*"Username atau password salah"*.

### 3.2 Ganti password

- **Login pertama** (akun baru, hasil impor, atau setelah di-reset Admin): modal
  **Ganti Password** muncul dan mengunci layar. Password baru minimal **8 karakter**,
  tidak boleh sama dengan username/NIS/NIP, dan tidak boleh sama dengan password lama.
  Tombol **Batal & Keluar** akan mengeluarkan Anda dari aplikasi.
- **Kapan saja**: klik tombol **Password** di kanan atas.

### 3.3 Keamanan akun

- Salah password **5 kali** berturut-turut → akun terkunci **5 menit**.
- Sesi login berlaku **6 jam**. Setelah habis, Anda diminta login ulang.
- Selalu klik **Keluar** bila memakai komputer bersama. Logout menghapus sesi di server.

---

## 4. Panduan Admin (dari nol sampai aplikasi siap dipakai)

Urutan kerja yang disarankan pada awal tahun ajaran:

1. Aktifkan **semester**.
2. Isi **data master** (Kelas, Mapel, Guru, Siswa) — manual atau lewat Import.
3. Susun **jadwal pelajaran**.
4. Bagikan akun ke guru dan siswa (username = NIP/NIS, password awal = NIP/NIS).
5. Pantau **Dashboard Admin** dan **Rekap Kehadiran**.

### 4.1 Dashboard Admin

Menampilkan:

- Badge semester aktif.
- **Total Siswa**, **Total Guru**, **Total Kelas**.
- **Kehadiran Hari Ini** (persentase dari presensi yang sudah diisi hari ini).
- Ringkasan **Hadir / Izin / Sakit / Alpa** hari ini.
- Tombol **Lihat Rekap** menuju halaman Rekap Kehadiran.

Jika belum ada semester aktif, dashboard menampilkan pesan agar semester diaktifkan lebih dulu.

### 4.2 Data Master

Menu **Data Master** punya empat tab: **Siswa**, **Guru**, **Kelas**, **Mapel**.

- Gunakan kotak **Cari** untuk mencari berdasarkan NIS/NIP/ID/Nama.
- Pada tab **Siswa** tersedia filter **Kelas**.
- Tombol **Tambah ...** membuka formulir, tombol **Edit** / **Hapus** ada di setiap baris.
- Tombol **Reset** (khusus Siswa & Guru) mengembalikan password akun menjadi NIS/NIP dan
  mewajibkan ganti password saat login berikutnya.

Isi formulir:

| Entitas | Kolom |
|---|---|
| Siswa | NIS, Nama Lengkap, Kelas, Kartu Kontrol (Ya/Tidak), Akun Login Aktif (muncul saat edit) |
| Guru | NIP, Nama Lengkap (dengan gelar) |
| Kelas | ID/Kode Kelas (mis. `X-MIPA-1`), Nama Kelas |
| Mapel | ID/Kode Mapel (mis. `MAT-10`), Nama Mata Pelajaran |

Catatan penting:

- Menambah/mengimpor **Siswa** atau **Guru** otomatis membuat akun login dengan
  username = NIS/NIP dan password awal = NIS/NIP (wajib diganti saat login pertama).
- **Kartu Kontrol**: centang untuk siswa yang memegang kartu kontrol. Siswa ini boleh
  langsung melampirkan surat dokter saat mengajukan Sakit (siswa lain menyusulkan bukti).
- Uncheck **Akun Login Aktif** untuk menonaktifkan login seseorang tanpa menghapus datanya.
- Data yang masih dipakai di sheet lain tidak bisa dihapus. Contoh: kelas yang masih dipakai
  jadwal atau siswa akan ditolak dengan pesan *"masih digunakan pada data ..."*.
- Nama yang diawali `=`, `+`, `-`, atau `@` ditolak (pencegahan formula di spreadsheet).

### 4.3 Semester & Jadwal

Halaman ini punya dua tab.

**Tab Semester**

1. Klik **Tambah Semester**.
2. Isi **Tahun Ajaran** dengan format `2026/2027` dan pilih **Ganjil** atau **Genap**.
3. Simpan. Semester baru berstatus *Tidak aktif*.
4. Klik **Aktifkan** pada semester yang sedang berjalan.

Aturan:

- Hanya **satu** semester berstatus *Aktif*. Mengaktifkan semester lain otomatis
  menonaktifkan yang lama.
- Semester aktif **tidak bisa dihapus** (tombol Hapus nonaktif).
- Data semester lama bersifat baca-saja: presensi baru hanya bisa diisi di semester aktif,
  tetapi rekap semester lama tetap bisa dilihat.

**Tab Jadwal Pelajaran**

1. Gunakan filter **Semester / Kelas / Guru** untuk menyaring daftar.
2. Klik **Tambah Jadwal**, lalu isi: Semester, Kelas, Mata Pelajaran, Guru Pengajar,
   Hari (Senin–Sabtu), Jam Mulai, Jam Selesai (format `07:00`).
3. Simpan. Gunakan **Edit** / **Hapus** pada baris jadwal bila perlu.

Validasi otomatis:

- Jam selesai harus setelah jam mulai.
- Guru yang sama tidak boleh punya dua jadwal yang jamnya beririsan pada hari yang sama.
- Kelas yang sama juga tidak boleh punya dua jadwal beririsan pada hari yang sama.
- Jadwal yang tepat bersambung (mis. 07:00–08:00 lalu 08:00–09:00) diperbolehkan.

### 4.4 Import Data Paste

Cara tercepat mengisi data dalam jumlah banyak. Data ditempel langsung dari Excel/Sheets.

1. Buka **Import Data Paste**.
2. Pilih **Jenis Data**: Kelas, Mapel, Guru, Siswa, atau Jadwal.
3. Klik **Salin Template** untuk mendapatkan contoh header + satu baris contoh.
4. Tempel data **beserta baris header** ke kotak teks.
5. Klik **Pratinjau**. Setiap baris diberi tanda *Valid* atau *Error* beserta alasannya.
6. Klik **Simpan N baris valid**. Hanya baris valid yang disimpan; baris error dilewati.

Urutan impor wajib mengikuti ketergantungan data:

**Kelas → Mapel → Guru → Siswa → Jadwal**

Jadwal juga membutuhkan semester yang sudah dibuat (salah satunya aktif), serta kelas,
mapel, dan guru yang sudah ada.

Format header per jenis data:

| Jenis | Header wajib |
|---|---|
| Kelas | `nama_kelas` |
| Mapel | `nama_mapel` |
| Guru | `nip`, `nama` |
| Siswa | `nis`, `nama`, `nama_kelas`, `kartu_kontrol` |
| Jadwal | `tahun_ajaran`, `semester`, `nama_kelas`, `nama_mapel`, `nip_guru`, `hari`, `jam_mulai`, `jam_selesai` |

Ketentuan:

- Urutan kolom bebas, yang penting **nama header sama**.
- Nama header salah atau kolom wajib hilang → seluruh tempelan ditolak, tombol simpan tetap nonaktif.
- Maksimal **500 baris** dan **200 KB** teks per impor.
- Data yang sudah ada (duplikat) ditolak dengan pesan *"sudah ada"*, sehingga aman
  menempel ulang tanpa membuat data ganda.
- NIS/NIP disimpan sebagai teks, jadi NIP 18 digit dan NIS berawalan nol tetap utuh.
- Guru dan Siswa hasil impor otomatis mendapat akun login (username & password awal = NIP/NIS).

### 4.5 Rekap Kehadiran (Admin)

1. Pilih **Semester** (default: semester aktif).
2. Opsional: pilih **Kelas**, **Mata Pelajaran**, **Dari Tanggal**, **Sampai Tanggal**.
3. Klik **Tampilkan Rekap**.

Hasil berisi ringkasan Hadir/Izin/Sakit/Alpa/% Hadir dan tabel per **Kelas + Mata Pelajaran**.

- Persentase = Hadir / (Hadir + Izin + Sakit + Alpa). Jika belum ada data, tampil `-`.
- Hanya pertemuan yang sudah dicatat yang dihitung; jadwal yang belum pernah diisi
  tidak otomatis dianggap Alpa.
- Klik **Ekspor Excel** untuk mengunduh berkas `Rekap_Presensi_*.xlsx` berisi data yang sama.

### 4.6 Checklist Admin awal tahun

- [ ] Semester baru dibuat dan diaktifkan.
- [ ] Kelas, Mapel, Guru, dan Siswa sudah terisi.
- [ ] Jadwal pelajaran lengkap dan tidak bentrok.
- [ ] Akun guru/siswa sudah dicoba login (password awal = NIP/NIS).
- [ ] Dashboard Admin menampilkan angka yang masuk akal.

---

## 5. Panduan Guru

### 5.1 Dashboard Guru

Menampilkan:

- **Jadwal Hari Ini** — jumlah sesi mengajar hari ini.
- **Presensi Belum Diisi** — sesi yang masih menunggu.
- **Pengajuan Menunggu** — pengajuan izin/sakit yang perlu keputusan Anda.
- **Agenda Mengajar Hari Ini** — kartu tiap sesi dengan badge *Sudah diisi* / *Belum diisi*.
- Tombol **Jadwal & Presensi** dan **Cek Izin Siswa**.

### 5.2 Mengisi presensi

1. Buka menu **Jadwal & Presensi**.
2. Pilih **Tanggal** di kanan atas (default hari ini).
   - Tanggal masa depan tidak bisa dipilih.
   - Tanggal lampau boleh diisi/diperbaiki, selama masih semester aktif.
3. Cari kartu jadwal Anda, lalu klik **Isi Presensi** (atau **Edit Presensi** bila sudah ada).
4. Di form presensi:
   - Klik **Tandai Semua Hadir** untuk menandai semua siswa Hadir sekaligus.
   - Ubah status per siswa: **Hadir / Izin / Sakit / Alpa**.
   - Isi **Keterangan** bila perlu (opsional, maksimal 200 karakter).
   - Siswa yang sedang mengajukan izin/sakit diberi penanda khusus di samping namanya.
   - Angka ringkasan Hadir/Izin/Sakit/Alpa diperbarui otomatis.
5. Klik **Simpan Presensi**.

Catatan:

- Satu jadwal + satu tanggal hanya punya satu set presensi. Membuka ulang akan masuk
  **Mode Edit** dan memperbarui baris yang sama (tidak membuat data ganda).
- Jika ada yang mengubah presensi, form menampilkan info perubahan terakhir.
- Anda hanya bisa membuka presensi jadwal milik Anda sendiri; server menolak jadwal guru lain.
- Presensi bisa diisi dari ponsel; tombol status berukuran cukup besar untuk disentuh.

### 5.3 Menyetujui izin/sakit siswa

1. Buka menu **Persetujuan Izin**.
2. Gunakan filter **Status**: Semua status, Menunggu bukti, Menunggu persetujuan,
   Disetujui, atau Ditolak.
3. Klik **Lihat Bukti & Proses** pada pengajuan yang ingin ditinjau.
4. Periksa **Bukti Pendukung** (gambar tampil langsung, PDF tampil di panel pratinjau).
5. Isi **Catatan Guru** bila perlu (opsional, maksimal 300 karakter).
6. Klik **Setujui** atau **Tolak**.

Yang perlu diketahui:

- Hanya pengajuan pada **jadwal yang Anda ajar** di semester aktif yang muncul.
- Persetujuan **mengubah status presensi siswa** (menjadi Sakit/Izin) bila presensi kelas
  pada jadwal+tanggal itu sudah diisi.
- Bila presensi belum diisi, tidak ada baris baru yang dibuat. Saat Anda membuka form
  presensi jadwal tersebut, siswa sudah tampil dengan status dari pengajuan yang disetujui.
- Keputusan bisa diubah: menolak pengajuan yang sudah disetujui mengembalikan status
  presensi siswa menjadi **Alpa**.
- Pengajuan **Sakit** tanpa bukti otomatis ditolak sistem setelah melewati batas unggah.

### 5.4 Rekap Kehadiran (Guru)

1. Buka **Rekap Kehadiran**.
2. Pilih semester dan rentang tanggal (opsional: kelas/mapel).
3. Klik **Tampilkan Rekap**.

Anda hanya melihat kelas dan mapel yang Anda ajar. Klik **Ekspor Excel** untuk mengunduh
rekap dalam format `.xlsx`.

---

## 6. Panduan Siswa

### 6.1 Dashboard Siswa

Menampilkan:

- **Kehadiran Semester Ini** — persentase dan jumlah pertemuan hadir.
- Jumlah **Izin**, **Sakit**, dan **Alpa**.
- **Status Pengajuan Terakhir** beserta tombol ke riwayat lengkap.
- Tombol **Ajukan Sakit / Izin**.

### 6.2 Mengajukan izin atau sakit

Pengajuan hanya bisa dilakukan untuk **jadwal hari ini** dan hanya dalam
**15 menit pertama** sejak jam mulai pelajaran.

1. Buka **Ajukan Izin/Sakit**.
2. Di daftar **Jadwal Kelas Hari Ini**, pilih jadwal yang berlabel **Window Buka**.
   - Jadwal di luar 15 menit pertama berlabel **Window Tutup** dan tombolnya nonaktif.
   - Batas waktu tiap jadwal ditampilkan (mis. `Batas: 07:30 - 07:45`).
3. Pilih **Jenis Pengajuan**: **Sakit** atau **Izin**.
4. Isi **Alasan Pengajuan** (wajib, maksimal 300 karakter).
5. Unggah **berkas bukti**:
   - **Izin**: surat orang tua **wajib** diunggah saat mengajukan.
   - **Sakit**: boleh menyusul (status awal menjadi *Menunggu bukti*). Khusus pemegang
     **kartu kontrol**, surat dokter boleh langsung dilampirkan sehingga statusnya
     langsung *Menunggu persetujuan*.
   - Format: **PDF / JPG / PNG**, maksimal **2 MB**. Foto dari kamera ponsel otomatis
     dikompres sebelum dikirim.
6. Klik **Kirim Pengajuan**.

Satu jadwal hanya boleh punya satu pengajuan aktif. Pengajuan yang sudah **Ditolak**
boleh diajukan ulang.

### 6.3 Pengajuan Saya

Tab ini menampilkan **30 pengajuan terakhir** beserta statusnya.

- Jika pengajuan **Sakit** berstatus *Menunggu bukti*, tombol **Unggah Surat Dokter** muncul.
- Batas unggah bukti susulan: **3 hari kalender** setelah tanggal pengajuan.
- Lewat batas tersebut, sistem otomatis mengubah status menjadi **Ditolak** dengan catatan
  *"Ditolak otomatis: bukti tidak diunggah"*.
- Klik **Muat Ulang** untuk memperbarui daftar.

### 6.4 Rekap Kehadiran (Siswa)

Buka **Rekap Kehadiran**. Tabel menampilkan kehadiran Anda **per mata pelajaran**:
Hadir, Izin, Sakit, Alpa, Total, dan % Hadir. Anda hanya bisa melihat data milik sendiri;
tombol Ekspor Excel tidak tersedia untuk siswa.

---

## 7. Alur Status Pengajuan Izin/Sakit

```
SISWA mengajukan (maks. 15 menit setelah jam mulai)
        │
        ├── Jenis IZIN  (surat orang tua wajib) ──► Menunggu persetujuan
        │                                                  │
        └── Jenis SAKIT (bukti boleh menyusul) ──► Menunggu bukti
                                                           │
                             unggah bukti ≤ 3 hari ────────┤
                                                           ▼
                                                Menunggu persetujuan
                                                           │
                                    ┌──────────────────────┴──────────────┐
                                    ▼                                     ▼
                              GURU SETUJUI                          GURU TOLAK
                              (presensi jadi                        (presensi tetap/
                               Sakit/Izin)                           kembali Alpa)
```

Tanpa bukti sampai batas 3 hari, sistem otomatis menolak pengajuan Sakit
(trigger harian pukul 01.00).

Khusus **pemegang kartu kontrol**, bukti Sakit boleh langsung dilampirkan saat
mengajukan; pengajuan langsung masuk *Menunggu persetujuan* tanpa melewati *Menunggu bukti*.

| Status | Arti |
|---|---|
| Menunggu bukti | Pengajuan Sakit sudah masuk, bukti belum diunggah |
| Menunggu persetujuan | Bukti lengkap, menunggu keputusan guru mapel |
| Disetujui | Diterima; presensi siswa menjadi Sakit/Izin |
| Ditolak | Ditolak guru atau otomatis oleh sistem karena bukti kedaluwarsa |

---

## 8. Aturan Penting (ringkasan)

1. Presensi diisi **per mata pelajaran** oleh guru pengajar jadwal tersebut.
2. Tanggal masa depan tidak bisa diisi; tanggal lampau boleh, hanya di semester aktif.
3. Satu jadwal + tanggal hanya punya satu set presensi (buka ulang = mode edit).
4. Pengajuan izin/sakit hanya dalam 15 menit pertama sejak `jam_mulai`.
5. Bukti: PDF/JPG/PNG, maksimal 2 MB. Izin wajib saat mengajukan; Sakit menyusul maksimal 3 hari
   (pemegang kartu kontrol boleh langsung melampirkan).
6. Persetujuan hanya oleh guru mapel terkait dan hanya berlaku pada semester aktif.
7. Hanya satu semester aktif; data semester lama baca-saja.
8. Role ditentukan server dari sheet `Users`; tidak ada pemilihan role di aplikasi.
9. Semua password disimpan dalam bentuk hash + salt, tidak pernah ditampilkan.

---

## 9. Masalah Umum dan Solusinya

| Pesan / kondisi | Penyebab | Solusi |
|---|---|---|
| *Username atau password salah* | Username/password keliru | Periksa NIP/NIS. Admin dapat mereset password lewat Data Master > **Reset** |
| *Terlalu banyak percobaan gagal. Akun dikunci sementara selama 5 menit.* | 5x salah password | Tunggu 5 menit lalu coba lagi |
| Modal **Ganti Password** tidak bisa ditutup | Login pertama / setelah reset | Ganti password (min. 8 karakter), atau klik **Batal & Keluar** |
| *Sesi tidak valid atau telah berakhir* | Sesi 6 jam habis / logout | Login ulang |
| *Wajib mengganti password...* | Akun belum mengganti password awal | Selesaikan modal Ganti Password |
| *Tanggal masa depan tidak diizinkan* | Memilih tanggal setelah hari ini | Pilih hari ini atau tanggal lampau |
| *Batas waktu pengajuan telah berakhir...* | Lewat 15 menit sejak jam mulai | Pengajuan tidak bisa dilakukan; hubungi guru mapel |
| *Ukuran berkas melebihi batas maksimal 2 MB.* | Bukti terlalu besar | Kompres/foto ulang, atau unggah PDF lebih kecil |
| *Jadwal ... bentrok ...* | Guru/kelas punya jadwal beririsan | Ubah jam atau pilih guru/kelas lain |
| *Tidak dapat menghapus ... masih digunakan pada data ...* | Data masih terhubung | Hapus/ubah data turunannya lebih dulu |
| Dashboard kosong / *belum ada semester aktif* | Belum ada semester berstatus Aktif | Admin: Semester & Jadwal > **Aktifkan** |
| Siswa tidak melihat jadwal hari ini | Tidak ada jadwal kelasnya hari itu, atau bukan semester aktif | Cek jadwal dan semester aktif |
| Menu tidak sesuai harapan | Role akun berbeda | Hubungi Admin; role tidak bisa diubah dari sisi pengguna |
| Import menolak semua baris | Header salah/hilang, atau melebihi 500 baris/200 KB | Pakai **Salin Template**, periksa nama header, pecah data |

---

## 10. Catatan Tambahan

- Notifikasi (email/WhatsApp) belum tersedia; status dipantau lewat halaman masing-masing.
- Akses **edit** ke spreadsheet sebaiknya hanya diberikan ke Admin. Guru dan siswa
  memakai Web App.
- Bila aplikasi diperbarui, Admin cukup membuat **deployment versi baru** tanpa mengubah URL.
- Detail teknis instalasi dan pengujian ada di `apps-script/README.md` dan `docs/RILIS.md`.
