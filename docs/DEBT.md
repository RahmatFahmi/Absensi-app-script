# DEBT — Temuan Audit Fondasi T01–T05

Catatan temuan dengan severity sedang/rendah yang ditunda sesuai aturan audit (hanya temuan KRITIS dan TINGGI yang langsung diperbaiki pada kode).

## Tabel Temuan Ditunda

| Lokasi | Masalah | Dampak |
|---|---|---|
| `Master.gs:501` (`deleteEntity`) | Pemanggilan `uSheet.getRange(...).setValue(false)` dilakukan di dalam loop `for` saat menonaktifkan akun entitas | Mengurangi efisiensi waktu karena I/O sel tunggal jika ada banyak baris yang dicocokkan |
| `Master.gs:106, 955` (`listEntity`, `listJadwal`) | Pembacaan seluruh baris sheet via `getDataRange().getValues()` tanpa paginasi | Konsumsi memori dan waktu eksekusi naik jika data berkembang hingga ribuan baris |
| `Master.gs:273` & `Import.gs:564` | Duplikasi logika pembentukan akun Guru/Siswa (pembuatan salt, hashing, objek akun) | Pemeliharaan ganda jika aturan pembuatan akun pengguna berubah |
| `Auth.gs:53` & `SESSION_TTL_SECONDS` | Sesi berbasis CacheService tanpa blacklist token aktif saat `resetPassword` atau akun dinonaktifkan | Pengguna yang dinonaktifkan atau direset masih dapat memakai sesi aktifnya hingga batas 6 jam |
| `Auth.gs:182` (`changePassword`) | Ganti password hanya memperbarui sesi pengguna saat ini; sesi aktif di perangkat lain tidak dicabut | Tidak ada fitur revoke all devices saat pergantian kredensial |
| `Code.gs:148` (`hashPassword_`) | Satu putaran SHA-256 + salt 16 karakter tanpa key stretching | Batasan bawaan platform Apps Script; rentan brute force jika data sheet bocor |
| `Master.gs:809, 856` (`getJadwalByGuruHari_`, `hariDariTanggal_`) | Helper jadwal guru dan nama hari disiapkan untuk T06 dan kini telah aktif digunakan di `Presensi.gs` | Sudah diselesaikan pada T06 |
| `Presensi.gs / Skema Semester` | Skema sheet Semester tidak memiliki kolom rentang tanggal mulai & selesai semester | Tanggal lampau yang berada di luar rentang aktif semester belum divalidasi batas awal semesternya (hanya dibatasi <= hari ini dan kecocokan hari) |

## Asumsi Deploy yang Diterima
- `appsscript.json`: `executeAs: "USER_DEPLOYING"` dan `access: "ANYONE"`. Di bawah konfigurasi ini, pengguna web app memiliki active user kosong/berbeda dari effective user, sehingga fungsi `setupSheets`, `seedAdmin`, dan `testT01`–`testT10` (kini di `Tests.gs`, dihapus saat produksi) terlindungi aman oleh `requireEditorOwner_()`.
- `whoAmI`, `changePassword`, `logout`: Dikecualikan secara sah dari `requireRole_` agar alur penyelesaian ganti password pertama kali dapat berjalan.

## Audit Rilis (putaran kedua, seluruh kode)

Tidak ada temuan KRITIS/TINGGI; tidak ada password/salt/`link_bukti` yang dikirim ke klien dan tidak ada rahasia di kode. Temuan sedang/rendah berikut ditunda:

| Lokasi | Masalah | Dampak |
|---|---|---|
| `Presensi.gs:528` (`savePresensi`) | `diubah_pada` ditulis `...'Z'` (penanda UTC) padahal jam lokal | Tampilan UI benar (huruf Z dibuang), tetapi pembacaan sebagai UTC akan bergeser +8 jam; samakan ke `XXX` bila format ini mulai di-parse |
| `Auth.gs:53-71` (`login`) | Counter lockout memakai kunci username | Siapa pun yang tahu username dapat mengunci akun itu 5 menit (gangguan, bukan kebocoran data) |
| `Master.gs:791` (`pilihSemesterAktif_`) | Mengembalikan baris "Aktif" pertama bila sheet berisi lebih dari satu | Semester aktif bisa ambigu jika sheet diedit manual di luar UI |
| `Master.gs:867` (`hariDariTanggal_`) | `new Date('yyyy-MM-dd')` = tengah malam UTC | Aman untuk zona ≥ UTC (mis. Asia/Makassar); zona negatif dapat menggeser nama hari |
| `Izin.gs:281, 373` (`kartu_kontrol === 'Ya'`) | Perbandingan ketat tanpa trim | Spasi/ketikan manual di sheet membuat alur bukti susulan dianggap non-kartu-kontrol |
| `docs/T0x-*.md` | Salinan lama file task yang sudah tidak sinkron dengan `tasks/` | Risiko mengedit dokumen yang salah |
| `Presensi.gs` / `Izin.gs` (kolom teks bebas) | Penolakan nilai berawalan `= + - @` baru dipasang di import dan CRUD data master; `keterangan`, `alasan`, `catatan_guru` masih ditulis apa adanya lewat `setValues` | Sel teks bebas masih bisa dieksekusi sebagai rumus bila diisi manual; perluas `awalanFormula_()` ke jalur tulis itu sebelum rilis publik |

