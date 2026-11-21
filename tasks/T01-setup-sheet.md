# T01: Setup Proyek & Struktur Sheet
Status: menunggu uji manual
Dependensi: tidak ada

## Tujuan
Menyiapkan proyek Apps Script, spreadsheet, dan kerangka web app kosong.

## Lingkup
- Buat spreadsheet dengan 9 sheet sesuai skema di `AGENTS.md` (baris 1 = header).
- Buat proyek Apps Script terikat spreadsheet; atur `appsscript.json` (zona waktu, `webapp.access`, `executeAs`).
- `Code.gs`: `doGet()` mengembalikan `Index.html` via `HtmlService.createTemplateFromFile`, plus fungsi `include(filename)`.
- `Index.html`, `Style.html`, `Script.html`: kerangka dengan Bootstrap 5 CDN dan area konten kosong.
- Fungsi helper umum di `Code.gs`: baca sheet jadi array objek, tambah baris, cari baris berdasarkan kunci, generate ID.
- Fungsi `setupSheets()` yang membuat sheet + header jika belum ada.
- Seed satu akun Admin awal.

## Di luar lingkup
Login, halaman apa pun selain kerangka kosong.

## Kriteria selesai
- [ ] 9 sheet ada dengan header benar (menunggu uji manual `setupSheets()`)
- [ ] Web app dapat di-deploy dan menampilkan kerangka kosong (menunggu uji manual deployment)
- [ ] Helper sheet bekerja (diuji dari editor) (menunggu uji manual `testT01()`)
- [ ] Akun Admin awal tersedia di `Users` (menunggu uji manual `seedAdmin()`)
