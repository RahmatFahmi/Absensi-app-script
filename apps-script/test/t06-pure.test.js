/**
 * Tes node (BUKAN Apps Script) untuk fungsi murni T06 di Presensi.gs:
 * validasi tanggal, validasi hari jadwal, verifikasi roster siswa,
 * validasi status/keterangan, dan pembentukan baris upsert (insert vs update).
 * Jalankan: node apps-script/test/t06-pure.test.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const file = path.join(__dirname, '..', 'Presensi.gs');
if (!fs.existsSync(file)) {
  fs.writeFileSync(file, '// Presensi.gs placeholder\n', 'utf8');
}

const context = vm.createContext({
  console,
  Utilities: {
    formatDate: (d, tz, fmt) => {
      // Sederhana untuk mock tes node
      const dt = new Date(d);
      if (fmt === 'EEEE') {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dt.getUTCDay()];
      }
      return dt.toISOString().slice(0, 10);
    }
  }
});
vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });

let pass = 0;
const cases = [];
function test(name, fn) {
  cases.push({ name, fn });
}

// 1. Validasi Tanggal
test('tanggal masa depan ditolak', () => {
  assert.throws(
    () => context.validateTanggalPresensi_('2026-11-17', '2026-11-16'),
    /masa depan/i
  );
});

test('tanggal hari ini dan masa lampau diterima', () => {
  assert.strictEqual(context.validateTanggalPresensi_('2026-11-16', '2026-11-16'), '2026-11-16');
  assert.strictEqual(context.validateTanggalPresensi_('2026-11-10', '2026-11-16'), '2026-11-10');
});

test('format tanggal tidak valid ditolak', () => {
  assert.throws(() => context.validateTanggalPresensi_('16-11-2026', '2026-11-16'), /format/i);
  assert.throws(() => context.validateTanggalPresensi_('2026/11/16', '2026-11-16'), /format/i);
  assert.throws(() => context.validateTanggalPresensi_('invalid-date', '2026-11-16'), /format/i);
  assert.throws(() => context.validateTanggalPresensi_('2026-02-30', '2026-11-16'), /tidak valid/i);
});

// 2. Validasi Hari Jadwal
test('hari tanggal tidak cocok dengan hari jadwal ditolak', () => {
  assert.throws(
    () => context.validateHariPresensi_('Selasa', 'Senin'),
    /tidak sesuai/i
  );
});

test('hari tanggal cocok dengan hari jadwal diterima', () => {
  assert.strictEqual(context.validateHariPresensi_('Senin', 'Senin'), true);
});

// 3. Verifikasi Roster Siswa
const classRoster = [
  { nis: '2001', nama: 'Ahmad Fauzi', id_kelas: 'K1' },
  { nis: '2002', nama: 'Budi Santoso', id_kelas: 'K1' },
  { nis: '2003', nama: 'Citra Dewi', id_kelas: 'K1' }
];

test('roster siswa persis sama diterima', () => {
  const submitted = [
    { nis: '2002', status: 'Hadir', keterangan: '' },
    { nis: '2001', status: 'Hadir', keterangan: '' },
    { nis: '2003', status: 'Sakit', keterangan: 'Demam' }
  ];
  assert.doesNotThrow(() => context.validateRosterPresensi_(submitted, classRoster));
});

test('roster siswa ada yang kurang ditolak "Daftar siswa berubah, muat ulang halaman"', () => {
  const submitted = [
    { nis: '2001', status: 'Hadir', keterangan: '' },
    { nis: '2002', status: 'Hadir', keterangan: '' }
  ];
  assert.throws(
    () => context.validateRosterPresensi_(submitted, classRoster),
    /Daftar siswa berubah, muat ulang halaman/
  );
});

test('roster siswa ada yang lebih ditolak "Daftar siswa berubah, muat ulang halaman"', () => {
  const submitted = [
    { nis: '2001', status: 'Hadir', keterangan: '' },
    { nis: '2002', status: 'Hadir', keterangan: '' },
    { nis: '2003', status: 'Hadir', keterangan: '' },
    { nis: '2004', status: 'Hadir', keterangan: '' }
  ];
  assert.throws(
    () => context.validateRosterPresensi_(submitted, classRoster),
    /Daftar siswa berubah, muat ulang halaman/
  );
});

test('roster siswa dengan duplikat NIS ditolak "Daftar siswa berubah, muat ulang halaman"', () => {
  const submitted = [
    { nis: '2001', status: 'Hadir', keterangan: '' },
    { nis: '2001', status: 'Hadir', keterangan: '' },
    { nis: '2003', status: 'Hadir', keterangan: '' }
  ];
  assert.throws(
    () => context.validateRosterPresensi_(submitted, classRoster),
    /Daftar siswa berubah, muat ulang halaman/
  );
});

// 4. Validasi Status dan Keterangan
test('status valid diterima', () => {
  assert.doesNotThrow(() => context.validateStatusKeteranganPresensi_('Hadir', ''));
  assert.doesNotThrow(() => context.validateStatusKeteranganPresensi_('Izin', 'Acara keluarga'));
  assert.doesNotThrow(() => context.validateStatusKeteranganPresensi_('Sakit', 'Flu'));
  assert.doesNotThrow(() => context.validateStatusKeteranganPresensi_('Alpa', 'Tanpa kabar'));
});

test('status di luar Hadir/Izin/Sakit/Alpa ditolak', () => {
  assert.throws(() => context.validateStatusKeteranganPresensi_('Bolos', ''), /Status presensi tidak valid/);
  assert.throws(() => context.validateStatusKeteranganPresensi_('', ''), /Status presensi tidak valid/);
});

test('keterangan lebih dari 200 karakter ditolak', () => {
  const longText = 'A'.repeat(201);
  assert.throws(() => context.validateStatusKeteranganPresensi_('Hadir', longText), /200 karakter/);
});

// 5. Pembentukan Baris Upsert (Insert vs Update)
test('upsert memisahkan baris baru (insert) dan baris edit (update)', () => {
  const existingRows = [
    {
      _rowNumber: 5,
      id_presensi: 'PRS_001',
      tanggal: '2026-11-16',
      id_jadwal: 'JDW_101',
      nis: '2001',
      status: 'Hadir',
      keterangan: '',
      diubah_oleh: '19750101',
      diubah_pada: '2026-11-16T08:00:00Z'
    }
  ];

  const submittedRows = [
    { nis: '2001', status: 'Sakit', keterangan: 'Tiba-tiba pusing' },
    { nis: '2002', status: 'Hadir', keterangan: '' }
  ];

  const meta = {
    id_jadwal: 'JDW_101',
    tanggal: '2026-11-16',
    diubah_oleh: '19750101',
    diubah_pada: '2026-11-16T09:00:00Z'
  };

  let idCounter = 100;
  const idGenerator = (prefix) => `${prefix}_${++idCounter}`;

  const result = context.buildUpsertPresensiRows_(existingRows, submittedRows, meta, idGenerator);

  // 2001 harus update baris 5
  assert.strictEqual(result.toUpdate.length, 1);
  assert.strictEqual(result.toUpdate[0].rowNumber, 5);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.toUpdate[0].rowValues)), [
    'PRS_001',
    '2026-11-16',
    'JDW_101',
    '2001',
    'Sakit',
    'Tiba-tiba pusing',
    '19750101',
    '2026-11-16T09:00:00Z'
  ]);

  // 2002 harus insert baris baru
  assert.strictEqual(result.toInsert.length, 1);
  assert.deepStrictEqual(JSON.parse(JSON.stringify(result.toInsert[0])), [
    'PRS_101',
    '2026-11-16',
    'JDW_101',
    '2002',
    'Hadir',
    '',
    '19750101',
    '2026-11-16T09:00:00Z'
  ]);
});

// 6. Status default form presensi dari pengajuan "Disetujui" (T08)
test('status default presensi: baris tersimpan selalu menang', () => {
  assert.strictEqual(
    context.resolveDefaultStatusPresensi_('Sakit', { jenis: 'Izin', status: 'Disetujui' }),
    'Sakit'
  );
});

test('status default presensi: pengajuan Disetujui dipakai bila presensi belum ada', () => {
  assert.strictEqual(
    context.resolveDefaultStatusPresensi_('', { jenis: 'Sakit', status: 'Disetujui' }),
    'Sakit'
  );
  assert.strictEqual(
    context.resolveDefaultStatusPresensi_(null, { jenis: 'Izin', status: 'Disetujui' }),
    'Izin'
  );
});

test('status default presensi: pengajuan belum disetujui atau jenis asing tetap Hadir', () => {
  assert.strictEqual(
    context.resolveDefaultStatusPresensi_('', { jenis: 'Sakit', status: 'Menunggu persetujuan' }),
    'Hadir'
  );
  assert.strictEqual(context.resolveDefaultStatusPresensi_('', null), 'Hadir');
  assert.strictEqual(
    context.resolveDefaultStatusPresensi_('', { jenis: 'Hadir', status: 'Disetujui' }),
    'Hadir'
  );
});

cases.forEach(c => {
  try {
    c.fn();
    pass++;
    console.log(`[OK] ${c.name}`);
  } catch (err) {
    console.error(`[FAIL] ${c.name}: ${err.message}`);
    throw err;
  }
});

console.log(`\nHasil tes node fungsi murni T06: ${pass} lulus, 0 gagal`);

