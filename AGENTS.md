# AGENTS.md: Aturan untuk Agent Pengkode

Proyek: Aplikasi Presensi Sekolah (Google Apps Script + Google Sheets + Drive).
Detail lengkap ada di `PRD-Aplikasi-Presensi.md`, **tetapi jangan dibaca penuh**. Untuk tiap sesi cukup baca: file ini + SATU file task di `tasks/`.

## Cara kerja
1. Kerjakan **satu task per sesi**. Buka hanya `tasks/Txx-*.md` yang diminta.
2. Jangan mengerjakan apa pun di bagian "Di luar lingkup" task, walau terlihat mudah.
3. Jangan mengubah struktur sheet (nama sheet/kolom) tanpa persetujuan user. Jika perlu, berhenti dan tanyakan.
4. Jika ada keputusan yang belum jelas (lihat "Keputusan terbuka"), **tanyakan ke user**, jangan berasumsi.
5. Setelah selesai, centang kriteria selesai di file task dan ubah `Status` menjadi `DONE`. Tulis ringkasan maksimal 5 baris tentang apa yang diubah.
6. Jangan menulis ulang file yang tidak berkaitan dengan task. Ubah seperlunya saja.

## Batasan teknis
- Hanya HTML, CSS, JavaScript biasa, dan Bootstrap 5 via CDN. Tidak memakai framework build (React, Vue, npm).
- Backend di file `.gs`; frontend di file `.html` yang dipanggil lewat `include()`.
- Komunikasi klien-server memakai `google.script.run`.
- **Cek role selalu di server.** Menyembunyikan menu di frontend tidak cukup.
- Password selalu di-hash (SHA-256 + salt), tidak pernah disimpan atau dikirim polos.
- Operasi sheet dilakukan secara batch (`getValues`/`setValues`), tidak membaca sel satu per satu dalam loop.
- Zona waktu aplikasi diatur di `appsscript.json` (`Asia/Makassar`; sesuaikan jika zona waktu sekolah berbeda). Semua perbandingan tanggal/jam memakai zona ini.
- Tidak ada API key atau data rahasia yang ditulis langsung di kode.

## Struktur file target
```
Code.gs        // doGet, include, helper umum
Auth.gs        // login, sesi, role guard
Master.gs      // CRUD data master + semester
Import.gs      // import paste data
Presensi.gs    // presensi guru
Izin.gs        // pengajuan + persetujuan
Rekap.gs       // rekap + ekspor Excel
Index.html     // kerangka + router halaman
Style.html     // CSS
Script.html    // JS umum
(Halaman.html) // satu file per halaman, mis. Login.html, Presensi.html
```

## Skema sheet (acuan tunggal)
| Sheet | Kolom |
|---|---|
| Users | id_user, username, password_hash, salt, role, ref_id, wajib_ganti_password, aktif |
| Siswa | nis, nama, id_kelas, kartu_kontrol |
| Guru | nip, nama |
| Kelas | id_kelas, nama_kelas |
| Mapel | id_mapel, nama_mapel |
| Semester | id_semester, tahun_ajaran, semester, status |
| Jadwal | id_jadwal, id_semester, id_kelas, id_mapel, nip_guru, hari, jam_mulai, jam_selesai |
| Presensi | id_presensi, tanggal, id_jadwal, nis, status, keterangan, diubah_oleh, diubah_pada |
| Izin | id_izin, nis, id_jadwal, tanggal, jenis, alasan, link_bukti, status, diajukan_pada, diproses_oleh, diproses_pada, catatan_guru |

Nilai tetap: role = `Admin|Guru|Siswa`; status presensi = `Hadir|Izin|Sakit|Alpa`; jenis izin = `Sakit|Izin`; status izin = `Menunggu bukti|Menunggu persetujuan|Disetujui|Ditolak`; status semester = `Aktif|Tidak aktif`.

## Aturan bisnis inti
1. Presensi per mapel, diisi oleh guru pengajar jadwal tersebut.
2. Tanggal masa depan tidak boleh diisi; tanggal lampau boleh (hanya di semester aktif).
3. Satu jadwal + tanggal hanya punya satu set presensi (tidak boleh ganda, jadi mode edit).
4. Pengajuan sakit/izin hanya dalam 15 menit pertama sejak `jam_mulai` mapel.
5. Sakit: bukti menyusul (alur `Menunggu bukti` → `Menunggu persetujuan`). Izin: surat orang tua wajib diunggah saat mengajukan.
6. Persetujuan oleh guru mapel terkait. Bukti tidak diunggah → otomatis `Ditolak`, guru tetap bisa mengubah.
7. Saat `Disetujui`, status presensi siswa di jadwal+tanggal itu menjadi Sakit/Izin.
8. Hanya satu semester `Aktif`; data semester lama baca-saja.
9. Tidak ada role wali kelas dan tidak ada guru pengganti.
10. **Role tidak pernah dipilih pengguna.** Login hanya username + password; role ditentukan server dari sheet `Users`. Tidak boleh ada dropdown/input role di halaman login atau parameter URL yang mengubah role.

## Keputusan terbuka (tanya user, jangan berasumsi)
- Penanda siswa kartu kontrol (usulan: kolom `kartu_kontrol` diisi Admin).
- Batas waktu unggah bukti sakit sebelum otomatis ditolak.
- Ganti password wajib saat login pertama.
- Bentuk notifikasi (opsional).

## Urutan task
T01 → T02 → T03 → T04 → T05 → T06 → T07 → T08 → T09 → T10 → T11 (opsional).
