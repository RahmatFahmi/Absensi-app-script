# T10: Dashboard per Role
Status: menunggu uji manual
Dependensi: T08, T09

## Tujuan
Halaman awal berisi ringkasan sesuai role.

## Lingkup
- **Admin:** jumlah siswa, guru, kelas; ringkasan presensi hari ini (Hadir/Izin/Sakit/Alpa).
- **Guru:** jadwal hari ini dan jumlah pengajuan menunggu persetujuan, dengan tautan ke halaman terkait.
- **Siswa:** ringkasan persentase kehadiran dan status pengajuan terakhir.
- Satu fungsi server per role yang mengembalikan semua angka sekaligus (satu panggilan).

## Aturan wajib
- Tiga fungsi: `getDashboardAdmin`, `getDashboardGuru`, `getDashboardSiswa`, masing-masing diawali requireRole_ sesuai role; NIP/NIS dari sesi. SATU panggilan server per dashboard, mengembalikan semua angka sekaligus.
- Admin: jumlah siswa, guru, kelas; hitungan Hadir/Izin/Sakit/Alpa untuk tanggal hari ini pada jadwal semester aktif.
- Guru: jadwal hari ini (pakai logika getJadwalGuru yang ada) + jumlah pengajuan "Menunggu persetujuan" untuk jadwal miliknya, dengan tautan ke halaman terkait.
- Siswa: % hadir semester aktif (pakai fungsi agregasi dan rumus dari Rekap.gs, jangan tulis ulang) + status pengajuan terakhir.
- Tiap sheet dibaca maksimal sekali per panggilan. Tanpa semester aktif atau tanpa data: tampilkan empty state yang jelas, bukan error.
- Tampilan memakai kartu dari template (dashboard tiga role sudah ada). Hapus data dummy dan panel demo role dari template jika masih terbawa.
- Tes node: fungsi ringkasan murni (hitung per status, kasus kosong).

## Di luar lingkup
Grafik statistik.

## Kriteria selesai
- [ ] Ketiga dashboard menampilkan data benar
- [x] Hanya satu panggilan server per dashboard

## Ringkasan
- `Dashboard.gs` tidak dibuat; fungsi `getDashboardAdmin/Guru/Siswa`, helper murni, dan `testT10()` ada di `Rekap.gs`.
- Dashboard memakai agregasi Rekap.gs dan logika jadwal guru yang dijadikan helper bersama; satu baca per sheet per panggilan.
- UI tiga role ada di `DashboardPage.html` (kartu template, empty state), placeholdernya diganti di `Index.html`.
- Tes node `test/t10-pure.test.js` (6 lulus) dan langkah uji manual T10 ada di `apps-script/README.md`.
- Kriteria "data benar" belum dicentang karena butuh verifikasi langsung di Apps Script.

