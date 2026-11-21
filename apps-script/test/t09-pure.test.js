/**
 * Tes node (BUKAN Apps Script) untuk fungsi murni T09 di Rekap.gs:
 * agregasi H/I/S/A, persen, filter inklusif, isolasi guru/siswa,
 * normalisasi filter, nama file ekspor, dan sanitasi sel Excel.
 * Jalankan: node apps-script/test/t09-pure.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const file = path.join(__dirname, '..', 'Rekap.gs');

const context = vm.createContext({
  console,
  Logger: { log: () => {} },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      if (fmt === 'yyyy-MM-dd') return new Date(d).toISOString().slice(0, 10);
      return '10:00';
    }
  },
  formatTanggalPresensi_: (v) => {
    if (v instanceof Date) return new Date(v).toISOString().slice(0, 10);
    const s = String(v === null || v === undefined ? '' : v).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  },
  getSemesterAktif_: () => ({ id_semester: 'S1' }),
  requireRole_: () => {
    throw new Error('requireRole_ dipanggil di luar tes role');
  },
  readSheetAsObjects_: () => [],
  getTodayYmd_: () => '2026-11-18',
  getAppTimeZone_: () => 'Asia/Makassar'
});

vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });

let pass = 0;
const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

const data = {
  jadwal: [
    { id_jadwal: 'J1', id_semester: 'S1', id_kelas: 'K1', id_mapel: 'M1', nip_guru: 'G1' },
    { id_jadwal: 'J2', id_semester: 'S1', id_kelas: 'K1', id_mapel: 'M2', nip_guru: 'G1' },
    { id_jadwal: 'J3', id_semester: 'S1', id_kelas: 'K2', id_mapel: 'M1', nip_guru: 'G2' },
    { id_jadwal: 'J4', id_semester: 'S2', id_kelas: 'K1', id_mapel: 'M1', nip_guru: 'G1' }
  ],
  siswa: [
    { nis: '1001', nama: 'Ani', id_kelas: 'K1' },
    { nis: '1002', nama: 'Budi', id_kelas: 'K1' },
    { nis: '1003', nama: 'Cici', id_kelas: 'K2' }
  ],
  kelas: [
    { id_kelas: 'K1', nama_kelas: 'VII A' },
    { id_kelas: 'K2', nama_kelas: 'VIII B' }
  ],
  mapel: [
    { id_mapel: 'M1', nama_mapel: 'Matematika' },
    { id_mapel: 'M2', nama_mapel: 'Bahasa Indonesia' }
  ],
  presensi: [
    { id_presensi: 'P1', tanggal: '2026-11-10', id_jadwal: 'J1', nis: '1001', status: 'Hadir' },
    { id_presensi: 'P2', tanggal: '2026-11-10', id_jadwal: 'J1', nis: '1002', status: 'Izin' },
    { id_presensi: 'P3', tanggal: '2026-11-11', id_jadwal: 'J1', nis: '1001', status: 'Sakit' },
    { id_presensi: 'P4', tanggal: '2026-11-11', id_jadwal: 'J2', nis: '1001', status: 'Hadir' },
    { id_presensi: 'P5', tanggal: '2026-11-11', id_jadwal: 'J2', nis: '1002', status: 'Alpa' },
    { id_presensi: 'P6', tanggal: '2026-11-12', id_jadwal: 'J3', nis: '1003', status: 'Hadir' },
    { id_presensi: 'P7', tanggal: '2026-10-01', id_jadwal: 'J4', nis: '1001', status: 'Hadir' }
  ]
};

function baris(rows, namaKelas, namaMapel) {
  return rows.find((r) => r.nama_kelas === namaKelas && r.nama_mapel === namaMapel);
}

// 1. Persentase hadir
test('persen hadir: satu desimal dan total 0 menjadi "-"', () => {
  assert.strictEqual(context.hitungPersenHadir_(3, 4), '75.0');
  assert.strictEqual(context.hitungPersenHadir_(2, 3), '66.7');
  assert.strictEqual(context.hitungPersenHadir_(0, 5), '0.0');
  assert.strictEqual(context.hitungPersenHadir_(0, 0), '-');
});

// 2. Agregasi dasar per kelas+mapel semester aktif
test('agregasi: H/I/S/A, total, persen, dan kelompok kelas+mapel', () => {
  const rows = context.agregasiRekap_(data, { id_semester: 'S1', group_by: 'kelas_mapel' });
  assert.strictEqual(rows.length, 3);

  const k1m1 = baris(rows, 'VII A', 'Matematika');
  assert.deepStrictEqual(
    { h: k1m1.hadir, i: k1m1.izin, s: k1m1.sakit, a: k1m1.alpa, t: k1m1.total, p: k1m1.persen },
    { h: 1, i: 1, s: 1, a: 0, t: 3, p: '33.3' }
  );

  const k1m2 = baris(rows, 'VII A', 'Bahasa Indonesia');
  assert.deepStrictEqual(
    { h: k1m2.hadir, i: k1m2.izin, s: k1m2.sakit, a: k1m2.alpa, t: k1m2.total, p: k1m2.persen },
    { h: 1, i: 0, s: 0, a: 1, t: 2, p: '50.0' }
  );

  const k2m1 = baris(rows, 'VIII B', 'Matematika');
  assert.strictEqual(k2m1.persen, '100.0');
});

test('agregasi: filter semester membuang data semester lain', () => {
  const rows = context.agregasiRekap_(data, { id_semester: 'S2', group_by: 'kelas_mapel' });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].total, 1);
});

// 3. Filter tanggal inklusif
test('agregasi: tanggal_dari dan tanggal_sampai inklusif', () => {
  const rows = context.agregasiRekap_(data, {
    id_semester: 'S1', group_by: 'kelas_mapel',
    tanggal_dari: '2026-11-11', tanggal_sampai: '2026-11-11'
  });
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(baris(rows, 'VII A', 'Matematika').sakit, 1);
  assert.strictEqual(baris(rows, 'VII A', 'Bahasa Indonesia').total, 2);
});

test('agregasi: hanya pertemuan tercatat, tanpa baris total 0', () => {
  const rows = context.agregasiRekap_(data, { id_semester: 'S1', group_by: 'kelas_mapel' });
  assert.ok(rows.every((r) => r.total > 0));
  const kosong = context.agregasiRekap_(data, { id_semester: 'S1', group_by: 'kelas_mapel', id_kelas: 'TIDAK_ADA' });
  assert.strictEqual(kosong.length, 0);
});

// 4. Isolasi guru dan siswa
test('isolasi guru: hanya jadwal dengan nip_guru yang diminta', () => {
  const rows = context.agregasiRekap_(data, { id_semester: 'S1', group_by: 'kelas_mapel', nip_guru: 'G2' });
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].nama_kelas, 'VIII B');
  assert.strictEqual(rows[0].total, 1);
});

test('isolasi siswa: hanya presensi NIS itu, dikelompokkan per mapel', () => {
  const rows = context.agregasiRekap_(data, { id_semester: 'S1', group_by: 'mapel', nis: '1001' });
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(baris(rows, '', 'Matematika').persen, '50.0');
  assert.strictEqual(baris(rows, '', 'Bahasa Indonesia').persen, '100.0');
});

// 5. Normalisasi filter
test('filter: tanggal harus yyyy-MM-dd dan rentang tidak terbalik', () => {
  assert.throws(() => context.normalisasiFilterRekap_({ tanggal_dari: '2026-13-01' }), /Tanggal/);
  assert.throws(() => context.normalisasiFilterRekap_({ tanggal_dari: '2026-11-12', tanggal_sampai: '2026-11-11' }), /Tanggal/);
  const bersih = context.normalisasiFilterRekap_({ id_semester: ' S1 ', tanggal_dari: '2026-11-01' });
  assert.strictEqual(bersih.id_semester, 'S1');
  assert.strictEqual(bersih.tanggal_dari, '2026-11-01');
  assert.strictEqual(bersih.tanggal_sampai, '');
});

// 6. Nama file aman
test('nama file: tanpa pemisah path atau karakter berbahaya', () => {
  const nama = context.namaFileRekap_(['../evil', '2026/2027', 'Ganjil', '=cmd'], '2026-11-18');
  assert.ok(/^Rekap_Presensi_[A-Za-z0-9._-]+\.xlsx$/.test(nama), nama);
  assert.ok(nama.indexOf('/') === -1 && nama.indexOf('\\') === -1);
  assert.ok(nama.length <= 130);
});

// 7. Sanitasi sel Excel (formula injection)
test('sel Excel: teks berawalan = + - @ diberi kutip, angka dan teks biasa tetap', () => {
  assert.strictEqual(context.sanitasiSelExcel_('=1+1'), "'=1+1");
  assert.strictEqual(context.sanitasiSelExcel_('+cmd'), "'+cmd");
  assert.strictEqual(context.sanitasiSelExcel_('@SUM(A1)'), "'@SUM(A1)");
  assert.strictEqual(context.sanitasiSelExcel_('-5'), "'-5");
  assert.strictEqual(context.sanitasiSelExcel_('Hadir'), 'Hadir');
  assert.strictEqual(context.sanitasiSelExcel_(42), 42);
});

for (const c of cases) {
  try {
    c.fn();
    pass++;
    console.log('[OK] ' + c.name);
  } catch (err) {
    console.error('[GAGAL] ' + c.name);
    console.error(err.message);
    process.exit(1);
  }
}

console.log('\nHasil tes node fungsi murni T09: ' + pass + ' lulus, 0 gagal');
