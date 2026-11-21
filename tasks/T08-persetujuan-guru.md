# T08: Persetujuan Guru & Penolakan Otomatis
Status: menunggu uji manual
Dependensi: T07

## Tujuan
Guru mapel menyetujui atau menolak pengajuan; bukti yang tak diunggah ditolak otomatis.

## Lingkup
- Halaman guru: daftar pengajuan untuk jadwal yang dia ajar, filter status, detail dengan pratinjau bukti dari Drive.
- Tombol Setuju/Tolak (catatan penolakan opsional); isi `diproses_oleh`, `diproses_pada`, `catatan_guru`.
- Saat `Disetujui`, ubah/buat baris `Presensi` siswa pada jadwal+tanggal itu menjadi Sakit/Izin.
- Guru dapat mengubah keputusan, termasuk pengajuan yang ditolak otomatis.
- Time-driven trigger yang menandai `Ditolak` pengajuan Sakit berstatus `Menunggu bukti` yang melewati batas waktu. Batas: 3 hari kalender setelah tanggal pengajuan (konstanta `BATAS_UNGGAH_HARI`, mudah diubah).
- Guru hanya dapat memproses pengajuan untuk jadwal miliknya.

## Aturan wajib
- Semua fungsi diawali requireRole_ Guru; NIP dari sesi. Guru hanya memproses pengajuan yang jadwalnya miliknya (jadwal.nip_guru = sesi) dan hanya di semester aktif.
- Setuju/Tolak dalam satu lock; isi diproses_oleh, diproses_pada, catatan_guru.
- Setuju: jika baris Presensi untuk (id_jadwal, tanggal, nis) sudah ada, ubah statusnya menjadi Sakit/Izin. Jika presensi jadwal+tanggal itu BELUM ada, JANGAN membuat baris (akan membuat badge "Sudah diisi" palsu dan merusak aturan daftar siswa T06); sebagai gantinya `getFormPresensi` (T06) memakai pengajuan "Disetujui" sebagai status default siswa tersebut.
- Guru mengubah keputusan dari Disetujui ke Ditolak: status presensi baris itu (jika ada) dikembalikan ke "Alpa". Ditolak ke Disetujui: aturan Setuju di atas.
- Pratinjau bukti: server membaca file Drive dan mengirim isinya (data URL) hanya ke guru pemilik jadwal. link_bukti TIDAK dikirim ke klien.
- Trigger harian: dipasang oleh `installTriggers_()` (dijalankan pemilik sekali, idempoten: hapus trigger lama dengan handler sama lebih dulu). Menolak otomatis pengajuan Sakit berstatus "Menunggu bukti" yang melewati batas; diproses_oleh = "SISTEM", catatan_guru = "Ditolak otomatis: bukti tidak diunggah". Satu lock, tulis batch.
- Teks pengguna (alasan, catatan) dirender dengan textContent.

## Di luar lingkup
Notifikasi (T11).

## Kriteria selesai
- [ ] Setuju/Tolak bekerja dan status presensi ikut berubah
- [ ] Guru lain tidak dapat memproses pengajuan bukan miliknya
- [ ] Trigger penolakan otomatis berjalan sesuai batas yang disepakati

> Kriteria di atas butuh runtime Apps Script; centang setelah `testT08()` dan langkah uji manual T08 di `apps-script/README.md` dijalankan.

## Ringkasan
- Menambah `PersetujuanPage.html` (daftar per jadwal, filter status, pratinjau bukti data URL, setuju/tolak + catatan).
- Menambah `getPengajuanGuru`, `getBuktiPengajuan`, `prosesPengajuan` (lock, kepemilikan jadwal, sinkron Presensi tanpa baris baru).
- Menambah `tolakPengajuanKedaluwarsa_` + `installTriggers_()` idempoten (batas `BATAS_UNGGAH_HARI = 3`) dan `testT08()`.
- `getFormPresensi` memakai pengajuan Disetujui sebagai status default; `unggahBukti` menulis 1x2 sekali; `Izin.tanggal` kini teks.
- Tes node baru `t08-pure.test.js`, tes T06 dan `core-text-columns` diperbarui; semua tes node lulus.
