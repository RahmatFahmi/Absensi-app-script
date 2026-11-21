# T04: Semester & Jadwal
Status: DONE (kode selesai; uji Apps Script menunggu)
Dependensi: T03

## Tujuan
Admin mengelola semester dan jadwal pelajaran.

## Lingkup
- CRUD Semester; tepat satu berstatus `Aktif` (mengaktifkan satu otomatis menonaktifkan yang lain).
- CRUD Jadwal: pilih semester, kelas, mapel, guru, hari, jam mulai, jam selesai.
- Validasi: referensi harus ada; jam selesai setelah jam mulai; tidak ada bentrok guru atau kelas pada hari dan jam yang sama dalam satu semester.
- Tampilan jadwal dapat difilter per semester, kelas, dan guru.
- Fungsi helper `getSemesterAktif()` dan `getJadwalByGuruHari(nip, hari)` untuk dipakai task berikutnya.

## Di luar lingkup
Import jadwal massal (T05), presensi.

## Kriteria selesai
- [ ] Hanya satu semester aktif pada satu waktu — diimplementasikan (`setSemesterAktif` + LockService, satu `setValues`); menunggu uji manual/`testT04()`.
- [ ] Jadwal tersimpan dengan `id_semester` dan validasi bentrok bekerja — logika bentrok (termasuk tepat bersambung, beda hari, edit diri sendiri) lulus tes node; penyimpanan teks jam di sheet menunggu `testT04()`.
- [ ] Helper `getSemesterAktif()` dan `getJadwalByGuruHari()` teruji — diimplementasikan; menunggu uji manual/`testT04()`.

## Ringkasan
1. `Master.gs`: mesin CRUD T03 diperluas (autoId, hook validasi, guard hapus, kolom jam teks) untuk Semester & Jadwal; referensi kini divalidasi di dalam lock.
2. Ditambah CRUD semester (aktif tunggal), CRUD jadwal + filter/nama gabungan, helper internal, dan `testT04()`.
3. `JadwalPage.html` baru: tab Semester & Jadwal; menu + include di `Index.html`; hook navigasi di `Script.html`; `include('Master')` diperbaiki menjadi `MasterPage`.
4. Tes node `apps-script/test/t04-pure.test.js` (9 kasus) lulus; sintaks 6 blok & semua include diperiksa lewat node.
5. Panduan uji manual T04 ditambahkan di `README.md`; `testT04()` belum dijalankan karena butuh Apps Script + Sheet asli.
