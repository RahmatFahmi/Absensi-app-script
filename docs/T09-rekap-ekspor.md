# T09: Rekap & Ekspor Excel
Status: TODO
Dependensi: T06 (T08 disarankan lebih dulu)

## Tujuan
Siswa, Guru, dan Admin dapat melihat rekap; Guru dan Admin dapat mengekspor ke Excel.

## Lingkup
- **Siswa:** tabel per mapel (Hadir, Izin, Sakit, Alpa, % hadir) untuk semester aktif; detail per tanggal opsional.
- **Guru:** rekap per kelas dan mapel yang dia ajar, filter bulan/rentang tanggal.
- **Admin:** rekap seluruh sekolah, filter semester, kelas, mapel, tanggal.
- Filter semester pada semua rekap (default semester aktif).
- **Ekspor Excel:** buat spreadsheet sementara berisi hasil rekap, unduh sebagai `.xlsx` lewat URL ekspor, lalu hapus file sementara.
- Hitung rekap di server dalam satu kali baca `Presensi` (jangan per siswa).

## Di luar lingkup
Grafik, ekspor PDF.

## Kriteria selesai
- [ ] Rekap benar dan sesuai filter untuk ketiga role
- [ ] Ekspor Excel menghasilkan file yang dapat dibuka
- [ ] File sementara dihapus setelah ekspor
- [ ] Guru hanya melihat mapel miliknya, siswa hanya data dirinya
