# T06: Presensi oleh Guru
Status: DONE (kode selesai; awaiting manual test)
Dependensi: T04

## Tujuan
Guru mengambil dan mengedit presensi per mapel.

## Lingkup
- Halaman jadwal guru hari ini (semester aktif) dengan penanda `Belum diisi` / `Sudah diisi`; dapat memilih tanggal lain (tidak boleh masa depan).
- Form presensi: daftar siswa kelas, status Hadir/Izin/Sakit/Alpa (default Hadir), keterangan opsional, tombol Simpan (batch ke `Presensi`).
- Jika presensi jadwal+tanggal sudah ada, form masuk mode Edit.
- Validasi server: tanggal tidak boleh masa depan; jadwal harus milik guru yang login; semester harus aktif; tidak boleh ganda.
- Isi `diubah_oleh` dan `diubah_pada` setiap simpan.
- Penanda di samping nama siswa jika ada pengajuan Sakit/Izin untuk jadwal+tanggal itu (baca dari `Izin`; jika T07 belum ada, siapkan fungsinya dan kembalikan daftar kosong).

## Di luar lingkup
Persetujuan pengajuan, rekap, QR.

## Kriteria selesai
- [ ] Simpan dan edit presensi bekerja, tanpa data ganda (awaiting manual test)
- [ ] Tanggal masa depan dan jadwal milik guru lain ditolak server (awaiting manual test)
- [ ] Penanda Belum/Sudah diisi akurat (awaiting manual test)
