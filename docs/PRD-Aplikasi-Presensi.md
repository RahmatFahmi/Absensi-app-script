# PRD: Aplikasi Presensi Sekolah Berbasis Web

**Platform:** Google Apps Script (Web App)
**Database:** Google Sheets
**Penyimpanan file bukti:** Google Drive
**Status dokumen:** Draft 1, hasil diskusi kebutuhan

---

## 1. Latar Belakang & Tujuan

Presensi siswa di sekolah umumnya dicatat per mata pelajaran oleh guru pengajar. Aplikasi ini mendigitalkan proses tersebut, mulai dari pengambilan presensi, pengajuan izin/sakit oleh siswa, persetujuan guru, sampai rekap kehadiran.

**Tujuan:**
- Guru dapat mengambil presensi per mapel dengan cepat.
- Siswa dapat mengajukan izin/sakit dan melihat rekap kehadirannya per mapel.
- Admin dapat mengelola data master dan melihat rekap seluruh sekolah.
- Data kehadiran tersimpan rapi per semester dan dapat diekspor ke Excel.

## 2. Ruang Lingkup

**Termasuk (In scope):**
- Login dengan 3 role: Admin, Guru, Siswa
- Manajemen data master (manual dan import)
- Presensi per mapel oleh guru
- Pengajuan Sakit/Izin oleh siswa dengan unggah bukti
- Persetujuan pengajuan oleh guru mapel
- Rekap kehadiran dan ekspor Excel
- Dashboard per role
- Pengelolaan semester (versi ringan)

**Tidak termasuk (Out of scope):**
- Role wali kelas
- Guru pengganti
- Persetujuan izin sekali untuk semua mapel

**Opsional (jika waktu cukup):**
- Presensi dengan scan QR
- Notifikasi (misalnya email)
- Upload CSV untuk import data

## 3. Role Pengguna

| Role | Deskripsi | Hak akses utama |
|---|---|---|
| Admin | Pengelola sistem | Data master, akun, semester, rekap seluruh sekolah |
| Guru | Pengajar mapel | Presensi mapel yang diajar, persetujuan pengajuan, rekap mapelnya |
| Siswa | Peserta didik | Pengajuan sakit/izin, rekap kehadiran pribadi per mapel |

## 4. Kebutuhan Fungsional

### 4.1 Login & Akun (semua role)
- F-01: Login dengan username dan password, lalu diarahkan ke dashboard sesuai role.
- F-02: Password disimpan dalam bentuk hash.
- F-03: Logout dan ganti password.
- F-04: Password awal akun hasil import adalah NIS (siswa) atau NIP (guru).
- F-05: Admin dapat mereset password akun.
- F-06 *(usulan)*: Pengguna diwajibkan mengganti password saat login pertama.

### 4.2 Admin: Data Master
- F-10: CRUD data **Siswa, Guru, Kelas, Mapel, Jadwal**.
- F-11: Dua cara input: **manual** (form, edit, hapus, pencarian) dan **import**.
- F-12: Import via **paste data** dari Excel/Sheets (upload CSV menyusul jika waktu cukup).
- F-13: Import menyediakan template, pratinjau sebelum simpan, dan validasi:
  - NIS/NIP tidak boleh ganda
  - Kelas, mapel, atau guru yang dirujuk harus sudah ada
  - Kolom wajib tidak boleh kosong
- F-14: Urutan import: Kelas → Guru/Siswa → Mapel → Jadwal.
- F-15: Akun siswa/guru dibuat otomatis saat data diimpor atau ditambahkan.

### 4.3 Admin: Semester
- F-20: CRUD semester (tahun ajaran, Ganjil/Genap).
- F-21: Hanya satu semester berstatus **Aktif** pada satu waktu.
- F-22: Jadwal terikat pada semester. Siswa, Guru, dan Mapel tidak terikat semester.
- F-23: Presensi dan pengajuan hanya dapat dibuat/diedit pada semester aktif. Data semester lama tetap dapat dilihat dan diekspor.

### 4.4 Guru: Presensi
- F-30: Halaman jadwal mengajar hari ini dengan penanda **Belum diisi / Sudah diisi**.
- F-31: Klik jadwal untuk membuka form presensi berisi daftar siswa kelas tersebut.
- F-32: Status per siswa: **Hadir, Izin, Sakit, Alpa**. Default semua **Hadir**. Ada kolom keterangan opsional.
- F-33: Simpan semua data sekaligus ke sheet Presensi.
- F-34: Guru boleh mengisi dan mengedit presensi **tanggal sebelumnya**, tetapi **tidak boleh tanggal masa depan**.
- F-35: Tidak boleh ada presensi ganda untuk kombinasi jadwal dan tanggal yang sama. Jika sudah ada, tombol berubah menjadi Edit.
- F-36: Guru hanya dapat mengakses jadwal miliknya sendiri.
- F-37: Setiap perubahan mencatat siapa dan kapan terakhir diubah.
- F-38: Jika siswa sudah mengajukan sakit/izin untuk jadwal dan tanggal tersebut, form menampilkan penanda di samping nama siswa.

### 4.5 Siswa: Pengajuan Sakit/Izin
Hanya ada dua jenis pengajuan: **Sakit** dan **Izin**.

- F-40: Pengajuan hanya dapat dikirim dalam **15 menit pertama** sejak jam mulai mapel (dibandingkan dengan waktu server dan `jam_mulai` pada Jadwal).
- F-41: **Sakit:**
  - Siswa mengajukan terlebih dahulu (alasan singkat), status `Menunggu bukti`.
  - Setelah berobat, siswa mengunggah surat keterangan dokter, status menjadi `Menunggu persetujuan`.
  - Siswa yang memiliki kartu kontrol dapat langsung mengunggah bukti saat mengajukan, tanpa tahap `Menunggu bukti`.
- F-42: **Izin:** surat orang tua yang **bertanda tangan** wajib diunggah saat mengajukan. Status langsung `Menunggu persetujuan`.
- F-43: Persetujuan selalu dilakukan oleh **guru mapel terkait**. Status menjadi `Disetujui` saat guru menekan Setuju.
- F-44: Jika bukti tidak pernah diunggah, pengajuan otomatis menjadi `Ditolak`, namun keputusan akhir tetap ada pada guru (guru dapat mengubahnya).
- F-45: Guru menilai keabsahan bukti secara manual.
- F-46: Saat disetujui, status siswa pada presensi mapel dan tanggal tersebut otomatis menjadi Sakit/Izin.

**Alur status:**
- Sakit: `Menunggu bukti` → `Menunggu persetujuan` → `Disetujui` / `Ditolak`
- Izin: `Menunggu persetujuan` → `Disetujui` / `Ditolak`

### 4.6 Guru: Persetujuan Pengajuan
- F-50: Daftar pengajuan yang masuk untuk mapel yang diajar, dengan filter status.
- F-51: Detail pengajuan dengan pratinjau foto/surat dari Drive.
- F-52: Tombol **Setuju** dan **Tolak**, dengan catatan penolakan opsional.

### 4.7 Rekap & Ekspor
- F-60: **Siswa:** rekap kehadiran per mapel (Hadir, Izin, Sakit, Alpa, persentase), dengan detail per tanggal (opsional).
- F-61: **Guru:** rekap per kelas dan mapel yang diajar, filter bulan atau rentang tanggal.
- F-62: **Admin:** rekap seluruh sekolah, filter kelas, mapel, semester, dan tanggal.
- F-63: Rekap guru dan Admin dapat **diekspor ke Excel (.xlsx)**.
- F-64: Rekap default menampilkan semester aktif, dengan filter untuk semester lain.

### 4.8 Dashboard
- F-70: **Admin:** jumlah siswa, guru, kelas, dan ringkasan presensi hari ini.
- F-71: **Guru:** jadwal hari ini dan jumlah pengajuan yang menunggu persetujuan.
- F-72: **Siswa:** ringkasan kehadiran dan status pengajuan terakhir.

### 4.9 Fitur Opsional
- O-01: Presensi scan QR (siswa yang di-scan otomatis Hadir; mode ini memakai default Alpa/belum hadir). Kamera di Apps Script perlu diuji lebih awal.
- O-02: Notifikasi (misalnya email saat pengajuan disetujui/ditolak atau siswa alpa).
- O-03: Upload CSV untuk import data.

## 5. Struktur Data (Google Sheets)

| Sheet | Kolom |
|---|---|
| **Users** | id_user, username, password_hash, role, ref_id (NIS/NIP), wajib_ganti_password, aktif |
| **Siswa** | nis, nama, id_kelas, kartu_kontrol *(usulan: Ya/Tidak, diisi Admin)* |
| **Guru** | nip, nama |
| **Kelas** | id_kelas, nama_kelas |
| **Mapel** | id_mapel, nama_mapel |
| **Semester** | id_semester, tahun_ajaran, semester (Ganjil/Genap), status (Aktif/Tidak aktif) |
| **Jadwal** | id_jadwal, id_semester, id_kelas, id_mapel, nip_guru, hari, jam_mulai, jam_selesai |
| **Presensi** | id_presensi, tanggal, id_jadwal, nis, status, keterangan, diubah_oleh, diubah_pada |
| **Izin** | id_izin, nis, id_jadwal, tanggal, jenis (Sakit/Izin), alasan, link_bukti, status, diajukan_pada, diproses_oleh, diproses_pada, catatan_guru |

Relasi utama: Presensi → Jadwal → (Semester, Kelas, Mapel, Guru); Izin → Jadwal dan Siswa.

## 6. Aturan Bisnis Ringkas

1. Presensi dilakukan per mapel oleh guru pengajar.
2. Tanggal masa depan tidak boleh diisi; tanggal lampau boleh.
3. Satu jadwal pada satu tanggal hanya punya satu set presensi.
4. Pengajuan sakit/izin hanya dalam 15 menit pertama jam mapel.
5. Sakit: bukti menyusul. Izin: bukti wajib saat mengajukan.
6. Persetujuan oleh guru mapel; bukti tidak diunggah menjadi Ditolak otomatis, guru dapat mengubahnya.
7. Hanya satu semester aktif; data semester lama bersifat baca saja.

## 7. Kebutuhan Non-Fungsional

- **Keamanan:** password di-hash; pengecekan role dilakukan di sisi server (`Code.gs`), bukan hanya menyembunyikan menu; folder bukti di Drive bersifat privat.
- **Upload file:** hanya gambar/PDF, ukuran dibatasi (usulan maksimal 2 MB).
- **Tampilan:** responsif (HP dan desktop), memakai HTML, CSS, JavaScript (opsional Bootstrap).
- **Performa:** operasi simpan presensi dilakukan secara batch; hindari pembacaan sheet berulang dalam loop.
- **Otomatisasi:** time-driven trigger Apps Script untuk menolak otomatis pengajuan yang buktinya tidak diunggah.
- **Ekspor Excel:** melalui sheet sementara yang diunduh sebagai `.xlsx`, lalu dihapus.

## 8. Rencana Pengerjaan (Usulan)

1. Struktur sheet, login, dan pembatasan role
2. Data master (manual), lalu import
3. Semester dan jadwal
4. Presensi guru
5. Pengajuan sakit/izin siswa dan persetujuan guru
6. Rekap per role dan ekspor Excel
7. Dashboard
8. Opsional: notifikasi, QR, upload CSV

## 9. Hal yang Masih Perlu Diputuskan

- **Penanda kartu kontrol:** usulan berupa kolom pada data Siswa yang diisi Admin (belum dikonfirmasi).
- **Batas waktu unggah bukti sakit** sebelum otomatis Ditolak (misalnya 3 hari).
- **Ganti password wajib saat login pertama** (usulan, belum dikonfirmasi).
- **Bentuk notifikasi** jika dikerjakan (email atau lainnya).
