/**
 * Tes node (BUKAN Apps Script) untuk fungsi ringkasan murni T10 di Rekap.gs:
 * hitung presensi per status, ringkasan rekap, jumlah pengajuan menunggu,
 * dan pengajuan terakhir. Jalankan: node apps-script/test/t10-pure.test.js
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
    formatDate: (d) => new Date(d).toISOString().slice(0, 10)
  },
  formatTanggalPresensi_: (v) => {
    if (v instanceof Date) return new Date(v).toISOString().slice(0, 10);
    const s = String(v === null || v === undefined ? '' : v).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  },
  getSemesterAktif_: () => null,
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

// 1. Hitung per status presensi (harian)
test('hitung status: hanya tanggal itu dan jadwal semester aktif', () => {
  const idJadwal = new Set(['J1', 'J2']);
  const rows = [
    { tanggal: '2026-11-18', id_jadwal: 'J1', status: 'Hadir' },
    { tanggal: '2026-11-18', id_jadwal: 'J2', status: 'Izin' },
    { tanggal: '2026-11-18', id_jadwal: 'J2', status: 'Sakit' },
    { tanggal: '2026-11-18', id_jadwal: 'J1', status: 'Alpa' },
    { tanggal: '2026-11-18', id_jadwal: 'J9', status: 'Hadir' },
    { tanggal: '2026-11-17', id_jadwal: 'J1', status: 'Hadir' },
    { tanggal: '2026-11-18', id_jadwal: 'J1', status: 'Status Aneh' },
    new Date('2026-11-18T00:00:00Z')
  ];
  const hasil = context.hitungStatusPresensi_(rows, idJadwal, '2026-11-18');
  assert.strictEqual(hasil.hadir, 1);
  assert.strictEqual(hasil.izin, 1);
  assert.strictEqual(hasil.sakit, 1);
  assert.strictEqual(hasil.alpa, 1);
  assert.strictEqual(hasil.total, 4);
  assert.strictEqual(hasil.persen, '25.0');
});

test('hitung status: kasus kosong menghasilkan nol dan persen "-"', () => {
  const hasil = context.hitungStatusPresensi_([], new Set(), '2026-11-18');
  assert.strictEqual(hasil.hadir, 0);
  assert.strictEqual(hasil.izin, 0);
  assert.strictEqual(hasil.sakit, 0);
  assert.strictEqual(hasil.alpa, 0);
  assert.strictEqual(hasil.total, 0);
  assert.strictEqual(hasil.persen, '-');
});

// 2. Ringkasan rekap dari baris agregasi
test('ringkasan rekap: menjumlah baris dan menghitung persen', () => {
  const hasil = context.ringkasRekap_([
    { hadir: 3, izin: 1, sakit: 0, alpa: 1, total: 5 },
    { hadir: 1, izin: 0, sakit: 1, alpa: 0, total: 2 }
  ]);
  assert.strictEqual(hasil.hadir, 4);
  assert.strictEqual(hasil.izin, 1);
  assert.strictEqual(hasil.sakit, 1);
  assert.strictEqual(hasil.alpa, 1);
  assert.strictEqual(hasil.total, 7);
  assert.strictEqual(hasil.persen, '57.1');
});

test('ringkasan rekap: tanpa baris menghasilkan nol dan persen "-"', () => {
  const hasil = context.ringkasRekap_([]);
  assert.strictEqual(hasil.hadir + hasil.izin + hasil.sakit + hasil.alpa + hasil.total, 0);
  assert.strictEqual(hasil.persen, '-');
});

// 3. Jumlah pengajuan menunggu persetujuan untuk jadwal milik guru
test('pengajuan menunggu: hanya status Menunggu persetujuan pada jadwal guru', () => {
  const idJadwal = new Set(['J1']);
  const rows = [
    { id_jadwal: 'J1', status: 'Menunggu persetujuan' },
    { id_jadwal: 'J1', status: 'Menunggu bukti' },
    { id_jadwal: 'J1', status: 'Menunggu persetujuan' },
    { id_jadwal: 'J2', status: 'Menunggu persetujuan' }
  ];
  assert.strictEqual(context.hitungPengajuanMenunggu_(rows, idJadwal), 2);
  assert.strictEqual(context.hitungPengajuanMenunggu_([], idJadwal), 0);
});

// 4. Pengajuan terakhir siswa
test('pengajuan terakhir: ambil diajukan_pada terbaru milik NIS itu', () => {
  const rows = [
    { nis: '1001', jenis: 'Izin', status: 'Ditolak', tanggal: '2026-11-10', diajukan_pada: '2026-11-10T07:00:00+08:00' },
    { nis: '1001', jenis: 'Sakit', status: 'Disetujui', tanggal: '2026-11-12', diajukan_pada: '2026-11-12T07:00:00+08:00', alasan: 'Demam', catatan_guru: 'OK' },
    { nis: '1002', jenis: 'Izin', status: 'Disetujui', tanggal: '2026-11-13', diajukan_pada: '2026-11-13T07:00:00+08:00' }
  ];
  const hasil = context.ambilPengajuanTerakhir_(rows, '1001');
  assert.strictEqual(hasil.jenis, 'Sakit');
  assert.strictEqual(hasil.tanggal, '2026-11-12');
  assert.strictEqual(hasil.status, 'Disetujui');
  assert.strictEqual(hasil.alasan, 'Demam');
  assert.strictEqual(hasil.catatan_guru, 'OK');
  assert.strictEqual(context.ambilPengajuanTerakhir_(rows, '9999'), null);
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

console.log('\nHasil tes node fungsi murni T10: ' + pass + ' lulus, 0 gagal');
