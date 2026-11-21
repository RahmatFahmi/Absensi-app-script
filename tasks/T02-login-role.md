# T02: Login, Sesi, dan Role Guard
Status: menunggu uji manual
Dependensi: T01

## Tujuan
Pengguna dapat login dan hanya mengakses fitur sesuai role-nya.

## Lingkup
- Halaman `Login.html`; fungsi `login(username, password)` di `Auth.gs` (hash + salt, bandingkan dengan `Users`).
- Sesi: token acak disimpan di `CacheService` dengan masa berlaku 6 jam; dikirim ke tiap pemanggilan server.
- Helper `requireRole(token, [roles])` yang dipanggil di awal setiap fungsi server yang dilindungi.
- Setelah login, arahkan ke dashboard kosong sesuai role (Admin/Guru/Siswa) dengan menu per role.
- Logout dan ganti password.
- Kolom `wajib_ganti_password` dibaca saat login. Keputusan: wajib ganti password saat login pertama = YA.
- Hapus elemen demo role. Login hanya berisi username dan password; role diambil dari `Users` di server.
- Tidak boleh ada mekanisme yang membuat klien menentukan role-nya sendiri.

## Di luar lingkup
Isi dashboard, fitur data master.

## Kriteria selesai
- [ ] Login benar/salah ditangani, pesan error jelas (menunggu uji manual `login()` di Web App)
- [ ] Menu berbeda tiap role, dan pemanggilan fungsi server dengan role salah ditolak (menunggu uji manual `requireRole()` via `testT02()`)
- [x] Tidak ada pilihan role di UI login; mengirim role palsu dari klien tidak berpengaruh (terverifikasi di kode)
- [ ] Logout menghapus sesi (menunggu uji manual `logout()`)
- [ ] Ganti password bekerja dan tersimpan dalam bentuk hash (menunggu uji manual `changePassword()`)
