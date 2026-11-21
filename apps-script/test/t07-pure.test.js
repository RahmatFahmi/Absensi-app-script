/**
 * Unit Test Node untuk Fungsi Murni T07 (Pengajuan Sakit/Izin Siswa)
 * Memuat dan menguji fungsi dari Izin.gs menggunakan vm context.
 */

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

// Baca Izin.gs
const izinGsPath = path.join(__dirname, '..', 'Izin.gs');
const izinGsCode = fs.readFileSync(izinGsPath, 'utf8');

// Siapkan context VM dengan mock dasar
const context = vm.createContext({
  console,
  Logger: { log: () => {} },
  Utilities: {
    formatDate: (d, tz, fmt) => {
      // Mock sederhana
      return '10:00';
    },
    base64Decode: (b64) => {
      const buf = Buffer.from(b64, 'base64');
      // Return signed byte array seperti Apps Script
      const arr = [];
      for (let i = 0; i < buf.length; i++) {
        const byte = buf[i];
        arr.push(byte > 127 ? byte - 256 : byte);
      }
      return arr;
    },
    base64Encode: (bytes) => {
      return Buffer.from(bytes).toString('base64');
    },
    getUuid: () => 'mock-uuid-1234'
  },
  PropertiesService: {
    getScriptProperties: () => ({
      getProperty: () => null,
      setProperty: () => {}
    })
  },
  DriveApp: {
    getFolderById: () => null,
    createFolder: () => ({ getId: () => 'folder-1', createFile: () => ({ getUrl: () => 'https://drive.google.com/file/1' }) }),
    getFileById: () => ({ setTrashed: () => {} })
  },
  LockService: {
    getScriptLock: () => ({
      waitLock: () => {},
      releaseLock: () => {}
    })
  },
  CacheService: {
    getScriptCache: () => ({
      get: () => null,
      put: () => {}
    })
  },
  jamKeMenit_: (jamStr) => {
    if (!jamStr || typeof jamStr !== 'string') return null;
    const parts = jamStr.trim().split(':');
    if (parts.length < 2) return null;
    const h = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    return h * 60 + m;
  },
  getAppTimeZone_: () => 'Asia/Makassar',
  getTodayYmd_: () => '2026-11-16',
  hariDariTanggal_: () => 'Senin',
  formatTanggalPresensi_: (v) => v,
  requireRole_: () => ({ id_user: 'USR_1', username: '1001', role: 'Siswa', ref_id: '1001' }),
  requireEditorOwner_: () => {},
  getSpreadsheet_: () => null,
  readSheetAsObjects_: () => [],
  findRowByKey_: () => null,
  getSemesterAktif_: () => null,
  appendRow_: () => {},
  generateId_: (p) => p + '_MOCK_001',
  getIzinMarkers_: () => ({})
});

// Jalankan Izin.gs di dalam VM
vm.runInContext(izinGsCode, context);

const isWithinRequestWindow_ = context.isWithinRequestWindow_;
const detectMagicBytes_ = context.detectMagicBytes_;
const validateBerkas_ = context.validateBerkas_;
const generateSafeFilename_ = context.generateSafeFilename_;
const cleanBase64_ = context.cleanBase64_;

// ==========================================
// PENGUJIAN
// ==========================================
let passedCount = 0;
function test(name, fn) {
  try {
    fn();
    console.log(`[OK] ${name}`);
    passedCount++;
  } catch (err) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    process.exit(1);
  }
}

// 1. Batas window 15 menit
test('Window batas: jam_mulai 07:00, waktu 06:59 (419 menit) ditolak', () => {
  assert.strictEqual(isWithinRequestWindow_('07:00', 419), false);
});

test('Window batas: jam_mulai 07:00, waktu 07:00 (420 menit) diterima', () => {
  assert.strictEqual(isWithinRequestWindow_('07:00', 420), true);
});

test('Window batas: jam_mulai 07:00, waktu 07:15 (435 menit) diterima', () => {
  assert.strictEqual(isWithinRequestWindow_('07:00', 435), true);
});

test('Window batas: jam_mulai 07:00, waktu 07:16 (436 menit) ditolak', () => {
  assert.strictEqual(isWithinRequestWindow_('07:00', 436), false);
});

test('Window batas: format jam invalid ditolak dengan aman', () => {
  assert.strictEqual(isWithinRequestWindow_('invalid', 420), false);
  assert.strictEqual(isWithinRequestWindow_('07:00', null), false);
});

// 2. Deteksi Magic Bytes
test('Magic bytes: PDF (%PDF) terdeteksi dengan tepat', () => {
  const pdfBytes = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x34];
  const res = detectMagicBytes_(pdfBytes);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res)), { type: 'pdf', mime: 'application/pdf', ext: 'pdf' });
});

test('Magic bytes: JPEG (FF D8 FF) terdeteksi dengan tepat', () => {
  const jpgBytes = [0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10];
  const res = detectMagicBytes_(jpgBytes);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res)), { type: 'jpeg', mime: 'image/jpeg', ext: 'jpg' });
});

test('Magic bytes: PNG (89 50 4E 47) terdeteksi dengan tepat', () => {
  const pngBytes = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
  const res = detectMagicBytes_(pngBytes);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(res)), { type: 'png', mime: 'image/png', ext: 'png' });
});

test('Magic bytes: Signed bytes dari Utilities.base64Decode Apps Script ditangani dengan benar', () => {
  // 0x89 -> -119, 0xFF -> -1, 0xD8 -> -40
  const signedPng = [-119, 0x50, 0x4E, 0x47];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(detectMagicBytes_(signedPng))), { type: 'png', mime: 'image/png', ext: 'png' });

  const signedJpg = [-1, -40, -1];
  assert.deepStrictEqual(JSON.parse(JSON.stringify(detectMagicBytes_(signedJpg))), { type: 'jpeg', mime: 'image/jpeg', ext: 'jpg' });
});

test('Magic bytes: EXE yang di-rename menjadi .pdf ditolak', () => {
  const exeBytes = Buffer.from([0x4D, 0x5A, 0x90, 0x00, 0x03]); // MZ header
  assert.throws(() => {
    validateBerkas_({
      nama: 'surat_sakit.pdf',
      mime: 'application/pdf',
      base64: exeBytes.toString('base64')
    });
  }, /Format berkas tidak didukung/);
});

test('Magic bytes: Teks biasa yang di-rename menjadi .jpg ditolak', () => {
  const txtBytes = Buffer.from('Ini bukan file gambar asli!');
  assert.throws(() => {
    validateBerkas_({
      nama: 'foto_surat.jpg',
      mime: 'image/jpeg',
      base64: txtBytes.toString('base64')
    });
  }, /Format berkas tidak didukung/);
});

// 3. Batas Ukuran 2 MB
test('Ukuran berkas: tepat 2 MB (2,097,152 bytes) dengan magic bytes valid diterima', () => {
  const buf = Buffer.alloc(2097152);
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46; // %PDF
  const res = validateBerkas_({
    nama: 'dokumen.pdf',
    base64: buf.toString('base64')
  });
  assert.strictEqual(res.size, 2097152);
  assert.strictEqual(res.ext, 'pdf');
});

test('Ukuran berkas: 2 MB + 1 byte (2,097,153 bytes) ditolak', () => {
  const buf = Buffer.alloc(2097153);
  buf[0] = 0x25; buf[1] = 0x50; buf[2] = 0x44; buf[3] = 0x46; // %PDF
  assert.throws(() => {
    validateBerkas_({
      nama: 'dokumen.pdf',
      base64: buf.toString('base64')
    });
  }, /Ukuran berkas melebihi batas maksimal 2 MB/);
});

// 4. Sanitasi nama berkas
test('Nama berkas aman: format {id_izin}_{nis}.{ext}', () => {
  const filename = generateSafeFilename_('IZN_20261116001', '1001', 'pdf');
  assert.strictEqual(filename, 'IZN_20261116001_1001.pdf');
});

test('Nama berkas aman: percobaan directory traversal dan karakter terlarang dibersihkan', () => {
  const filename = generateSafeFilename_('../../IZN/01', 'NIS:1001/../', 'jpg');
  assert.strictEqual(filename, 'IZN01_NIS1001.jpg');
});

// 5. Data URI prefix stripping
test('Data URI base64 prefix dibersihkan sebelum decoding', () => {
  const pngBytes = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const dataUri = `data:image/png;base64,${pngBytes.toString('base64')}`;
  const res = validateBerkas_({
    nama: 'scan.png',
    base64: dataUri
  });
  assert.strictEqual(res.type, 'png');
  assert.strictEqual(res.ext, 'png');
});

// 6. Urutan riwayat (tanggal bisa berupa Date dari sheet)
test('Riwayat pengajuan: terbaru lebih dulu walau diajukan_pada berupa Date', () => {
  context.readSheetAsObjects_ = (sheetName) => sheetName === 'Izin'
    ? [
        { nis: '1001', id_izin: 'IZN_LAMA', id_jadwal: '', diajukan_pada: new Date('2026-11-15T08:00:00+08:00') },
        { nis: '1001', id_izin: 'IZN_BARU', id_jadwal: '', diajukan_pada: new Date('2026-11-16T08:00:00+08:00') }
      ]
    : [];
  const rows = context.getPengajuanSaya('token-uji');
  assert.strictEqual(rows[0].id_izin, 'IZN_BARU');
});

console.log(`\nHasil tes node fungsi murni T07: ${passedCount} lulus, 0 gagal`);
