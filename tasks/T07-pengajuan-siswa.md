# T07: Pengajuan Sakit/Izin oleh Siswa
Status: menunggu uji manual
Dependensi: T06

## Tujuan
Siswa dapat mengajukan Sakit/Izin dan mengunggah bukti.

## Lingkup
- Halaman siswa: pilih jadwal hari ini, jenis (Sakit/Izin), alasan, lalu kirim.
- Validasi server: hanya dalam 15 menit pertama sejak `jam_mulai` (waktu server, zona waktu aplikasi); jadwal harus milik kelas siswa; semester aktif.
- **Sakit:** status awal `Menunggu bukti`; siswa mengunggah surat dokter kemudian, lalu status `Menunggu persetujuan`. Siswa kartu kontrol dapat mengunggah langsung saat mengajukan (tanya user cara penandanya).
- **Izin:** surat orang tua bertanda tangan wajib diunggah saat mengajukan; status langsung `Menunggu persetujuan`.
- Unggah file: gambar/PDF, maks 2 MB, dikirim base64, disimpan ke folder Drive privat, `link_bukti` dicatat.
- Daftar pengajuan siswa dengan status terbaru.

## Aturan wajib (server)
- Semua fungsi diawali requireRole_ Siswa; NIS dari sesi, bukan parameter.
- Jendela 15 menit dihitung SERVER (jam_mulai s.d. +15 menit, inklusif); waktu klien diabaikan.
- Satu pengajuan aktif per (nis, id_jadwal, tanggal); cek + tulis dalam satu lock.
- Sakit: status awal "Menunggu bukti"; berkas saat mengajukan hanya jika Siswa.kartu_kontrol = "Ya". Izin: berkas wajib saat mengajukan.
- Berkas: JPEG/PNG/PDF dicek dari isi (magic bytes), maks 2 MB, nama file dibuat server.
- Folder Drive PRIVAT (Script Properties BUKTI_FOLDER_ID); jangan ubah pengaturan berbagi (guru membaca lewat server di T08). Jika tulis baris gagal, buang file.
- Siswa hanya melihat pengajuan sendiri; link_bukti tidak dikirim ke klien.
- Teks pengguna dirender dengan textContent. Tanggal/nis/id_jadwal disimpan sebagai teks.
- Pengecilan foto >2 MB di klien hanya jika kodenya sederhana (~30 baris); jika tidak, catat di DEBT.md.
- Tes node wajib: batas jendela (07:00 -> 06:59 ditolak; 07:00 dan 07:15 diterima; 07:16 ditolak), magic bytes, batas ukuran.

## Di luar lingkup
Persetujuan guru, penolakan otomatis (T08).

## Kriteria selesai
- [ ] Pengajuan di luar 15 menit ditolak server
- [ ] Alur status Sakit dan Izin sesuai aturan
- [ ] File tersimpan di Drive privat dan tautannya tercatat
- [ ] Validasi tipe dan ukuran file bekerja

Catatan: kriteria di atas belum dicentang karena butuh verifikasi di Apps Script (`testT07()` + langkah uji manual di `apps-script/README.md`).

## Ringkasan
- Backend `Izin.gs` + halaman `PengajuanPage.html` untuk alur Sakit/Izin, unggah bukti, dan riwayat.
- Perbaikan audit: guard panjang base64, urutan riwayat berbasis waktu, window tutup `testT07` aman dini hari.
- `showToast` merender pesan dengan `textContent`; badge window tutup memakai token desain.
- Tes node `t07-pure.test.js` lulus; kriteria menunggu uji Apps Script.
