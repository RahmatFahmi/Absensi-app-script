# T03: Data Master Admin (Input Manual)
Status: DONE
Dependensi: T02

## Tujuan
Admin dapat mengelola Kelas, Guru, Siswa, dan Mapel secara manual.

## Lingkup
- Halaman CRUD untuk Kelas, Guru, Siswa, Mapel: tabel daftar, pencarian, form tambah/edit, hapus dengan konfirmasi.
- Validasi: NIS/NIP unik, kolom wajib terisi, `id_kelas` pada Siswa harus ada.
- Saat Siswa/Guru ditambah, akun di `Users` dibuat otomatis (username dan password awal = NIS/NIP, di-hash).
- Admin dapat mereset password akun ke NIS/NIP.
- Semua fungsi server dilindungi `requireRole(['Admin'])`.
- Kolom `kartu_kontrol` pada Siswa: tanyakan ke user sebelum membuat inputnya.

## Di luar lingkup
Import massal, Jadwal, Semester.

## Kriteria selesai
- [x] CRUD keempat data master bekerja
- [x] Akun otomatis dibuat/dinonaktifkan sesuai data
- [x] Validasi menolak data ganda atau tidak lengkap
- [x] Reset password bekerja

## Ringkasan Perubahan
1. Membuat `Master.gs` berisi mesin CRUD berbasis konfigurasi (`listEntity`, `saveEntity`, `deleteEntity`, `resetPassword`) dan fungsi uji otomatis `testT03()`.
2. Menambahkan `Master.html` untuk UI terpadu 4 entitas (tabs, tabel, filter kelas, modal form, dialog konfirmasi hapus & reset password).
3. Mengintegrasikan `Master.html` ke dalam `Index.html` dan memperbarui router `navigateTo` pada `Script.html`.
4. Menyimpan status `kartu_kontrol` siswa sebagai 'Ya' / 'Tidak' (default 'Tidak') sesuai keputusan user.
5. Mengotomatiskan pembuatan akun `Users` saat tambah Guru/Siswa, penonaktifan akun saat hapus, dan penguncian relasi hapus via `LockService`.
