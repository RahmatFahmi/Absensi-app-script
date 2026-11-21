# Rilis Produksi — Aplikasi Presensi Sekolah

## 1. Persiapan
1. Siapkan Google Spreadsheet kosong, lalu buka **Ekstensi > Apps Script**.
2. Salin file `apps-script/` sesuai daftar di `apps-script/README.md` (termasuk `Setup.gs` dan `Tests.gs`).
3. Pastikan `appsscript.json` memakai zona waktu sekolah (`Asia/Makassar`).
4. Project Settings > **Script Properties**:
   - `ADMIN_INITIAL_PASSWORD` (wajib): password awal akun `admin`.
   - `BUKTI_FOLDER_ID` (opsional): folder Drive bukti; dibuat otomatis bila kosong.
   - `SPREADSHEET_ID` (opsional): hanya bila script berdiri sendiri, bukan dibuka dari spreadsheet.

## 2. Setup Awal (dari editor Apps Script)
5. Jalankan `setupSheets()`, lalu `seedAdmin()`.
6. Jalankan `testT01()` … `testT10()`; semua harus berakhir "LULUS". `testT05`–`testT10` perlu 1 semester aktif — buat dan aktifkan dulu di menu Semester & Jadwal (testT04 membersihkan semester ujinya).
7. Jalankan `installTriggers_()` sekali (trigger harian 01:00 zona aplikasi).
8. Buka Web App, login `admin`, dan ganti password saat diminta.

## 3. Deploy
9. **Deploy > New deployment > Web app**: Execute as `Me (USER_DEPLOYING)`, Who has access `Anyone`.
10. Login tiap role sekali untuk memastikan menu sesuai (role dari server).
11. **Hapus file `Tests.gs`** dari proyek, lalu **Deploy > Manage deployments > Edit > New version**.
    `Tests.gs` hanya berisi `testT01`–`testT10` dan **tidak boleh ada** di deployment produksi.
    `Setup.gs` (`setupSheets`, `seedAdmin`) **tetap disimpan** di produksi.
12. Bila perlu uji ulang di kemudian hari: tambahkan kembali `Tests.gs`, jalankan dari editor, lalu hapus dan deploy versi baru.

## 4. Setelah Rilis
13. Isi data master (Kelas, Mapel, Guru, Siswa, Jadwal) lewat menu Admin atau Import Data Paste.
14. Jangan bagikan akses **edit** spreadsheet ke Guru/Siswa; akses hanya lewat Web App.
15. Uji manual per task ada di `tasks/T0x-*.md` (status saat ini: menunggu uji manual).
16. **Rollback**: Deploy > Manage deployments > pilih versi sebelumnya.
