# T07: Pengajuan Sakit/Izin oleh Siswa
Status: DONE (kode selesai; awaiting manual test)
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

## Di luar lingkup
Persetujuan guru, penolakan otomatis (T08).

## Kriteria selesai
- [ ] Pengajuan di luar 15 menit ditolak server (awaiting manual test)
- [ ] Alur status Sakit dan Izin sesuai aturan (awaiting manual test)
- [ ] File tersimpan di Drive privat dan tautannya tercatat (awaiting manual test)
- [x] Validasi tipe dan ukuran file bekerja (lulus unit test node)
