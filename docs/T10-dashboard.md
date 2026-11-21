# T10: Dashboard per Role
Status: TODO
Dependensi: T08, T09

## Tujuan
Halaman awal berisi ringkasan sesuai role.

## Lingkup
- **Admin:** jumlah siswa, guru, kelas; ringkasan presensi hari ini (Hadir/Izin/Sakit/Alpa).
- **Guru:** jadwal hari ini dan jumlah pengajuan menunggu persetujuan, dengan tautan ke halaman terkait.
- **Siswa:** ringkasan persentase kehadiran dan status pengajuan terakhir.
- Satu fungsi server per role yang mengembalikan semua angka sekaligus (satu panggilan).

## Di luar lingkup
Grafik statistik.

## Kriteria selesai
- [ ] Ketiga dashboard menampilkan data benar
- [ ] Hanya satu panggilan server per dashboard
