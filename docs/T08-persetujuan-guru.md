# T08: Persetujuan Guru & Penolakan Otomatis
Status: TODO
Dependensi: T07

## Tujuan
Guru mapel menyetujui atau menolak pengajuan; bukti yang tak diunggah ditolak otomatis.

## Lingkup
- Halaman guru: daftar pengajuan untuk jadwal yang dia ajar, filter status, detail dengan pratinjau bukti dari Drive.
- Tombol Setuju/Tolak (catatan penolakan opsional); isi `diproses_oleh`, `diproses_pada`, `catatan_guru`.
- Saat `Disetujui`, ubah/buat baris `Presensi` siswa pada jadwal+tanggal itu menjadi Sakit/Izin.
- Guru dapat mengubah keputusan, termasuk pengajuan yang ditolak otomatis.
- Time-driven trigger yang menandai `Ditolak` pengajuan Sakit berstatus `Menunggu bukti` yang melewati batas waktu. **Batas waktunya belum diputuskan: tanyakan ke user.**
- Guru hanya dapat memproses pengajuan untuk jadwal miliknya.

## Di luar lingkup
Notifikasi (T11).

## Kriteria selesai
- [ ] Setuju/Tolak bekerja dan status presensi ikut berubah
- [ ] Guru lain tidak dapat memproses pengajuan bukan miliknya
- [ ] Trigger penolakan otomatis berjalan sesuai batas yang disepakati
