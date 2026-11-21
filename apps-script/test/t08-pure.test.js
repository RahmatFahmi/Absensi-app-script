/**
 * Tes node (BUKAN Apps Script) untuk fungsi murni T08 di Izin.gs:
 * batas unggah bukti, transisi status presensi, dan penulisan batch unggahBukti.
 * Jalankan: node apps-script/test/t08-pure.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const file = path.join(__dirname, '..', 'Izin.gs');

// Mock sheet sederhana: merekam setiap setValue/setValues yang dipanggil.
function fakeSheet(headers, rows) {
  return {
    data: [headers].concat(rows),
    writes: [],
    getDataRange() {
      const self = this;
      return { getValues: () => self.data.map((r) => r.slice()) };
    },
    getRange(row, col, numRows, numCols) {
      const self = this;
      return {
        getValues() {
          return self.data.slice(row - 1, row - 1 + numRows)
            .map((r) => r.slice(col - 1, col - 1 + numCols));
        },
        setValues(values) {
          self.writes.push({ row, col, numRows, numCols, values });
          for (let i = 0; i < numRows; i++) {
            for (let j = 0; j < numCols; j++) self.data[row - 1 + i][col - 1 + j] = values[i][j];
          }
        },
        setValue(value) {
          this.setValues([[value]]);
        }
      };
    }
  };
}

const izinSheet = fakeSheet(
  ['id_izin', 'nis', 'id_jadwal', 'tanggal', 'jenis', 'alasan', 'link_bukti', 'status',
    'diajukan_pada', 'diproses_oleh', 'diproses_pada', 'catatan_guru'],
  [['IZN_1', '1001', 'JDW_1', '2026-11-10', 'Sakit', 'Demam', '', 'Menunggu bukti',
    '2026-11-10T07:00:00+08:00', '', '', '']]
);

const context = vm.createContext({
  console,
  Logger: { log: () => {} },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      if (fmt === 'yyyy-MM-dd') return new Date(d).toISOString().slice(0, 10);
      return '10:00';
    },
    base64Decode: (b64) => {
      const buf = Buffer.from(b64, 'base64');
      const arr = [];
      for (let i = 0; i < buf.length; i++) arr.push(buf[i] > 127 ? buf[i] - 256 : buf[i]);
      return arr;
    },
    base64Encode: (bytes) => Buffer.from(bytes).toString('base64'),
    newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
    getUuid: () => 'mock-uuid-1234'
  },
  PropertiesService: {
    getScriptProperties: () => ({ getProperty: () => null, setProperty: () => {} })
  },
  DriveApp: {
    getFolderById: () => null,
    createFolder: () => ({
      getId: () => 'folder-1',
      createFile: () => ({ getUrl: () => 'https://drive.google.com/file/d/FILE_1/view' })
    }),
    getFileById: () => ({ setTrashed: () => {} })
  },
  LockService: {
    getScriptLock: () => ({ waitLock: () => {}, releaseLock: () => {} })
  },
  CacheService: {
    getScriptCache: () => ({ get: () => null, put: () => {} })
  },
  getSpreadsheet_: () => ({
    getSheetByName: (name) => (name === 'Izin' ? izinSheet : null)
  }),
  getAppTimeZone_: () => 'Asia/Makassar',
  getTodayYmd_: () => '2026-11-13',
  jamKeMenit_: () => 420,
  hariDariTanggal_: () => 'Senin',
  formatTanggalPresensi_: (v) => {
    if (v instanceof Date) return v.toISOString().slice(0, 10);
    const s = String(v === null || v === undefined ? '' : v).trim();
    const m = s.match(/^(\d{4}-\d{2}-\d{2})/);
    return m ? m[1] : s;
  },
  requireRole_: () => ({ id_user: 'USR_1', username: '1001', role: 'Siswa', ref_id: '1001' }),
  requireEditorOwner_: () => {},
  readSheetAsObjects_: () => [],
  findRowByKey_: () => null,
  getSemesterAktif_: () => null,
  appendRow_: () => {},
  generateId_: (p) => p + '_MOCK_001',
  getIzinMarkers_: () => ({})
});

vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });

let pass = 0;
const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

// 1. Batas unggah bukti: 3 hari kalender setelah tanggal pengajuan
test('batas unggah: hari ke-3 setelah pengajuan masih boleh', () => {
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-10', '2026-11-13', 3), false);
});

test('batas unggah: hari ke-4 setelah pengajuan ditolak otomatis', () => {
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-10', '2026-11-14', 3), true);
});

test('batas unggah: tanggal sebelum atau sama dengan pengajuan tidak lewat', () => {
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-10', '2026-11-10', 3), false);
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-10', '2026-11-09', 3), false);
});

test('batas unggah: pergantian bulan dihitung benar', () => {
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-28', '2026-12-01', 3), false);
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-28', '2026-12-02', 3), true);
});

test('batas unggah: sel tanggal berupa Date (data lama) tetap terbaca', () => {
  assert.strictEqual(
    context.isLewatBatasUnggah_(new Date('2026-11-10T00:00:00Z'), '2026-11-13', 3),
    false
  );
});

test('batas unggah: tanggal tidak valid tidak pernah ditolak otomatis', () => {
  assert.strictEqual(context.isLewatBatasUnggah_('bukan-tanggal', '2026-11-30', 3), false);
  assert.strictEqual(context.isLewatBatasUnggah_('2026-11-10', '', 3), false);
});

// 2. Transisi status presensi saat keputusan guru berubah
test('transisi presensi: Menunggu persetujuan -> Disetujui menulis status', () => {
  assert.strictEqual(context.aksiPresensiPengajuan_('Menunggu persetujuan', 'Disetujui'), 'set');
  assert.strictEqual(context.aksiPresensiPengajuan_('Ditolak', 'Disetujui'), 'set');
});

test('transisi presensi: Disetujui -> Ditolak mengembalikan ke Alpa', () => {
  assert.strictEqual(context.aksiPresensiPengajuan_('Disetujui', 'Ditolak'), 'revert');
});

test('transisi presensi: keputusan sama atau bukan Disetujui/Ditolak tidak mengubah presensi', () => {
  assert.strictEqual(context.aksiPresensiPengajuan_('Disetujui', 'Disetujui'), 'none');
  assert.strictEqual(context.aksiPresensiPengajuan_('Menunggu bukti', 'Ditolak'), 'none');
  assert.strictEqual(context.aksiPresensiPengajuan_('', 'Hadir'), 'none');
});

// 3. unggahBukti menulis link_bukti + status dalam satu setValues 1x2
test('unggahBukti: link_bukti dan status ditulis sekali pada rentang 1x2', () => {
  const pdfBase64 = Buffer.from([0x25, 0x50, 0x44, 0x46]).toString('base64');
  izinSheet.writes.length = 0;

  const res = context.unggahBukti('token-uji', 'IZN_1', {
    nama: 'surat.pdf',
    mime: 'application/pdf',
    base64: pdfBase64
  });

  assert.strictEqual(res.status, 'Menunggu persetujuan');
  assert.strictEqual(izinSheet.writes.length, 1, 'harus satu panggilan tulis, bukan dua');
  const write = izinSheet.writes[0];
  assert.strictEqual(write.row, 2);
  assert.strictEqual(write.col, 7);
  assert.strictEqual(write.numRows, 1);
  assert.strictEqual(write.numCols, 2);
  assert.strictEqual(write.values[0][1], 'Menunggu persetujuan');
  assert.ok(String(write.values[0][0]).indexOf('http') === 0, 'link_bukti berupa URL');
});

// 4. Penolakan otomatis menghormati daftar id_izin opsional (dipakai testT08)
test('tolak otomatis: hanya id_izin yang diberikan yang boleh diubah', () => {
  const headers = ['id_izin', 'nis', 'id_jadwal', 'tanggal', 'jenis', 'alasan', 'link_bukti', 'status',
    'diajukan_pada', 'diproses_oleh', 'diproses_pada', 'catatan_guru'];
  const rows = [
    ['TEST_EXP', '1001', 'J1', '2026-11-01', 'Sakit', 'Demam', '', 'Menunggu bukti',
      '2026-11-01T07:00:00+08:00', '', '', ''],
    ['REAL_EXP', '1002', 'J1', '2026-11-01', 'Sakit', 'Demam', '', 'Menunggu bukti',
      '2026-11-01T07:00:00+08:00', '', '', ''],
    ['TEST_NEW', '1003', 'J1', '2026-11-13', 'Sakit', 'Demam', '', 'Menunggu bukti',
      '2026-11-13T07:00:00+08:00', '', '', '']
  ];
  const sheet = fakeSheet(headers, rows);
  context.getSpreadsheet_ = () => ({
    getSheetByName: (name) => (name === 'Izin' ? sheet : null)
  });

  const res = context.tolakPengajuanKedaluwarsa_(['TEST_EXP']);
  assert.strictEqual(res.updated, 1, 'hanya satu baris TEST_ yang diproses');
  assert.strictEqual(sheet.data[1][7], 'Ditolak', 'baris TEST_ lewat batas ditolak');
  assert.strictEqual(sheet.data[2][7], 'Menunggu bukti', 'baris non-TEST_ tidak boleh berubah');
  assert.strictEqual(sheet.data[3][7], 'Menunggu bukti', 'baris TEST_ dalam batas tidak berubah');

  // Trigger memanggil tanpa parameter: semua baris lewat batas diproses.
  const resAll = context.tolakPengajuanKedaluwarsa_();
  assert.strictEqual(resAll.updated, 1, 'tanpa parameter memproses sisa baris lewat batas');
  assert.strictEqual(sheet.data[2][7], 'Ditolak', 'tanpa parameter menjangkau baris non-TEST_');
});

cases.forEach((c) => {
  try {
    c.fn();
    pass++;
    console.log('[OK] ' + c.name);
  } catch (err) {
    console.error('[FAIL] ' + c.name + ': ' + err.message);
    throw err;
  }
});

console.log('\nHasil tes node fungsi murni T08: ' + pass + ' lulus, 0 gagal');
