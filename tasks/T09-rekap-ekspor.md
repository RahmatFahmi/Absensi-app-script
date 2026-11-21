# T09: Rekap & Ekspor Excel
Status: menunggu uji manual
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

## Aturan wajib
- Fungsi terpisah per role, tiap fungsi diawali requireRole_: `getRekapSiswa` (Siswa; NIS dari sesi), `getRekapGuru` (Guru; hanya jadwal dengan nip_guru = sesi), `getRekapAdmin` (Admin; semua), `exportRekapExcel` (Guru/Admin; guru tetap hanya mapelnya). Filter dari klien tidak boleh melebarkan akses.
- Filter: id_semester (default aktif), kelas, mapel, tanggal_dari, tanggal_sampai (teks yyyy-MM-dd, batas inklusif).
- Baca Presensi, Jadwal, Siswa, Kelas, Mapel masing-masing SATU kali; agregasi di memori.
- Rumus (default, satu fungsi murni agar mudah diubah): % hadir = Hadir / (Hadir+Izin+Sakit+Alpa) x 100, satu desimal; total 0 tampil "-". Izin dan Sakit TIDAK dihitung hadir, ditampilkan terpisah. Hanya pertemuan yang sudah tercatat di Presensi yang dihitung (jadwal yang belum diisi tidak jadi Alpa otomatis).
- Ekspor: server membuat spreadsheet sementara (Drive pemilik), mengisi rekap, mengambil .xlsx lewat URL ekspor (UrlFetchApp + ScriptApp.getOAuthToken()), mengirim base64 ke klien untuk diunduh sebagai Blob, dan SELALU menghapus file sementara di blok finally. Nama file dibuat server. Batas jumlah baris ekspor. Sel teks ditulis sebagai teks (cegah formula injection).
- Periksa appsscript.json: jika oauthScopes eksplisit, tambahkan scope yang dibutuhkan; jika tidak ada, biarkan otomatis.
- Tes node wajib: agregasi (H/I/S/A, persen, total 0, filter tanggal inklusif, filter semester), isolasi guru (hanya jadwal miliknya), nama file aman.

## Di luar lingkup
Grafik, ekspor PDF.

## Kriteria selesai
- [ ] Rekap benar dan sesuai filter untuk ketiga role
- [ ] Ekspor Excel menghasilkan file yang dapat dibuka
- [ ] File sementara dihapus setelah ekspor
- [x] Guru hanya melihat mapel miliknya, siswa hanya data dirinya

## Catatan implementasi
`Rekap.gs` (agregasi murni + getRekapSiswa/Guru/Admin + exportRekapExcel) dan `RekapPage.html` selesai.
10 tes node T09 lulus; `testT09()` memeriksa agregasi, filter, isolasi, nama file, dan role guard.
Ekspor Excel, penghapusan file sementara, dan role guard di runtime belum dijalankan (butuh Apps Script).
