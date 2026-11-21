# T05: Import Data Massal (Paste)
Status: menunggu uji manual
Dependensi: T04

## Tujuan
Admin dapat memasukkan banyak data sekaligus dengan menempel dari Excel/Sheets.

## Lingkup
- Halaman Import: pilih jenis data (Kelas, Guru, Siswa, Mapel, Jadwal), kotak teks untuk paste (pemisah tab), tombol Proses.
- Template header yang dapat diunduh/ditampilkan untuk tiap jenis data.
- Pratinjau tabel sebelum simpan, dengan baris error ditandai beserta alasannya.
- Validasi sama seperti input manual (NIS/NIP unik, referensi ada, kolom wajib).
- Simpan baris yang valid secara batch; akun otomatis untuk Siswa/Guru seperti di T03.
- Gunakan ulang fungsi validasi dan pembuatan akun dari T03/T04, jangan menulis ulang.

## Di luar lingkup
Upload file CSV (opsional di T11).

## Kriteria selesai
- [ ] Import kelima jenis data bekerja — diimplementasikan (`previewImport`, `commitImport`, `getImportTemplate`); logika parser/validasi lulus 15 tes node. Uji simpan nyata menunggu `testT05()` di Apps Script.
- [ ] Pratinjau menampilkan error per baris — UI menampilkan nomor baris, badge, dan pesan error; pemeriksaan tampilan menunggu uji manual.
- [ ] Hanya baris valid yang tersimpan — `commitImport` memvalidasi ulang dari teks mentah dan menulis satu batch `setValues`; pembuktian di sheet asli menunggu `testT05()`.
- [ ] Urutan ketergantungan (Kelas → Guru/Siswa → Mapel → Jadwal) dijelaskan di UI — petunjuk urutan sudah tampil (Kelas → Mapel → Guru → Siswa → Jadwal, Semester manual di T04); menunggu uji manual.

## Ringkasan
1. `Import.gs`: `parseTsv` + `analyzeImport` murni (BOM/CRLF/sel berkutip, batas 500 baris/200 KB, normalisasi jam, duplikat dalam tempelan) dan server `previewImport`/`commitImport` (Admin, LockService, satu batch tulis) + `getImportTemplate` + `testT05()`.
2. `ImportPage.html`: pilih entitas, Salin Template, textarea, Pratinjau, tabel status, ringkasan "N valid, M error", tombol simpan hanya aktif setelah pratinjau valid; menu Admin & tombol Import di Data Master terhubung.
3. Format teks NIP/NIS/`username`/`ref_id`/jam dipusatkan di `Code.gs` (`TEXT_COLUMNS`, `applyTextFormats_`) dan dipakai `setupSheets`, input manual T03, dan import; rentang tujuan diformat sebelum menulis.
4. Tes node `apps-script/test/t05-pure.test.js` (15 kasus) lulus; sintaks 8 blok, semua `include`, dan RPC klien-server diperiksa lewat node.
5. Panduan uji manual T05 ditambahkan di `README.md`; `testT05()` belum dijalankan karena butuh Apps Script + Sheet asli. Risiko yang ditunda: bila penulisan akun gagal setelah baris master tertulis (kuota), pemulihan otomatis belum ada.
