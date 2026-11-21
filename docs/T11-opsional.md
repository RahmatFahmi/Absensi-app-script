# T11: Fitur Opsional
Status: TODO
Dependensi: semua task inti selesai

Kerjakan hanya jika diminta user, **satu per satu**, dan tanyakan dulu mana yang dipilih.

## A. Presensi scan QR
- Uji dulu kamera (`getUserMedia`) di web app Apps Script pada HP dan browser target, lewat prototipe kecil. Jika tidak jalan, batalkan.
- Mode QR memakai default Alpa; siswa yang di-scan menjadi Hadir; isi QR = NIS.

## B. Notifikasi
- Email (`MailApp`) saat pengajuan disetujui/ditolak atau siswa alpa. Bentuk notifikasi belum diputuskan: tanyakan ke user.

## C. Upload CSV untuk import
- Pakai ulang pipeline validasi T05; hanya menambah cara baca file di klien.
