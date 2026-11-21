/**
 * Tes node (BUKAN Apps Script) untuk getTextColumnIndexes_ di Code.gs:
 * kolom tanggal/angka/boolean dikecualikan, sisanya diperlakukan teks.
 * Jalankan: node apps-script/test/core-text-columns.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const file = path.join(__dirname, '..', 'Code.gs');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });

const idx = (sheet, headers) => Array.from(context.getTextColumnIndexes_(sheet, headers));

assert.deepStrictEqual(
  idx('Presensi', ['id_presensi', 'tanggal', 'id_jadwal', 'nis', 'status', 'keterangan', 'diubah_oleh', 'diubah_pada']),
  [0, 2, 3, 4, 5, 6],
  'Presensi: tanggal & diubah_pada harus dikecualikan'
);

assert.deepStrictEqual(
  idx('Izin', ['id_izin', 'nis', 'id_jadwal', 'tanggal', 'jenis', 'alasan', 'link_bukti', 'status', 'diajukan_pada', 'diproses_oleh', 'diproses_pada', 'catatan_guru']),
  [0, 1, 2, 3, 4, 5, 6, 7, 9, 11],
  'Izin: hanya diajukan_pada & diproses_pada yang dikecualikan (tanggal = teks yyyy-MM-dd)'
);

assert.deepStrictEqual(
  idx('Users', ['id_user', 'username', 'password_hash', 'salt', 'role', 'ref_id', 'wajib_ganti_password', 'aktif']),
  [0, 1, 2, 3, 4, 5],
  'Users: wajib_ganti_password & aktif harus dikecualikan'
);

assert.deepStrictEqual(
  idx('Guru', [' nip ', 'nama']),
  [0, 1],
  'Nama kolom di-trim; sheet tanpa pengecualian semua teks'
);

assert.deepStrictEqual(
  idx('Kelas', ['id_kelas', '', 'nama_kelas']),
  [0, 2],
  'Header kosong dilewati'
);

assert.deepStrictEqual(
  idx('Presensi', ['id_presensi', 'Tanggal', 'id_jadwal', 'nis', 'status', 'keterangan', 'diubah_oleh', 'DIUBAH_PADA']),
  [0, 2, 3, 4, 5, 6],
  'Presensi: pencocokan kolom non-teks harus case-insensitive (Tanggal, DIUBAH_PADA)'
);

assert.deepStrictEqual(
  idx('Jadwal', ['id_jadwal', 'id_semester', 'id_kelas', 'id_mapel', 'nip_guru', 'hari', 'jam_mulai', 'jam_selesai']),
  [0, 1, 2, 3, 4, 5, 6, 7],
  'Jadwal: semua kolom teks termasuk jam'
);

assert.deepStrictEqual(
  idx('Siswa', ['nis', 'nama', 'id_kelas', 'kartu_kontrol']),
  [0, 1, 2, 3],
  'Siswa: semua kolom teks termasuk nis berawalan nol'
);

console.log('OK: getTextColumnIndexes_ lulus semua kasus');
